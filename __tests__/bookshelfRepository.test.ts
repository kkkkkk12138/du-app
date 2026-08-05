const memory = {
  id: 'memory-1',
  content: '雨停后，我沿河多走了十分钟。',
  type: 'text',
  status: 'published',
  deleted: false,
  isFutureLetter: false,
  placeId: 'place-1',
  placeDetail: '河边',
  writtenAt: new Date('2026-03-15T08:00:00.000Z'),
};
const collections: Record<string, any[]> = {
  memories: [memory],
  books: [],
  book_pages: [],
};

function mockCollection(table: string) {
  return {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue(collections[table] ?? []),
    })),
    create: jest.fn(async (initialize: (record: any) => void) => {
      const record: any = {
        id: `${table}-${(collections[table]?.length ?? 0) + 1}`,
        _raw: {},
      };
      record.update = jest.fn(async (change: (value: any) => void) => {
        change(record);
        return record;
      });
      record.prepareUpdate = jest.fn((change: (value: any) => void) => {
        change(record);
        return record;
      });
      record.prepareDestroyPermanently = jest.fn(() => {
        const index = collections[table].indexOf(record);
        if (index >= 0) {
          collections[table].splice(index, 1);
        }
        return record;
      });
      initialize(record);
      collections[table].push(record);
      return record;
    }),
    find: jest.fn(async (id: string) => {
      const record = collections[table].find(item => item.id === id);
      if (!record) {
        throw new Error('not found');
      }
      record.update = jest.fn(async (change: (value: any) => void) => {
        change(record);
        return record;
      });
      return record;
    }),
  };
}

jest.mock('../src/db/database', () => ({
  database: {
    batch: jest.fn().mockResolvedValue(undefined),
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => mockCollection(table)),
  },
}));

const mockRemoveMediaFile = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/mediaStorage', () => ({
  prepareMediaForPersistence: jest.fn(async (path?: string) => ({
    path: path ? '/persistent/book-cover.jpg' : undefined,
  })),
  finalizePreparedMedia: jest.fn().mockResolvedValue(undefined),
  rollbackPreparedMedia: jest.fn().mockResolvedValue(undefined),
  removeMediaFile: (path?: string) => mockRemoveMediaFile(path),
}));

import {
  appendWritingToBook,
  bookMatchesFilter,
  createBook,
  deleteBookPage,
  getBindableSources,
  updateBookProgress,
} from '../src/features/profile/bookshelfRepository';

beforeEach(() => {
  collections.books.length = 0;
  collections.book_pages.length = 0;
  jest.clearAllMocks();
});

test('derives bindable sources from persisted memories', async () => {
  const sources = await getBindableSources();

  expect(sources).toEqual([
    expect.objectContaining({
      id: 'memory-1',
      sourceType: 'diary',
      decoration: 'mountain',
      excerpt: memory.content,
    }),
  ]);
});

test('creates a real book with cover, title, content and back pages', async () => {
  const book = await createBook({
    userId: 'user-1',
    title: '春岸',
    subtitle: '二〇二六',
    category: '2026',
    template: 'spring',
    sourceIds: ['memory-1'],
  });

  expect(book).toMatchObject({
    userId: 'user-1',
    title: '春岸',
    coverTemplate: 'spring',
    currentPage: 0,
  });
  expect(JSON.parse(book.categories)).toContain('2026');
  expect(collections.book_pages.map(page => page.type)).toEqual([
    'cover',
    'title',
    'content',
    'back',
  ]);
  expect(collections.book_pages[2]).toMatchObject({
    textContent: memory.content,
    sourceId: 'memory-1',
  });
  expect(bookMatchesFilter(book, '2026')).toBe(true);
  expect(bookMatchesFilter(book, '诗集')).toBe(false);
});

test('persists the last page reached by the reader', async () => {
  const book = await createBook({
    userId: 'user-1',
    title: '沿河',
    category: '诗集',
    template: 'travel',
    sourceIds: ['memory-1'],
  });

  await updateBookProgress(book.id, 3);

  expect(book.currentPage).toBe(3);
  expect(book.updatedAt).toBeInstanceOf(Date);
});

test('creates an empty book with a complete structural shell', async () => {
  const book = await createBook({
    userId: 'user-1',
    title: '待写',
    category: '歌词本',
    template: 'reading',
    sourceIds: [],
  });

  expect(book).toMatchObject({
    title: '待写',
    subtitle: '歌词本',
    source: '空册',
  });
  expect(collections.book_pages.map(page => page.type)).toEqual([
    'cover',
    'title',
    'back',
  ]);
  expect(bookMatchesFilter(book, '歌词本')).toBe(true);
});

test('persists an optional custom cover and deletes a content page only', async () => {
  const book = await createBook({
    userId: 'user-1',
    title: '有封面的书',
    category: '自定义',
    template: 'spring',
    sourceIds: ['memory-1'],
    coverImagePath: '/draft/cover.jpg',
  });
  const contentPage = collections.book_pages.find(
    page => page.type === 'content',
  );

  expect(book.coverImagePath).toBe('/persistent/book-cover.jpg');
  await deleteBookPage(book.id, contentPage.id);

  expect(collections.book_pages.some(page => page.id === contentPage.id)).toBe(
    false,
  );
  expect(collections.book_pages.map(page => page.pageIndex)).toEqual([0, 1, 2]);
  expect(book.source).toBe('空册');
});

test('continues writing inside a book before its back cover', async () => {
  const book = await createBook({
    userId: 'user-1',
    title: '待续',
    category: '诗集',
    template: 'fragment',
    sourceIds: [],
  });

  await appendWritingToBook({
    bookId: book.id,
    eyebrow: '雨后 · 续页',
    text: '风停在半页纸上。\n我从这里继续写。',
  });

  const orderedPages = [...collections.book_pages].sort(
    (left, right) => left.pageIndex - right.pageIndex,
  );
  expect(orderedPages.map(page => page.type)).toEqual([
    'cover',
    'title',
    'content',
    'back',
  ]);
  expect(orderedPages[2]).toMatchObject({
    dateLabel: '雨后 · 续页',
    textContent: '风停在半页纸上。\n我从这里继续写。',
    sourceType: 'writing',
  });
  expect(orderedPages[3].pageIndex).toBe(3);
  expect(book.source).toBe('续写');

  await appendWritingToBook({
    bookId: book.id,
    eyebrow: '下一页',
    pageId: orderedPages[2].id,
    text: '这一页紧跟在刚才的内容后面。',
  });
  const reorderedPages = [...collections.book_pages].sort(
    (left, right) => left.pageIndex - right.pageIndex,
  );
  expect(reorderedPages.map(page => page.type)).toEqual([
    'cover',
    'title',
    'content',
    'content',
    'back',
  ]);
  expect(reorderedPages[3]).toMatchObject({
    dateLabel: '下一页',
    textContent: '这一页紧跟在刚才的内容后面。',
  });
});

test('continues on the current content page without replacing its eyebrow', async () => {
  const book = await createBook({
    userId: 'user-1',
    title: '春岸',
    category: '2026',
    template: 'spring',
    sourceIds: ['memory-1'],
  });
  const contentPage = collections.book_pages.find(
    page => page.type === 'content',
  );
  const originalEyebrow = contentPage.dateLabel;

  await appendWritingToBook({
    bookId: book.id,
    pageId: contentPage.id,
    placement: 'current-page',
    text: '后来，河面又亮了一次。',
  });

  expect(collections.book_pages).toHaveLength(4);
  expect(contentPage.textContent).toBe(
    `${memory.content}\n\n后来，河面又亮了一次。`,
  );
  expect(contentPage.dateLabel).toBe(originalEyebrow);
});
