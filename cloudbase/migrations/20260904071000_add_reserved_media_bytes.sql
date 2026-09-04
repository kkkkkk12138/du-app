ALTER TABLE public.credit_accounts
  ADD COLUMN reserved_free_bytes bigint NOT NULL DEFAULT 0
    CHECK (reserved_free_bytes >= 0),
  ADD CONSTRAINT credit_accounts_capacity_check
    CHECK (
      free_media_used_bytes + reserved_free_bytes <= free_media_limit_bytes
    );

ALTER TABLE public.entry_commits
  DROP CONSTRAINT entry_commits_status_check,
  ADD CONSTRAINT entry_commits_status_check
    CHECK (
      status IN (
        'allocating',
        'reserved',
        'uploading',
        'committed',
        'failed',
        'released'
      )
    );
