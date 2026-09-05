CREATE TABLE public.account_encryption_identities (
  account_id bigint PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  key_version integer NOT NULL DEFAULT 1
    CHECK (key_version = 1),
  key_verifier char(64) NOT NULL
    CHECK (key_verifier ~ '^[a-f0-9]{64}$'),
  initialized_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_encryption_identities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_encryption_identities FROM PUBLIC;
REVOKE ALL ON public.account_encryption_identities FROM anon, authenticated;

CREATE FUNCTION public.claim_account_encryption_identity(
  p_account_id bigint,
  p_key_verifier varchar
)
RETURNS TABLE (
  status varchar,
  key_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  identity_row public.account_encryption_identities%ROWTYPE;
BEGIN
  IF p_key_verifier IS NULL
     OR p_key_verifier !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid account key verifier';
  END IF;

  PERFORM 1
    FROM auth.users AS account
   WHERE account.id = p_account_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account not found';
  END IF;

  SELECT *
    INTO identity_row
    FROM public.account_encryption_identities AS identity
   WHERE identity.account_id = p_account_id
   FOR UPDATE;

  IF FOUND THEN
    IF identity_row.key_verifier = p_key_verifier THEN
      RETURN QUERY SELECT 'existing'::varchar, identity_row.key_version;
    ELSE
      RETURN QUERY SELECT 'recovery_required'::varchar,
        identity_row.key_version;
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.account_key_envelopes AS envelope
     WHERE envelope.account_id = p_account_id
  ) OR EXISTS (
    SELECT 1
      FROM public.sync_records AS record
     WHERE record.account_id = p_account_id
  ) OR EXISTS (
    SELECT 1
      FROM public.media_objects AS media
     WHERE media.account_id = p_account_id
  ) THEN
    RETURN QUERY SELECT 'recovery_required'::varchar, 1;
    RETURN;
  END IF;

  INSERT INTO public.account_encryption_identities (
    account_id,
    key_version,
    key_verifier
  ) VALUES (
    p_account_id,
    1,
    p_key_verifier
  );

  RETURN QUERY SELECT 'claimed'::varchar, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_account_encryption_identity(
  bigint,
  varchar
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_account_encryption_identity(
  bigint,
  varchar
) TO service_role;
