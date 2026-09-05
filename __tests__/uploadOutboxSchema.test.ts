import {migrations} from '../src/db/migrations';
import {modelClasses} from '../src/db/models';
import {schema} from '../src/db/schema';
import {
  UPLOAD_ITEM_STATES,
  UPLOAD_JOB_STATES,
} from '../src/features/billing/uploadOutboxTypes';

function columnsFor(tableName: string) {
  const table = schema.tables[tableName];
  if (!table) {
    return null;
  }
  return Object.fromEntries(
    table.columnArray.map(column => [
      column.name,
      {
        type: column.type,
        optional: column.isOptional === true,
        indexed: column.isIndexed === true,
      },
    ]),
  );
}

test('defines schema 15 with durable upload job fields and indexes', () => {
  expect(schema.version).toBe(15);
  expect(columnsFor('media_upload_jobs')).toEqual({
    entry_commit_id: {type: 'string', optional: false, indexed: true},
    entry_type: {type: 'string', optional: false, indexed: false},
    local_entry_id: {type: 'string', optional: false, indexed: true},
    letter_id: {type: 'string', optional: true, indexed: false},
    account_uid: {type: 'string', optional: false, indexed: true},
    state: {type: 'string', optional: false, indexed: true},
    attempt_count: {type: 'number', optional: false, indexed: false},
    next_attempt_at: {type: 'number', optional: true, indexed: true},
    lease_owner: {type: 'string', optional: true, indexed: false},
    lease_expires_at: {type: 'number', optional: true, indexed: false},
    reservation_expires_at: {
      type: 'number',
      optional: true,
      indexed: false,
    },
    last_error_code: {type: 'string', optional: true, indexed: false},
    created_at: {type: 'number', optional: false, indexed: false},
    updated_at: {type: 'number', optional: false, indexed: false},
    confirmed_at: {type: 'number', optional: true, indexed: false},
  });
});

test('defines durable upload item fields and indexes', () => {
  expect(columnsFor('media_upload_items')).toEqual({
    job_id: {type: 'string', optional: false, indexed: true},
    media_id: {type: 'string', optional: false, indexed: false},
    media_kind: {type: 'string', optional: false, indexed: false},
    source_path: {type: 'string', optional: false, indexed: false},
    plaintext_bytes: {type: 'number', optional: false, indexed: false},
    encrypted_path: {type: 'string', optional: true, indexed: false},
    encrypted_bytes: {type: 'number', optional: true, indexed: false},
    sha256: {type: 'string', optional: true, indexed: false},
    reservation_id: {type: 'string', optional: true, indexed: false},
    object_key: {type: 'string', optional: true, indexed: false},
    state: {type: 'string', optional: false, indexed: true},
    created_at: {type: 'number', optional: false, indexed: false},
    updated_at: {type: 'number', optional: false, indexed: false},
  });
});

test('migrates version 14 records without adding upload state to memories', () => {
  const migration = migrations.sortedMigrations.find(
    item => item.toVersion === 15,
  );

  expect(migration).toBeDefined();
  expect(
    migration?.steps
      .filter(step => step.type === 'create_table')
      .map(step => step.schema.name),
  ).toEqual(['media_upload_jobs', 'media_upload_items']);
  expect(
    migration?.steps.find(
      step => step.type === 'add_columns' && step.table === 'letters',
    ),
  ).toMatchObject({
    columns: [
      {name: 'notification_status', type: 'string', isOptional: true},
      {name: 'notification_id', type: 'string', isOptional: true},
    ],
  });
  expect(schema.tables.memories.columns).not.toHaveProperty(
    'upload_state',
  );
});

test('adds optional notification fields to letters', () => {
  expect(schema.tables.letters.columns.notification_status).toEqual({
    name: 'notification_status',
    type: 'string',
    isOptional: true,
  });
  expect(schema.tables.letters.columns.notification_id).toEqual({
    name: 'notification_id',
    type: 'string',
    isOptional: true,
  });
});

test('exports canonical outbox states and registers both models', () => {
  expect(UPLOAD_JOB_STATES).toEqual([
    'blocked_key',
    'pending_encrypt',
    'ready',
    'uploading',
    'confirming',
    'finalizing',
    'retry_wait',
    'confirmed',
    'cancelled',
    'failed_permanent',
  ]);
  expect(UPLOAD_ITEM_STATES).toEqual([
    'pending_encrypt',
    'encrypted',
    'put_completed',
    'verified',
  ]);
  expect(modelClasses.map(model => model.table)).toEqual(
    expect.arrayContaining(['media_upload_jobs', 'media_upload_items']),
  );
});
