type FakeRecord = {
  id: string;
  update(change: (record: FakeRecord) => void): Promise<void>;
  [key: string]: unknown;
};

jest.mock('../src/db/database', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

import {createUploadOutboxRepository} from '../src/features/billing/uploadOutboxRepository';
import {retryDelayMs} from '../src/features/billing/uploadRetryPolicy';

class FakeCollection {
  constructor(
    private readonly table: string,
    private readonly records: FakeRecord[],
  ) {}

  query() {
    return {
      fetch: async () => [...this.records],
    };
  }

  async find(id: string) {
    const record = this.records.find(item => item.id === id);
    if (!record) {
      throw new Error(`${this.table} record not found`);
    }
    return record;
  }

  async create(initialize: (record: FakeRecord) => void) {
    const record: FakeRecord = {
      id: `${this.table}-${this.records.length + 1}`,
      update: async change => change(record),
    };
    initialize(record);
    this.records.push(record);
    return record;
  }
}

class FakeDatabase {
  readonly tables: Record<string, FakeRecord[]> = {
    media_upload_jobs: [],
    media_upload_items: [],
  };
  writeCount = 0;

  get(table: string) {
    return new FakeCollection(table, this.tables[table]);
  }

  async write<T>(work: () => Promise<T> | T) {
    this.writeCount += 1;
    return work();
  }
}

function createHarness(now = Date.parse('2026-09-05T08:00:00.000Z')) {
  const database = new FakeDatabase();
  const repository = createUploadOutboxRepository({
    database: database as never,
    now: () => now,
    ownerId: 'process-1',
    random: () => 0.5,
  });
  return {database, repository};
}

function createInput(
  entryCommitId: string,
  accountUid = 'account-1',
  mediaIds = ['media-1'],
) {
  return {
    entryCommitId,
    entryType: 'memory' as const,
    localEntryId: `memory-${entryCommitId}`,
    accountUid,
    state: 'pending_encrypt' as const,
    items: mediaIds.map(mediaId => ({
      mediaId,
      mediaKind: 'photo' as const,
      sourcePath: `/private/${mediaId}.jpg`,
      plaintextBytes: 128,
    })),
  };
}

test('creates one job per entryCommitId', async () => {
  const {database, repository} = createHarness();

  const first = await repository.createJob(
    createInput('entry-1', 'account-1', ['media-1', 'media-2']),
  );
  const second = await repository.createJob(
    createInput('entry-1', 'account-1', ['media-1', 'media-2']),
  );

  expect(second.job).toBe(first.job);
  expect(second.created).toBe(false);
  expect(database.tables.media_upload_jobs).toHaveLength(1);
  expect(database.tables.media_upload_items).toHaveLength(2);
});

test('claims only due jobs for the active UID', async () => {
  const now = Date.parse('2026-09-05T08:00:00.000Z');
  const {repository} = createHarness(now);
  const due = await repository.createJob(
    createInput('due', 'account-1'),
  );
  const future = await repository.createJob(
    createInput('future', 'account-1'),
  );
  const otherAccount = await repository.createJob(
    createInput('other', 'account-2'),
  );
  future.job.nextAttemptAt = new Date(now + 60_000);

  await expect(repository.claimNextDueJob('account-1')).resolves.toBe(
    due.job,
  );
  expect(due.job.leaseOwner).toBe('process-1');
  expect(otherAccount.job.leaseOwner).toBeUndefined();
});

test('does not claim a live lease', async () => {
  const now = Date.parse('2026-09-05T08:00:00.000Z');
  const {repository} = createHarness(now);
  const created = await repository.createJob(createInput('entry-1'));
  created.job.leaseOwner = 'another-process';
  created.job.leaseExpiresAt = new Date(now + 1);

  await expect(repository.claimNextDueJob('account-1')).resolves.toBeNull();
});

test('reclaims an expired lease', async () => {
  const now = Date.parse('2026-09-05T08:00:00.000Z');
  const {repository} = createHarness(now);
  const created = await repository.createJob(createInput('entry-1'));
  created.job.leaseOwner = 'stopped-process';
  created.job.leaseExpiresAt = new Date(now - 1);

  await expect(repository.claimNextDueJob('account-1')).resolves.toBe(
    created.job,
  );
  expect(created.job.leaseOwner).toBe('process-1');
  expect(created.job.leaseExpiresAt).toEqual(
    new Date(now + 5 * 60_000),
  );
});

test('rejects an illegal state transition', async () => {
  const {repository} = createHarness();
  const created = await repository.createJob(createInput('entry-1'));

  await expect(
    repository.transitionJob(created.job.id, 'confirmed'),
  ).rejects.toThrow('非法上传任务状态转换');
  expect(created.job.state).toBe('pending_encrypt');
});

test('checkpoints encrypted metadata atomically', async () => {
  const {database, repository} = createHarness();
  const created = await repository.createJob(createInput('entry-1'));
  const writesBeforeCheckpoint = database.writeCount;

  await repository.checkpointEncryptedItem(
    created.job.id,
    'media-1',
    {
      encryptedPath: '/private/media-1.enc',
      encryptedBytes: 256,
      sha256: 'a'.repeat(64),
    },
  );

  expect(database.writeCount).toBe(writesBeforeCheckpoint + 1);
  expect(created.items[0]).toMatchObject({
    encryptedPath: '/private/media-1.enc',
    encryptedBytes: 256,
    sha256: 'a'.repeat(64),
    state: 'encrypted',
  });
  expect(created.job.state).toBe('ready');
});

test('persists reservation IDs before PUT', async () => {
  const now = Date.parse('2026-09-05T08:00:00.000Z');
  const {repository} = createHarness(now);
  const created = await repository.createJob(createInput('entry-1'));
  await repository.checkpointEncryptedItem(
    created.job.id,
    'media-1',
    {
      encryptedPath: '/private/media-1.enc',
      encryptedBytes: 256,
      sha256: 'a'.repeat(64),
    },
  );

  await repository.persistReservations(created.job.id, {
    expiresAt: new Date(now + 15 * 60_000),
    items: [{mediaId: 'media-1', reservationId: 'reservation-1'}],
  });

  expect(created.items[0].reservationId).toBe('reservation-1');
  expect(created.job).toMatchObject({
    state: 'uploading',
    reservationExpiresAt: new Date(now + 15 * 60_000),
  });
});

test('does not checkpoint PUT before a reservation is durable', async () => {
  const {repository} = createHarness();
  const created = await repository.createJob(createInput('entry-1'));
  await repository.checkpointEncryptedItem(
    created.job.id,
    'media-1',
    {
      encryptedPath: '/private/media-1.enc',
      encryptedBytes: 256,
      sha256: 'a'.repeat(64),
    },
  );

  await expect(
    repository.markPutCompleted(
      created.job.id,
      'media-1',
      'objects/media-1.enc',
    ),
  ).rejects.toThrow('上传预留尚未持久化');
  expect(created.items[0].state).toBe('encrypted');
});

test('keeps reservation after uncertain confirmation', async () => {
  const now = Date.parse('2026-09-05T08:00:00.000Z');
  const {repository} = createHarness(now);
  const created = await repository.createJob(createInput('entry-1'));
  await repository.checkpointEncryptedItem(
    created.job.id,
    'media-1',
    {
      encryptedPath: '/private/media-1.enc',
      encryptedBytes: 256,
      sha256: 'a'.repeat(64),
    },
  );
  await repository.persistReservations(created.job.id, {
    expiresAt: new Date(now + 15 * 60_000),
    items: [{mediaId: 'media-1', reservationId: 'reservation-1'}],
  });
  await repository.markPutCompleted(
    created.job.id,
    'media-1',
    'objects/media-1.enc',
  );

  await repository.scheduleRetry(
    created.job.id,
    'CONFIRM_RESULT_UNKNOWN',
  );

  expect(created.job).toMatchObject({
    state: 'retry_wait',
    attemptCount: 1,
    nextAttemptAt: new Date(now + 5_000),
    lastErrorCode: 'CONFIRM_RESULT_UNKNOWN',
  });
  expect(created.items[0]).toMatchObject({
    reservationId: 'reservation-1',
    objectKey: 'objects/media-1.enc',
    state: 'put_completed',
  });
});

test('rejects raw error messages instead of persisting them', async () => {
  const {repository} = createHarness();
  const created = await repository.createJob(createInput('entry-1'));

  await expect(
    repository.scheduleRetry(
      created.job.id,
      'network timeout: token=secret',
    ),
  ).rejects.toThrow('上传错误码无效');
  expect(created.job.lastErrorCode).toBeUndefined();
});

test('marks all verified items before finalizing', async () => {
  const now = Date.parse('2026-09-05T08:00:00.000Z');
  const {repository} = createHarness(now);
  const created = await repository.createJob(
    createInput('entry-1', 'account-1', ['media-1', 'media-2']),
  );

  for (const [index, mediaId] of ['media-1', 'media-2'].entries()) {
    await repository.checkpointEncryptedItem(created.job.id, mediaId, {
      encryptedPath: `/private/${mediaId}.enc`,
      encryptedBytes: 256 + index,
      sha256: String(index + 1).repeat(64),
    });
  }
  await repository.persistReservations(created.job.id, {
    expiresAt: new Date(now + 15 * 60_000),
    items: [
      {mediaId: 'media-1', reservationId: 'reservation-1'},
      {mediaId: 'media-2', reservationId: 'reservation-2'},
    ],
  });
  await repository.markPutCompleted(
    created.job.id,
    'media-1',
    'objects/media-1.enc',
  );
  await repository.markPutCompleted(
    created.job.id,
    'media-2',
    'objects/media-2.enc',
  );

  await expect(
    repository.transitionJob(created.job.id, 'finalizing'),
  ).rejects.toThrow('上传任务检查点不完整');
  await repository.markVerified(created.job.id, 'media-1');
  expect(created.job.state).toBe('confirming');
  await repository.markVerified(created.job.id, 'media-2');

  expect(created.items.map(item => item.state)).toEqual([
    'verified',
    'verified',
  ]);
  expect(created.job.state).toBe('finalizing');
});

test('uses bounded retry delays before a six-hour steady state', () => {
  expect(
    [1, 2, 3, 4, 5, 6].map(attempt => retryDelayMs(attempt, () => 0.5)),
  ).toEqual([5_000, 30_000, 120_000, 600_000, 3_600_000, 21_600_000]);
});
