const sha256 = 'a'.repeat(64);
const mockPickBackupFile = jest.fn();

const tables = [
  'users',
  'places',
  'memories',
  'letters',
  'settings',
  'tags',
  'wishes',
  'wish_tapes',
  'quests',
  'quest_nodes',
  'quest_edges',
  'quest_stickies',
  'collage_pages',
] as const;

function tableData() {
  return Object.fromEntries(tables.map(table => [table, []]));
}

function manifest(schemaVersion = 11) {
  return {
    format: 'du-local-backup',
    version: 1,
    schemaVersion,
    exportedAt: '2026-08-05T08:00:00.000Z',
    tables: {
      ...tableData(),
      users: [
        {
          id: 'old-user',
          nickname: '行舟',
          du_number: '123456',
          avatar_path: '/old/avatar.jpg',
        },
      ],
      memories: [
        {
          id: 'memory-1',
          content: '雨落在窗边。',
          image_path: '/old/photo.jpg',
        },
      ],
      letters: [{ id: 'letter-1', memory_id: 'memory-1' }],
      settings: [
        {
          id: 'old-settings',
          user_id: 'old-user',
          theme_mode: 'system',
        },
      ],
      wishes: [{ id: 'wish-1', user_id: 'old-user' }],
      quests: [
        {
          id: 'quest-1',
          user_id: 'old-user',
          cover_mode: 'photo',
          cover_image_asset_id: '/old/cover.jpg',
        },
      ],
      collage_pages: [
        {
          id: 'collage-1',
          user_id: 'old-user',
          photo_paths: JSON.stringify(['/old/a.jpg']),
        },
      ],
    },
    assets: [
      {
        ownerType: 'memory',
        ownerId: 'memory-1',
        kind: 'photo',
        source: '/old/photo.jpg',
        filename: 'memory-1-photo.jpg',
        dataBase64: 'YmFzZTY0',
        sha256,
        missing: false,
      },
      {
        ownerType: 'profile',
        ownerId: 'old-user',
        kind: 'avatar',
        source: '/old/avatar.jpg',
        filename: 'old-user-avatar.jpg',
        dataBase64: 'YmFzZTY0',
        sha256,
        missing: false,
      },
      {
        ownerType: 'collagePage',
        ownerId: 'collage-1',
        kind: 'photo-1',
        source: '/old/a.jpg',
        filename: 'collage-1-photo-1.jpg',
        dataBase64: 'YmFzZTY0',
        sha256,
        missing: false,
      },
      {
        ownerType: 'collagePage',
        ownerId: 'collage-1',
        kind: 'photo-2',
        source: '/old/b.jpg',
        filename: 'collage-1-photo-2.jpg',
        dataBase64: 'YmFzZTY0',
        sha256,
        missing: false,
      },
      {
        ownerType: 'collagePage',
        ownerId: 'collage-1',
        kind: 'photo-3',
        source: '/old/c.jpg',
        filename: 'collage-1-photo-3.jpg',
        dataBase64: 'YmFzZTY0',
        sha256,
        missing: false,
      },
      {
        ownerType: 'quest',
        ownerId: 'quest-1',
        kind: 'cover',
        source: '/old/cover.jpg',
        filename: 'quest-1-cover.jpg',
        dataBase64: 'YmFzZTY0',
        sha256,
        missing: false,
      },
    ],
    readableText: '渡 · 我的数据',
  };
}

let mockFileContents: Record<string, string> = {};

jest.mock('../src/db/database', () => {
  const preparedRecords: Record<string, Record<string, unknown>[]> = {};
  return {
    database: {
      _prepared: preparedRecords,
      get: jest.fn((table: string) => ({
        query: jest.fn(() => ({
          fetch: jest.fn().mockResolvedValue([]),
        })),
        prepareCreateFromDirtyRaw: jest.fn((raw: Record<string, unknown>) => {
          preparedRecords[table] ??= [];
          preparedRecords[table].push(raw);
          return { _raw: raw, collection: { table } };
        }),
      })),
      write: jest.fn((callback: () => Promise<void>) => callback()),
      unsafeResetDatabase: jest.fn().mockResolvedValue(undefined),
      batch: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../src/services/dataExport', () => {
  const actual = jest.requireActual('../src/services/dataExport');
  return {
    ...actual,
    createFullBackupFile: jest.fn().mockResolvedValue('/rescue.json'),
  };
});

jest.mock('../src/services/mediaStorage', () => ({
  removeMediaFile: jest.fn().mockResolvedValue(undefined),
  writeRestoredMediaFile: jest
    .fn()
    .mockImplementation(({ filename }: { filename: string }) =>
      Promise.resolve(`/restored/${filename}`),
    ),
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    stat: jest.fn().mockResolvedValue({ size: 2048 }),
    readFile: jest.fn((path: string) =>
      Promise.resolve(mockFileContents[path]),
    ),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

import { NativeModules } from 'react-native';
import {
  pickAndInspectBackup,
  restoreFullBackup,
} from '../src/services/dataRestore';

const { removeMediaFile: mockRemoveMediaFile } = jest.requireMock(
  '../src/services/mediaStorage',
) as { removeMediaFile: jest.Mock };
const { database: mockDatabase } = jest.requireMock('../src/db/database') as {
  database: {
    _prepared: Record<string, Record<string, unknown>[]>;
    unsafeResetDatabase: jest.Mock;
    batch: jest.Mock;
  };
};
const prepared = mockDatabase._prepared;
const mockResetDatabase = mockDatabase.unsafeResetDatabase;
const mockBatch = mockDatabase.batch;

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(prepared).forEach(key => delete prepared[key]);
  const content = JSON.stringify(manifest());
  mockFileContents = {
    '/import.json': content,
    '/rescue.json': content,
  };
  mockPickBackupFile.mockResolvedValue('/import.json');
  NativeModules.DuFileShare = { pickBackupFile: mockPickBackupFile };
});

test('previews a validated backup before destructive restore', async () => {
  const preview = await pickAndInspectBackup();

  expect(preview).toMatchObject({
    memoryCount: 1,
    letterCount: 1,
    wishCount: 1,
    questCount: 1,
    collageCount: 1,
    assetCount: 6,
    missingAssetCount: 0,
  });
});

test.each([14, 15])(
  'accepts schema %s backups across the outbox migration',
  async schemaVersion => {
    mockFileContents['/import.json'] = JSON.stringify(
      manifest(schemaVersion),
    );

    await expect(pickAndInspectBackup()).resolves.toBeDefined();
  },
);

test('rejects unsupported or corrupted backup content', async () => {
  mockFileContents['/import.json'] = JSON.stringify({
    ...manifest(),
    format: 'unknown-backup',
  });

  await expect(pickAndInspectBackup()).rejects.toThrow(
    '这不是当前版本支持的渡完整备份',
  );
  expect(mockResetDatabase).not.toHaveBeenCalled();
});

test('restores assets and remaps imported content to the device identity', async () => {
  const result = await restoreFullBackup('/import.json', 'current-user');

  expect(mockResetDatabase).toHaveBeenCalledTimes(1);
  expect(prepared.users[0]).toMatchObject({
    id: 'current-user',
    nickname: '行舟',
    avatar_path: '/restored/old-user-avatar.jpg',
  });
  expect(prepared.settings[0]).toMatchObject({
    id: 'local-settings',
    user_id: 'current-user',
  });
  expect(prepared.wishes[0].user_id).toBe('current-user');
  expect(prepared.quests[0].user_id).toBe('current-user');
  expect(prepared.quests[0].cover_image_asset_id).toBe(
    '/restored/quest-1-cover.jpg',
  );
  expect(prepared.collage_pages[0]).toMatchObject({
    user_id: 'current-user',
    photo_paths: JSON.stringify([
      '/restored/collage-1-photo-1.jpg',
      '/restored/collage-1-photo-2.jpg',
      '/restored/collage-1-photo-3.jpg',
    ]),
  });
  expect(prepared.memories[0].image_path).toBe('/restored/memory-1-photo.jpg');
  expect(prepared.letters[0]).toMatchObject({
    notification_status: null,
    notification_id: null,
  });
  expect(result.duNumber).toBe('123456');
});

test('automatically reapplies the rescue backup when replacement fails', async () => {
  mockBatch.mockRejectedValueOnce(new Error('database failed'));

  await expect(
    restoreFullBackup('/import.json', 'current-user'),
  ).rejects.toThrow('database failed');

  expect(mockResetDatabase).toHaveBeenCalledTimes(2);
  expect(mockBatch).toHaveBeenCalledTimes(2);
  expect(mockRemoveMediaFile).toHaveBeenCalled();
});
