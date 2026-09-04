ALTER TABLE public.entry_commits
  ADD COLUMN quota_reserved_at timestamptz;

CREATE FUNCTION public.reserve_media_capacity(
  p_account_id bigint,
  p_entry_commit_id varchar,
  p_expected_reserved_bytes bigint,
  p_next_reserved_bytes bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commit_row public.entry_commits%ROWTYPE;
  updated_count integer;
BEGIN
  SELECT *
    INTO commit_row
    FROM public.entry_commits AS entry_commit
   WHERE entry_commit.id = p_entry_commit_id
     AND entry_commit.account_id = p_account_id
   FOR UPDATE;

  IF NOT FOUND OR commit_row.status <> 'allocating' THEN
    RAISE EXCEPTION 'media entry commit cannot reserve capacity';
  END IF;

  IF commit_row.quota_reserved_at IS NOT NULL THEN
    RETURN true;
  END IF;

  UPDATE public.credit_accounts AS account
     SET reserved_free_bytes = p_next_reserved_bytes,
         updated_at = now()
   WHERE account.account_id = p_account_id
     AND account.reserved_free_bytes = p_expected_reserved_bytes
     AND account.free_media_used_bytes + p_next_reserved_bytes
           <= account.free_media_limit_bytes;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 1 THEN
    RETURN false;
  END IF;

  UPDATE public.entry_commits
     SET quota_reserved_at = now(),
         updated_at = now()
   WHERE id = p_entry_commit_id
     AND account_id = p_account_id;

  RETURN true;
END;
$$;

CREATE FUNCTION public.release_media_reservation(
  p_account_id bigint,
  p_entry_commit_id varchar,
  p_require_expired boolean
)
RETURNS TABLE (
  entry_commit_id varchar,
  status varchar,
  released_free_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commit_row public.entry_commits%ROWTYPE;
  bytes_to_release bigint := 0;
BEGIN
  SELECT *
    INTO commit_row
    FROM public.entry_commits AS entry_commit
   WHERE entry_commit.id = p_entry_commit_id
     AND entry_commit.account_id = p_account_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'media entry commit not found';
  END IF;

  IF commit_row.status = 'released' THEN
    RETURN QUERY SELECT commit_row.id, 'released'::varchar, 0::bigint;
    RETURN;
  END IF;

  IF commit_row.status NOT IN ('allocating', 'reserved') THEN
    RAISE EXCEPTION 'media entry commit cannot be released';
  END IF;

  IF p_require_expired
     AND (commit_row.expires_at IS NULL OR commit_row.expires_at > now()) THEN
    RAISE EXCEPTION 'media entry commit has not expired';
  END IF;

  PERFORM 1
    FROM public.media_upload_reservations AS reservation
   WHERE reservation.entry_commit_id = p_entry_commit_id
     AND reservation.account_id = p_account_id
   FOR UPDATE;

  IF EXISTS (
    SELECT 1
      FROM public.media_upload_reservations AS reservation
     WHERE reservation.entry_commit_id = p_entry_commit_id
       AND reservation.account_id = p_account_id
       AND reservation.status IN ('uploaded', 'verified')
  ) THEN
    RAISE EXCEPTION 'verified media cannot be released';
  END IF;

  IF commit_row.status = 'allocating' THEN
    IF commit_row.quota_reserved_at IS NOT NULL THEN
      bytes_to_release := commit_row.reserved_free_bytes;
    END IF;
  ELSE
    SELECT COALESCE(SUM(reservation.reserved_free_bytes), 0)
      INTO bytes_to_release
      FROM public.media_upload_reservations AS reservation
     WHERE reservation.entry_commit_id = p_entry_commit_id
       AND reservation.account_id = p_account_id
       AND reservation.status IN ('reserved', 'ticketed');
  END IF;

  IF bytes_to_release > 0 THEN
    PERFORM 1
      FROM public.credit_accounts AS account
     WHERE account.account_id = p_account_id
       AND account.reserved_free_bytes >= bytes_to_release
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'media reservation ledger mismatch';
    END IF;

    UPDATE public.credit_accounts
       SET reserved_free_bytes = reserved_free_bytes - bytes_to_release,
           updated_at = now()
     WHERE account_id = p_account_id;
  END IF;

  UPDATE public.media_upload_reservations AS reservation
     SET status = 'released',
         updated_at = now()
   WHERE reservation.entry_commit_id = p_entry_commit_id
     AND reservation.account_id = p_account_id
     AND reservation.status IN ('reserved', 'ticketed');

  UPDATE public.entry_commits
     SET status = 'released',
         quota_reserved_at = NULL,
         updated_at = now()
   WHERE id = p_entry_commit_id
     AND account_id = p_account_id;

  RETURN QUERY SELECT
    commit_row.id,
    'released'::varchar,
    bytes_to_release;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_media_capacity(
  bigint,
  varchar,
  bigint,
  bigint
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_media_capacity(
  bigint,
  varchar,
  bigint,
  bigint
) TO service_role;

REVOKE ALL ON FUNCTION public.release_media_reservation(
  bigint,
  varchar,
  boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.release_media_reservation(
  bigint,
  varchar,
  boolean
) TO service_role;
