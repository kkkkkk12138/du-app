REVOKE ALL ON public.account_key_envelopes FROM anon, authenticated;
REVOKE ALL ON public.account_devices FROM anon, authenticated;
REVOKE ALL ON public.sync_records FROM anon, authenticated;
REVOKE ALL ON public.sync_cursors FROM anon, authenticated;
REVOKE ALL ON public.media_objects FROM anon, authenticated;
REVOKE ALL ON public.credit_accounts FROM anon, authenticated;
REVOKE ALL ON public.credit_ledger FROM anon, authenticated;
REVOKE ALL ON public.store_transactions FROM anon, authenticated;
REVOKE ALL ON public.entry_commits FROM anon, authenticated;
REVOKE ALL ON public.media_upload_reservations FROM anon, authenticated;

REVOKE ALL ON SEQUENCE public.sync_records_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.credit_ledger_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.store_transactions_id_seq FROM anon, authenticated;

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

GRANT USAGE, SELECT ON SEQUENCE public.sync_records_id_seq TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
