type FakeRecord = {
  readonly id: string;
  _raw: {id: string};
  update(change: (record: FakeRecord) => void): Promise<void>;
  [key: string]: unknown;
};

const mockTables: Record<string, FakeRecord[]> = {
  memories: [],
  letters: [],
  media_upload_jobs: [],
  media_upload_items: [],
};
let mockFailNextWrite = false;
let mockInWrite = false;

function mockCollection(table: string) {
  return {
    query: jest.fn(() => ({
      fetch: jest.fn(async () => [...mockTables[table]]),
    })),
    find: jest.fn(async (id: string) => {
      const record = mockTables[table].find(item => item.id === id);
      if (!record) {
        throw new Error(`${table} record not found`);
      }
      return record;
    }),
    create: jest.fn(async (initialize: (record: FakeRecord) => void) => {
      const raw = {id: `${table}-${mockTables[table].length + 1}`};
      const record = {
        get id() {
          return raw.id;
        },
        _raw: raw,
        update: async (change: (item: FakeRecord) => void) =>
          change(record),
      } as FakeRecord;
      initialize(record);
      mockTables[table].push(record);
      return record;
    }),
  };
}

jest.mock('../src/db/database', () => ({
  database: {
    get: jest.fn((table: string) => mockCollection(table)),
    write: jest.fn(async (work: () => unknown) => {
      if (mockFailNextWrite) {
        mockFailNextWrite = false;
        throw new Error('database failed');
      }
      mockInWrite = true;
      try {
        return await work();
      } finally {
        mockInWrite = false;
      }
    }),
  },
}));

const mockPrepareMediaForPersistence = jest.fn(
  async (path: string | undefined) => {
    if (!path) {
      return {};
    }
    const durablePath = path.replace('/draft/', '/durable/');
    return {
      path: durablePath,
      draftPath: path,
      createdPath: durablePath,
    };
  },
);
const mockFinalizePreparedMedia = jest.fn().mockResolvedValue(undefined);
const mockRollbackPreparedMedia = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/services/mediaStorage', () => ({
  prepareMediaForPersistence: (path: string | undefined) =>
    mockPrepareMediaForPersistence(path),
  finalizePreparedMedia: (files: unknown[]) =>
    mockFinalizePreparedMedia(files),
  rollbackPreparedMedia: (files: unknown[]) =>
    mockRollbackPreparedMedia(files),
}));

jest.mock('../src/db/placeRepository', () => ({
  resolvePlaceId: jest.fn().mockResolvedValue(undefined),
  getPlaceCity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/placeRecognition', () => ({
  recognizeCity: jest.fn().mockReturnValue(undefined),
}));

import type {AccountState} from '../src/features/account/useAccountStore';
import type {CheckoutMediaItem} from '../src/features/billing/mediaCheckout';
import {createFinalSaveService} from '../src/features/write/finalSaveService';

const signedOut: Extract<AccountState, {status: 'signed_out'}> = {
  status: 'signed_out',
};
const locked: Extract<AccountState, {status: 'signed_in_locked'}> = {
  status: 'signed_in_locked',
  session: {uid: 'account-1', providers: ['email']},
};
const unlocked: Extract<
  AccountState,
  {status: 'signed_in_unlocked'}
> = {
  status: 'signed_in_unlocked',
  session: {uid: 'account-1', providers: ['email']},
};

function createHarness() {
  const triggerUpload = jest.fn(() => {
    expect(mockInWrite).toBe(false);
  });
  const collectMediaItems = jest.fn(async (input: {
    imagePath?: string;
    audioPath?: string;
    inkImagePath?: string;
  }) => {
    const items: CheckoutMediaItem[] = [];
    if (input.imagePath) {
      items.push({id: 'photo', kind: 'photo', bytes: 120});
    }
    if (input.audioPath) {
      items.push({id: 'audio', kind: 'audio', bytes: 240});
    }
    if (input.inkImagePath) {
      items.push({id: 'ink', kind: 'ink', bytes: 80});
    }
    return items;
  });
  let sequence = 0;
  const service = createFinalSaveService({
    collectMediaItems,
    createId: (prefix: string) => `${prefix}-${++sequence}`,
    triggerUpload,
  });
  return {collectMediaItems, service, triggerUpload};
}

function memoryInput() {
  return {
    content: '今天的风很轻。',
    type: 'photo',
    imagePath: '/draft/photo.jpg',
    customTags: [],
  };
}

beforeEach(() => {
  Object.values(mockTables).forEach(records => records.splice(0));
  mockFailNextWrite = false;
  mockInWrite = false;
  jest.clearAllMocks();
});

test('signed_out with media saves locally without an upload job', async () => {
  const {service, triggerUpload} = createHarness();

  const result = await service.saveMemory({
    input: memoryInput(),
    account: signedOut,
  });

  expect(result.completion).toBe('saved_local');
  expect(result.uploadJobId).toBeUndefined();
  expect(mockTables.memories).toHaveLength(1);
  expect(mockTables.media_upload_jobs).toHaveLength(0);
  expect(triggerUpload).not.toHaveBeenCalled();
});

test('signed_in_locked creates a blocked upload job', async () => {
  const {service, triggerUpload} = createHarness();
  const {database} = require('../src/db/database');

  const result = await service.saveMemory({
    input: memoryInput(),
    account: locked,
  });

  expect(result.completion).toBe('saved_pending_upload');
  expect(mockTables.media_upload_jobs[0]).toMatchObject({
    accountUid: 'account-1',
    state: 'blocked_key',
    localEntryId: result.memory.id,
  });
  expect(mockTables.media_upload_items[0]).toMatchObject({
    sourcePath: '/durable/photo.jpg',
    plaintextBytes: 120,
  });
  expect(database.write).toHaveBeenCalledTimes(1);
  expect(triggerUpload).toHaveBeenCalledWith(result.uploadJobId);
});

test('signed_in_unlocked creates a pending encryption job', async () => {
  const {service} = createHarness();

  await service.saveMemory({
    input: memoryInput(),
    account: unlocked,
  });

  expect(mockTables.media_upload_jobs[0].state).toBe('pending_encrypt');
});

test('any account without media creates no upload job', async () => {
  const {collectMediaItems, service} = createHarness();

  const result = await service.saveMemory({
    input: {...memoryInput(), type: 'text', imagePath: undefined},
    account: unlocked,
  });

  expect(result.completion).toBe('saved_local');
  expect(mockTables.media_upload_jobs).toHaveLength(0);
  expect(collectMediaItems).not.toHaveBeenCalled();
});

test('future letter with media waits in pending_upload', async () => {
  const {service} = createHarness();

  const result = await service.saveFutureLetter({
    draft: {
      content: '写给明年的我。',
      type: 'photo',
      customTags: [],
      imagePath: '/draft/photo.jpg',
    },
    arriveDate: new Date('2027-09-05T08:00:00.000Z'),
    arriveType: 'one_year',
    account: unlocked,
  });

  expect(result.completion).toBe('saved_pending_upload');
  expect(result.letter.status).toBe('pending_upload');
  expect(mockTables.media_upload_jobs[0].letterId).toBe(
    result.letter.id,
  );
});

test('future letter without an upload job waits for finalization', async () => {
  const {service} = createHarness();

  const result = await service.saveFutureLetter({
    draft: {
      content: '只写文字。',
      type: 'text',
      customTags: [],
    },
    arriveDate: new Date('2027-09-05T08:00:00.000Z'),
    arriveType: 'one_year',
    account: signedOut,
  });

  expect(result.completion).toBe('saved_pending_finalize');
  expect(result.letter).toMatchObject({
    status: 'pending_notification',
    notificationStatus: 'pending',
  });
});

test('database failure rolls back prepared durable copies', async () => {
  const {service} = createHarness();
  mockFailNextWrite = true;

  await expect(
    service.saveMemory({
      input: memoryInput(),
      account: unlocked,
    }),
  ).rejects.toThrow('database failed');

  expect(mockRollbackPreparedMedia).toHaveBeenCalledWith([
    expect.objectContaining({createdPath: '/durable/photo.jpg'}),
    {},
    {},
  ]);
  expect(mockFinalizePreparedMedia).not.toHaveBeenCalled();
});

test('rejects unstable service IDs before opening a transaction', async () => {
  const {service} = createHarness();
  const {database} = require('../src/db/database');

  await expect(
    service.saveMemory({
      input: memoryInput(),
      account: unlocked,
      ids: {
        entryCommitId: '../commit',
        localEntryId: 'memory-stable',
        mediaIds: {photo: 'photo-stable'},
      },
    }),
  ).rejects.toThrow('entryCommitId 无效');
  expect(database.write).not.toHaveBeenCalled();
});

test('same entryCommitId does not duplicate jobs or items', async () => {
  const {service} = createHarness();
  const ids = {
    entryCommitId: 'commit-stable',
    localEntryId: 'memory-stable',
    mediaIds: {photo: 'photo-stable'},
  };

  const first = await service.saveMemory({
    input: memoryInput(),
    account: unlocked,
    ids,
  });
  await service.saveMemory({
    input: memoryInput(),
    account: unlocked,
    ids,
  });

  expect(mockTables.media_upload_jobs).toHaveLength(1);
  expect(mockTables.media_upload_items).toHaveLength(1);
  expect(mockTables.media_upload_jobs[0].entryCommitId).toBe(
    'commit-stable',
  );
  expect(mockTables.media_upload_items[0].mediaId).toBe(
    'photo-stable',
  );
  expect(first.idempotencyKey).toBe(
    'memory:memory-stable:commit-stable',
  );
});
