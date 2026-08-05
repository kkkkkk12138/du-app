const mockShareFile = jest.fn().mockResolvedValue(undefined);

const user = {
  id: 'user-1',
  nickname: '行舟',
  avatarPath: '/files/avatar.jpg',
  birthday: new Date(1995, 9, 12),
  _raw: { id: 'user-1', nickname: '行舟', birthday: 813456000000 },
};
const place = {
  id: 'place-1',
  name: '杭州',
  _raw: { id: 'place-1', name: '杭州' },
};
const memory = {
  id: 'memory-1',
  content: '雨落在窗边。',
  status: 'published',
  deleted: false,
  writtenAt: new Date('2026-08-01T08:00:00.000Z'),
  placeId: 'place-1',
  imagePath: 'file:///files/photo.jpg',
  audioPath: '/files/missing.wav',
  inkImagePath: undefined,
  _raw: { id: 'memory-1', content: '雨落在窗边。' },
};
const letter = {
  id: 'letter-1',
  memoryId: 'memory-1',
  status: 'traveling',
  sentAt: new Date('2026-08-01T08:00:00.000Z'),
  arriveDate: new Date('2027-08-01T08:00:00.000Z'),
  _raw: { id: 'letter-1', memory_id: 'memory-1' },
};
const wish = {
  id: 'wish-1',
  title: '看一次海',
  note: '冬天也可以',
  status: 'open',
  deletedAt: undefined,
  _raw: { id: 'wish-1', title: '看一次海' },
};
const quest = {
  id: 'quest-1',
  title: '慢慢走',
  coverImageAssetId: '/files/quest-cover.jpg',
  deletedAt: undefined,
  _raw: {
    id: 'quest-1',
    title: '慢慢走',
    cover_image_asset_id: '/files/quest-cover.jpg',
  },
};
const collagePage = {
  id: 'collage-1',
  photoPaths: JSON.stringify([
    '/files/collage-a.jpg',
    '/files/collage-b.jpg',
    '/files/collage-c.jpg',
  ]),
  deletedAt: undefined,
  _raw: {
    id: 'collage-1',
    photo_paths: JSON.stringify([
      '/files/collage-a.jpg',
      '/files/collage-b.jpg',
      '/files/collage-c.jpg',
    ]),
  },
};
const book = {
  id: 'book-1',
  title: '诗集',
  subtitle: '风从纸上经过',
  categories: JSON.stringify(['诗集']),
  coverImagePath: '/files/book-cover.jpg',
  currentPage: 0,
  deletedAt: undefined,
  _raw: {
    id: 'book-1',
    title: '诗集',
    cover_image_path: '/files/book-cover.jpg',
  },
};

const mockRecords: Record<string, object[]> = {
  users: [user],
  places: [place],
  memories: [memory],
  letters: [letter],
  settings: [{ _raw: { id: 'local-settings', art_skin: 'paper' } }],
  wishes: [wish],
  wish_tapes: [],
  quests: [quest],
  quest_nodes: [],
  quest_edges: [],
  quest_stickies: [],
  collage_pages: [collagePage],
  books: [book],
  book_pages: [],
  scraps: [],
};

jest.mock('../src/db/database', () => ({
  database: {
    get: jest.fn((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn().mockResolvedValue(mockRecords[table] ?? []),
      })),
    })),
  },
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    CachesDirectoryPath: '/cache',
    mkdir: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn((path: string) =>
      Promise.resolve(path !== '/files/missing.wav'),
    ),
    readFile: jest.fn().mockResolvedValue('YmFzZTY0'),
    hash: jest.fn().mockResolvedValue('sha256-value'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { shareFullBackup, shareReadableData } from '../src/services/dataExport';

const mockWriteFile = RNFS.writeFile as jest.Mock;
const mockUnlink = RNFS.unlink as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  NativeModules.DuFileShare = { shareFile: mockShareFile };
});

test('exports a versioned backup with raw records and verified assets', async () => {
  const path = await shareFullBackup();
  const backupWrite = mockWriteFile.mock.calls.find(([target]) =>
    String(target).endsWith('.du-backup.json'),
  );
  const manifest = JSON.parse(backupWrite?.[1] as string);

  expect(path).toContain('/cache/du-exports/');
  expect(manifest).toMatchObject({
    format: 'du-local-backup',
    version: 1,
    schemaVersion: 13,
  });
  expect(manifest.tables.memories[0]).toEqual(memory._raw);
  expect(manifest.assets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ownerId: 'memory-1',
        kind: 'photo',
        dataBase64: 'YmFzZTY0',
        sha256: 'sha256-value',
        missing: false,
      }),
      expect.objectContaining({
        ownerId: 'memory-1',
        kind: 'audio',
        missing: true,
      }),
      expect.objectContaining({
        ownerId: 'user-1',
        kind: 'avatar',
        sha256: 'sha256-value',
      }),
      expect.objectContaining({
        ownerType: 'collagePage',
        ownerId: 'collage-1',
        kind: 'photo-1',
        sha256: 'sha256-value',
      }),
      expect.objectContaining({
        ownerType: 'quest',
        ownerId: 'quest-1',
        kind: 'cover',
        sha256: 'sha256-value',
      }),
      expect.objectContaining({
        ownerType: 'book',
        ownerId: 'book-1',
        kind: 'cover',
        sha256: 'sha256-value',
      }),
    ]),
  );
  expect(manifest.readableText).toContain('雨落在窗边。');
  expect(mockShareFile).toHaveBeenCalledWith(
    path,
    'application/json',
    '导出渡的完整备份',
  );
});

test('exports readable local content through the native file share bridge', async () => {
  const path = await shareReadableData();
  const readableWrite = mockWriteFile.mock.calls.find(([target]) =>
    String(target).endsWith('.txt'),
  );

  expect(readableWrite?.[1]).toContain('昵称：行舟');
  expect(readableWrite?.[1]).toContain('生日：');
  expect(readableWrite?.[1]).toContain('念想（1）');
  expect(readableWrite?.[1]).toContain('副本（1）');
  expect(readableWrite?.[1]).not.toContain('拼贴本');
  expect(mockShareFile).toHaveBeenCalledWith(
    path,
    'text/plain',
    '导出渡的可读文稿',
  );
});

test('removes the temporary export directory when native sharing fails', async () => {
  mockShareFile.mockRejectedValueOnce(new Error('share failed'));

  await expect(shareReadableData()).rejects.toThrow('share failed');
  expect(mockUnlink).toHaveBeenCalledWith(
    expect.stringContaining('/cache/du-exports/'),
  );
});
