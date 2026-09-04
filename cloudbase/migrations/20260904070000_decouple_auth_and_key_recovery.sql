ALTER TABLE public.account_key_envelopes
  ALTER COLUMN password_salt DROP NOT NULL,
  ALTER COLUMN password_kdf DROP NOT NULL,
  ALTER COLUMN password_wrapped_key DROP NOT NULL,
  ADD COLUMN key_transfer_policy varchar(32)
    NOT NULL DEFAULT 'device_or_recovery'
    CHECK (key_transfer_policy IN ('device_or_recovery'));
