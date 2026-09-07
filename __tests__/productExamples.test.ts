const mockCollections: Record<string, any[]> = {
  places: [],
  memories: [],
  letters: [],
  wishes: [],
  wish_tapes: [],
  quests: [],
  quest_nodes: [],
  quest_stickies: [],
  books: [],
  book_pages: [],
  scraps: [],
};
let mockInstalledVersion: number | undefined;

jest.mock('../src/db/database', () => ({
  database: {
    adapter: {
      getDeletedRecords: jest.fn(async (table: string) =>
        mockCollections[table]
          .filter(record => record._raw?._status === 'deleted')
          .map(record => record.id),
      ),
    },
    localStorage: {
      get: jest.fn(async () => mockInstalledVersion),
      set: jest.fn(async (_key: unknown, value: number) => {
        mockInstalledVersion = value;
      }),
    },
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () =>
          mockCollections[table].filter(
            record => record._raw?._status !== 'deleted',
          ),
        ),
      })),
      create: jest.fn(async (initialize: (record: any) => void) => {
        const record: any = { _raw: {} };
        record.update = jest.fn(async (change: (value: any) => void) => {
          change(record);
          return record;
        });
        initialize(record);
        record.id = record._raw.id;
        mockCollections[table].push(record);
        return record;
      }),
    })),
  },
}));

import {
  productExampleManifest,
  seedProductExamples,
} from '../src/db/productExamples';
import { isExampleRecord } from '../src/utils/exampleRecords';

beforeEach(() => {
  mockInstalledVersion = undefined;
  Object.values(mockCollections).forEach(records => {
    records.length = 0;
  });
});

test('seeds a complete, clearly identified and deletable example set once', async () => {
  const now = new Date(2026, 7, 5, 10, 30);

  await expect(seedProductExamples('user-1', now)).resolves.toBe(true);

  expect(mockCollections.memories).toHaveLength(
    productExampleManifest.memories,
  );
  expect(mockCollections.letters).toHaveLength(productExampleManifest.letters);
  expect(mockCollections.wishes).toHaveLength(productExampleManifest.wishes);
  expect(mockCollections.quests).toHaveLength(productExampleManifest.quests);
  expect(mockCollections.books).toHaveLength(productExampleManifest.books);
  expect(mockCollections.scraps).toHaveLength(productExampleManifest.scraps);
  expect(
    mockCollections.books.map(book => JSON.parse(book.categories)[0]),
  ).toEqual(expect.arrayContaining(['2026', '歌词本', '诗集']));
  mockCollections.books.forEach(book => {
    const pages = mockCollections.book_pages.filter(
      page => page.bookId === book.id && page.type === 'content',
    );
    expect(pages).toHaveLength(5);
    expect(pages.every(page => page.sourceType === 'example-book')).toBe(true);
    expect(pages.every(page => !page.sourceId)).toBe(true);
  });
  const lyrics = mockCollections.book_pages.filter(
    page => page.bookId === 'example-book-v4-2' && page.type === 'content',
  );
  expect(lyrics.every(page => page.dateLabel.startsWith('原创歌词'))).toBe(
    true,
  );
  expect(lyrics.map(page => page.textContent).join('\n')).toContain(
    '灯还亮着，不是挽留',
  );
  expect(
    Object.values(mockCollections)
      .flat()
      .every(record => isExampleRecord(record)),
  ).toBe(true);
  expect(mockCollections.quests.every(quest => !quest.isTemplate)).toBe(true);

  const traveling = mockCollections.letters.find(
    letter => letter.id === 'example-letter-traveling',
  );
  expect(traveling.arriveDate).toEqual(new Date(2026, 8, 5, 8, 26));

  await expect(seedProductExamples('user-1', now)).resolves.toBe(false);
  expect(mockCollections.memories).toHaveLength(
    productExampleManifest.memories,
  );
});

test('repairs a lost seed marker without rebuilding complete examples', async () => {
  const now = new Date(2026, 7, 5, 10, 30);
  await seedProductExamples('user-1', now);
  const initialCounts = Object.fromEntries(
    Object.entries(mockCollections).map(([table, records]) => [
      table,
      records.length,
    ]),
  );
  const initialPlace = mockCollections.places.find(
    place => place.id === 'example-place-hangzhou',
  );
  initialPlace._raw._status = 'deleted';
  mockInstalledVersion = undefined;

  await expect(seedProductExamples('user-1', now)).resolves.toBe(false);

  expect(
    Object.fromEntries(
      Object.entries(mockCollections).map(([table, records]) => [
        table,
        records.length,
      ]),
    ),
  ).toEqual(initialCounts);
  expect(mockInstalledVersion).toBe(6);
});

test('recognizes legacy development seeds as examples too', () => {
  expect(isExampleRecord('seed-v3-photo-today')).toBe(true);
  expect(isExampleRecord('user-memory-1')).toBe(false);
});

test('adds richer v5 examples once without recreating the v4 set', async () => {
  mockInstalledVersion = 4;

  await expect(
    seedProductExamples('user-1', new Date(2026, 7, 6, 9, 0)),
  ).resolves.toBe(true);

  expect(mockCollections.memories).toHaveLength(4);
  expect(mockCollections.letters).toHaveLength(2);
  expect(mockCollections.wishes).toHaveLength(2);
  expect(mockCollections.places).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'example-place-harbin',
        name: '哈尔滨',
      }),
    ]),
  );
  await expect(
    seedProductExamples('user-1', new Date(2026, 7, 6, 9, 0)),
  ).resolves.toBe(false);
});

test('updates surviving v5 copy without restoring deleted examples', async () => {
  mockInstalledVersion = 5;
  const rainMemory: any = {
    id: 'example-memory-rain-walk',
    content: '旧的偏沉重文案',
    updatedAt: new Date(2026, 6, 1),
  };
  rainMemory.update = jest.fn(async (change: (record: any) => void) => {
    change(rainMemory);
    return rainMemory;
  });
  const userMemory = {
    id: 'user-memory-1',
    content: '用户自己的记录',
    update: jest.fn(),
  };
  mockCollections.memories.push(rainMemory, userMemory);

  const now = new Date(2026, 7, 6, 10, 0);
  await expect(seedProductExamples('user-1', now)).resolves.toBe(true);

  expect(mockInstalledVersion).toBe(6);
  expect(mockCollections.memories).toHaveLength(2);
  expect(rainMemory.content).toContain('三只鸭子');
  expect(rainMemory.updatedAt).toEqual(now);
  expect(rainMemory.update).toHaveBeenCalledTimes(1);
  expect(userMemory.content).toBe('用户自己的记录');
  expect(userMemory.update).not.toHaveBeenCalled();
  expect(
    mockCollections.memories.find(
      memory => memory.id === 'example-memory-harbin-snow',
    ),
  ).toBeUndefined();
  expect(mockCollections.letters).toHaveLength(0);
  expect(mockCollections.wishes).toHaveLength(0);
});
