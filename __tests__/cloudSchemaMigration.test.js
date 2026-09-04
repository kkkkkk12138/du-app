const fs = require('fs');
const path = require('path');

const migrationPath = path.join(
  __dirname,
  '..',
  'cloudbase',
  'migrations',
  '20260904034629_create_account_sync_billing.sql',
);
const migrationsDirectory = path.dirname(migrationPath);

describe('CloudBase account, sync, and billing schema', () => {
  const readMigration = () => fs.readFileSync(migrationPath, 'utf8');
  const readAllMigrations = () =>
    fs
      .readdirSync(migrationsDirectory)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file =>
        fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'),
      )
      .join('\n');

  test('creates the encrypted sync and billing tables', () => {
    const sql = readMigration();

    [
      'account_key_envelopes',
      'account_devices',
      'sync_records',
      'sync_cursors',
      'media_objects',
      'credit_accounts',
      'credit_ledger',
      'store_transactions',
      'entry_commits',
      'media_upload_reservations',
    ].forEach(table => {
      expect(sql).toContain(`CREATE TABLE public.${table}`);
    });
  });

  test('binds client-owned records to the authenticated user', () => {
    const sql = readMigration();

    expect(sql).toContain(
      'account_id bigint NOT NULL DEFAULT auth.uid()::bigint',
    );
    expect(sql).toContain('USING (account_id = auth.uid()::bigint)');
    expect(sql).toContain('WITH CHECK (account_id = auth.uid()::bigint)');
  });

  test('enables row security and limits client grants', () => {
    const sql = readAllMigrations();

    expect(sql).toContain(
      'ALTER TABLE public.sync_records ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON public\.sync_records TO authenticated/i,
    );
    expect(sql).toMatch(
      /GRANT\s+SELECT\s+ON public\.credit_accounts TO authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*credit_(?:accounts|ledger)\s+TO authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*media_upload_reservations\s+TO authenticated/i,
    );
    expect(sql).not.toMatch(/GRANT[^;]*TO anon/i);
  });

  test('revokes inherited write privileges before granting the allowlist', () => {
    const sql = readAllMigrations();

    expect(sql).toMatch(
      /REVOKE ALL ON public\.credit_accounts FROM anon, authenticated/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON public\.media_upload_reservations FROM anon, authenticated/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON public\.sync_records FROM anon, authenticated/i,
    );
    expect(sql).toMatch(
      /GRANT USAGE, SELECT ON SEQUENCE public\.sync_records_id_seq TO authenticated/i,
    );
  });
});
