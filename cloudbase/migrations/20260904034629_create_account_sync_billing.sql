CREATE TABLE public.account_key_envelopes (
  account_id bigint PRIMARY KEY DEFAULT auth.uid()::bigint
    REFERENCES auth.users(id) ON DELETE CASCADE,
  encryption_version integer NOT NULL DEFAULT 1 CHECK (encryption_version > 0),
  password_salt text NOT NULL,
  password_kdf jsonb NOT NULL,
  password_wrapped_key text NOT NULL,
  recovery_salt text NOT NULL,
  recovery_kdf jsonb NOT NULL,
  recovery_wrapped_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.account_devices (
  id varchar(128) PRIMARY KEY,
  account_id bigint NOT NULL DEFAULT auth.uid()::bigint
    REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  encrypted_device_name text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, id)
);

CREATE TABLE public.sync_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL DEFAULT auth.uid()::bigint
    REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type varchar(64) NOT NULL,
  entity_id varchar(128) NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  encrypted_payload text,
  nonce text,
  aad text,
  payload_sha256 char(64),
  encryption_version integer NOT NULL DEFAULT 1 CHECK (encryption_version > 0),
  is_deleted boolean NOT NULL DEFAULT false,
  client_updated_at timestamptz NOT NULL,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (is_deleted AND encrypted_payload IS NULL) OR
    (NOT is_deleted AND encrypted_payload IS NOT NULL AND nonce IS NOT NULL)
  ),
  UNIQUE (account_id, entity_type, entity_id)
);

CREATE INDEX sync_records_changes_idx
  ON public.sync_records (account_id, server_updated_at, id);

CREATE TABLE public.sync_cursors (
  account_id bigint NOT NULL DEFAULT auth.uid()::bigint
    REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id varchar(128) NOT NULL,
  last_server_updated_at timestamptz,
  last_record_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, device_id)
);

CREATE TABLE public.media_objects (
  id varchar(128) PRIMARY KEY,
  account_id bigint NOT NULL DEFAULT auth.uid()::bigint
    REFERENCES auth.users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  sha256 char(64) NOT NULL,
  encrypted_bytes bigint NOT NULL CHECK (encrypted_bytes > 0),
  media_kind varchar(16) NOT NULL
    CHECK (media_kind IN ('photo', 'audio', 'ink', 'avatar', 'cover')),
  encryption_version integer NOT NULL DEFAULT 1 CHECK (encryption_version > 0),
  upload_status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploaded', 'verified', 'deleted')),
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, sha256)
);

CREATE TABLE public.credit_accounts (
  account_id bigint PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  free_media_limit_bytes bigint NOT NULL DEFAULT 524288000
    CHECK (free_media_limit_bytes >= 0),
  free_media_used_bytes bigint NOT NULL DEFAULT 0
    CHECK (free_media_used_bytes >= 0),
  available_credits integer NOT NULL DEFAULT 0
    CHECK (available_credits >= 0),
  reserved_credits integer NOT NULL DEFAULT 0
    CHECK (reserved_credits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (free_media_used_bytes <= free_media_limit_bytes)
);

CREATE TABLE public.credit_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  operation varchar(24) NOT NULL
    CHECK (operation IN ('grant', 'reserve', 'consume', 'release', 'refund')),
  credit_delta integer NOT NULL,
  free_byte_delta bigint NOT NULL DEFAULT 0,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reference_type varchar(32) NOT NULL,
  reference_id varchar(128) NOT NULL,
  idempotency_key varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX credit_ledger_account_created_idx
  ON public.credit_ledger (account_id, created_at DESC, id DESC);

CREATE TABLE public.store_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL,
  product_id varchar(128) NOT NULL,
  transaction_id varchar(256) NOT NULL,
  status varchar(24) NOT NULL
    CHECK (status IN ('received', 'verified', 'rejected', 'refunded')),
  granted_credits integer NOT NULL DEFAULT 0 CHECK (granted_credits >= 0),
  purchased_at timestamptz,
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, transaction_id)
);

CREATE TABLE public.entry_commits (
  id varchar(128) PRIMARY KEY,
  account_id bigint NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type varchar(24) NOT NULL
    CHECK (entry_type IN ('memory', 'future_letter')),
  local_entry_id varchar(128) NOT NULL,
  status varchar(24) NOT NULL
    CHECK (status IN ('reserved', 'uploading', 'committed', 'failed', 'released')),
  required_credits integer NOT NULL DEFAULT 0 CHECK (required_credits >= 0),
  reserved_free_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_free_bytes >= 0),
  idempotency_key varchar(160) NOT NULL,
  expires_at timestamptz,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE TABLE public.media_upload_reservations (
  id varchar(128) PRIMARY KEY,
  account_id bigint NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_commit_id varchar(128) NOT NULL
    REFERENCES public.entry_commits(id) ON DELETE CASCADE,
  media_id varchar(128) NOT NULL,
  media_kind varchar(16) NOT NULL
    CHECK (media_kind IN ('photo', 'audio', 'ink', 'avatar', 'cover')),
  bytes bigint NOT NULL CHECK (bytes > 0 AND bytes <= 104857600),
  sha256 char(64) NOT NULL,
  required_credits integer NOT NULL DEFAULT 0 CHECK (required_credits >= 0),
  reserved_free_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_free_bytes >= 0),
  status varchar(24) NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'ticketed', 'uploaded', 'verified', 'released', 'expired')),
  object_key text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, entry_commit_id, media_id)
);

CREATE INDEX media_upload_reservations_expiry_idx
  ON public.media_upload_reservations (status, expires_at);

ALTER TABLE public.account_key_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_upload_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_key_envelopes_own
  ON public.account_key_envelopes
  FOR ALL TO authenticated
  USING (account_id = auth.uid()::bigint)
  WITH CHECK (account_id = auth.uid()::bigint);

CREATE POLICY account_devices_own
  ON public.account_devices
  FOR ALL TO authenticated
  USING (account_id = auth.uid()::bigint)
  WITH CHECK (account_id = auth.uid()::bigint);

CREATE POLICY sync_records_own
  ON public.sync_records
  FOR ALL TO authenticated
  USING (account_id = auth.uid()::bigint)
  WITH CHECK (account_id = auth.uid()::bigint);

CREATE POLICY sync_cursors_own
  ON public.sync_cursors
  FOR ALL TO authenticated
  USING (account_id = auth.uid()::bigint)
  WITH CHECK (account_id = auth.uid()::bigint);

CREATE POLICY media_objects_read_own
  ON public.media_objects
  FOR SELECT TO authenticated
  USING (account_id = auth.uid()::bigint);

CREATE POLICY credit_accounts_read_own
  ON public.credit_accounts
  FOR SELECT TO authenticated
  USING (account_id = auth.uid()::bigint);

CREATE POLICY credit_ledger_read_own
  ON public.credit_ledger
  FOR SELECT TO authenticated
  USING (account_id = auth.uid()::bigint);

CREATE POLICY store_transactions_read_own
  ON public.store_transactions
  FOR SELECT TO authenticated
  USING (account_id = auth.uid()::bigint);

CREATE POLICY entry_commits_read_own
  ON public.entry_commits
  FOR SELECT TO authenticated
  USING (account_id = auth.uid()::bigint);

CREATE POLICY media_upload_reservations_read_own
  ON public.media_upload_reservations
  FOR SELECT TO authenticated
  USING (account_id = auth.uid()::bigint);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.account_key_envelopes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.account_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.sync_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.sync_cursors TO authenticated;
GRANT SELECT ON public.media_objects TO authenticated;
GRANT SELECT ON public.credit_accounts TO authenticated;
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT SELECT ON public.store_transactions TO authenticated;
GRANT SELECT ON public.entry_commits TO authenticated;
GRANT SELECT ON public.media_upload_reservations TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
