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
    localStorage: {
      get: jest.fn(async () => mockInstalledVersion),
      set: jest.fn(async (_key: unknown, value: number) => {
        mockInstalledVersion = value;
      }),
    },
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn().mockResolvedValue(mockCollections[table]),
      })),
      create: jest.fn(async (initialize: (record: any) => void) => {
        const record: any = { _raw: {} };
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

test('recognizes legacy development seeds as examples too', () => {
  expect(isExampleRecord('seed-v3-photo-today')).toBe(true);
  expect(isExampleRecord('user-memory-1')).toBe(false);
});
