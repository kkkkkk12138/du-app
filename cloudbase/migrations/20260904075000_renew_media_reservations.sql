CREATE FUNCTION public.renew_media_upload_reservations(
  p_account_id bigint,
  p_entry_commit_id varchar,
  p_expires_at timestamptz
)
RETURNS TABLE (
  reservation_id varchar,
  status varchar,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commit_row public.entry_commits%ROWTYPE;
  renewal_expires_at timestamptz;
BEGIN
  SELECT *
    INTO commit_row
    FROM public.entry_commits AS entry_commit
   WHERE entry_commit.id = p_entry_commit_id
     AND entry_commit.account_id = p_account_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDIA_RESERVATION_NOT_FOUND';
  END IF;

  IF commit_row.status = 'released' THEN
    RAISE EXCEPTION 'MEDIA_RESERVATION_RELEASED';
  END IF;

  IF commit_row.status NOT IN ('reserved', 'uploading') THEN
    RAISE EXCEPTION 'MEDIA_RESERVATION_NOT_FOUND';
  END IF;

  PERFORM reservation.id
    FROM public.media_upload_reservations AS reservation
   WHERE reservation.entry_commit_id = p_entry_commit_id
     AND reservation.account_id = p_account_id
   ORDER BY reservation.id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDIA_RESERVATION_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.media_upload_reservations AS reservation
     WHERE reservation.entry_commit_id = p_entry_commit_id
       AND reservation.account_id = p_account_id
       AND reservation.status = 'released'
  ) THEN
    RAISE EXCEPTION 'MEDIA_RESERVATION_RELEASED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.media_upload_reservations AS reservation
     WHERE reservation.entry_commit_id = p_entry_commit_id
       AND reservation.account_id = p_account_id
       AND reservation.status = 'expired'
  ) THEN
    RAISE EXCEPTION 'MEDIA_RESERVATION_EXPIRED';
  END IF;

  renewal_expires_at := CASE
    WHEN commit_row.expires_at > now() THEN commit_row.expires_at
    ELSE p_expires_at
  END;

  UPDATE public.media_upload_reservations AS reservation
     SET expires_at = renewal_expires_at,
         updated_at = now()
   WHERE reservation.entry_commit_id = p_entry_commit_id
     AND reservation.account_id = p_account_id
     AND reservation.status IN ('reserved', 'ticketed');

  UPDATE public.entry_commits
     SET expires_at = renewal_expires_at,
         updated_at = now()
   WHERE id = p_entry_commit_id
     AND account_id = p_account_id;

  RETURN QUERY
  SELECT
    reservation.id,
    reservation.status,
    reservation.expires_at
  FROM public.media_upload_reservations AS reservation
  WHERE reservation.entry_commit_id = p_entry_commit_id
    AND reservation.account_id = p_account_id
  ORDER BY reservation.id;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_media_upload_reservations(
  bigint,
  varchar,
  timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.renew_media_upload_reservations(
  bigint,
  varchar,
  timestamptz
) TO service_role;
