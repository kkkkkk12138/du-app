CREATE FUNCTION public.confirm_media_upload(
  p_account_id bigint,
  p_reservation_id varchar,
  p_object_key text
)
RETURNS TABLE (
  media_object_id varchar,
  object_key text,
  sha256 char(64),
  encrypted_bytes bigint,
  media_kind varchar,
  upload_status varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation_row public.media_upload_reservations%ROWTYPE;
  media_row public.media_objects%ROWTYPE;
BEGIN
  SELECT *
    INTO reservation_row
    FROM public.media_upload_reservations AS reservation
   WHERE reservation.id = p_reservation_id
     AND reservation.account_id = p_account_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'media reservation not found';
  END IF;

  IF reservation_row.status = 'verified' THEN
    SELECT *
      INTO media_row
      FROM public.media_objects AS media
     WHERE media.account_id = p_account_id
       AND media.sha256 = reservation_row.sha256
       AND media.upload_status = 'verified'
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'verified media object not found';
    END IF;

    RETURN QUERY SELECT
      media_row.id,
      media_row.object_key,
      media_row.sha256,
      media_row.encrypted_bytes,
      media_row.media_kind,
      media_row.upload_status;
    RETURN;
  END IF;

  IF reservation_row.status <> 'ticketed'
     OR reservation_row.object_key <> p_object_key THEN
    RAISE EXCEPTION 'media reservation cannot be confirmed';
  END IF;

  PERFORM 1
    FROM public.credit_accounts AS account
   WHERE account.account_id = p_account_id
     AND account.reserved_free_bytes >= reservation_row.reserved_free_bytes
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'media reservation ledger mismatch';
  END IF;

  SELECT *
    INTO media_row
    FROM public.media_objects AS media
   WHERE media.account_id = p_account_id
     AND media.sha256 = reservation_row.sha256
     AND media.upload_status = 'verified'
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.credit_accounts
       SET reserved_free_bytes = reserved_free_bytes -
             reservation_row.reserved_free_bytes,
           updated_at = now()
     WHERE account_id = p_account_id;
  ELSE
    UPDATE public.credit_accounts
       SET reserved_free_bytes = reserved_free_bytes -
             reservation_row.reserved_free_bytes,
           free_media_used_bytes = free_media_used_bytes +
             reservation_row.reserved_free_bytes,
           updated_at = now()
     WHERE account_id = p_account_id;

    INSERT INTO public.media_objects (
      id,
      account_id,
      object_key,
      sha256,
      encrypted_bytes,
      media_kind,
      upload_status,
      verified_at
    )
    VALUES (
      reservation_row.media_id,
      p_account_id,
      p_object_key,
      reservation_row.sha256,
      reservation_row.bytes,
      reservation_row.media_kind,
      'verified',
      now()
    )
    RETURNING * INTO media_row;
  END IF;

  UPDATE public.media_upload_reservations
     SET status = 'verified',
         updated_at = now()
   WHERE id = p_reservation_id
     AND account_id = p_account_id;

  RETURN QUERY SELECT
    media_row.id,
    media_row.object_key,
    media_row.sha256,
    media_row.encrypted_bytes,
    media_row.media_kind,
    media_row.upload_status;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_media_upload(
  bigint,
  varchar,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_media_upload(
  bigint,
  varchar,
  text
) TO service_role;
