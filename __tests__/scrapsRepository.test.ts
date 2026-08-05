const mockScraps: any[] = [];
const mockAppendScrapToBook = jest.fn(
  async (_args: unknown, afterAppend?: () => Promise<unknown>) =>
    afterAppend?.(),
);

function mockPrepareRecord(record: any) {
  record.update = jest.fn(async (change: (value: any) => void) => {
    change(record);
    return record;
  });
  return record;
}

jest.mock('../src/features/profile/bookshelfRepository', () => ({
  appendScrapToBook: (args: unknown, afterAppend?: () => Promise<unknown>) =>
    mockAppendScrapToBook(args, afterAppend),
}));

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => {
      if (table !== 'scraps') {
        return {
          query: jest.fn(() => ({
            fetch: jest.fn().mockResolvedValue([]),
          })),
        };
      }
      return {
        create: jest.fn(async (initialize: (record: any) => void) => {
          const record = mockPrepareRecord({
            id: `scrap-${mockScraps.length + 1}`,
            _raw: {},
          });
          initialize(record);
          mockScraps.push(record);
          return record;
        }),
        find: jest.fn(async (id: string) => {
          const record = mockScraps.find(item => item.id === id);
          if (!record) {
            throw new Error('not found');
          }
          return record;
        }),
        query: jest.fn(() => ({
          fetch: jest.fn().mockResolvedValue(mockScraps),
        })),
      };
    }),
  },
}));

import {
  archiveScrapInBook,
  createScrap,
  discardScrap,
  rotateScrap,
  undoDiscardScrap,
  updateScrapPosition,
} from '../src/features/profile/scrapsRepository';

beforeEach(() => {
  mockScraps.length = 0;
  mockAppendScrapToBook.mockClear();
});

test('creates a positioned scrap with a stable size and rotation', async () => {
  const scrap = await createScrap({
    userId: 'user-1',
    text: '有些路，要走慢一点，才会看见。',
    sourceLabel: '3.15 日迹',
    sourceType: 'diary',
    sourceId: 'memory-1',
    color: 'yellow',
    availableWidth: 390,
  });

  expect(scrap).toMatchObject({
    userId: 'user-1',
    sourceId: 'memory-1',
    color: 'yellow',
    x: 18,
    y: 56,
    archived: false,
  });
  expect(scrap.cardType).toBe('line');
  expect(scrap.rotation).toBeGreaterThanOrEqual(-3);
  expect(scrap.rotation).toBeLessThanOrEqual(3);
});

test('persists drag, rotation and reversible discard state', async () => {
  const scrap = await createScrap({
    userId: 'user-1',
    text: '窗边的雨。',
    sourceLabel: '直接写',
    sourceType: 'manual',
    color: 'blue',
    availableWidth: 390,
  });

  await updateScrapPosition(scrap.id, 72, 360);
  const rotation = scrap.rotation;
  await rotateScrap(scrap.id);
  await discardScrap(scrap.id);

  expect(scrap).toMatchObject({ x: 72, y: 360 });
  expect(scrap.rotation).not.toBe(rotation);
  expect(scrap.deletedAt).toBeInstanceOf(Date);

  await undoDiscardScrap(scrap.id);
  expect(scrap.deletedAt).toBeUndefined();
});

test('automatically places consecutive scraps without overlapping', async () => {
  const first = await createScrap({
    userId: 'user-1',
    text: '第一张散页。',
    sourceLabel: '直接写',
    sourceType: 'manual',
    color: 'white',
    availableWidth: 390,
  });
  const second = await createScrap({
    userId: 'user-1',
    text: '第二张散页。',
    sourceLabel: '直接写',
    sourceType: 'manual',
    color: 'white',
    availableWidth: 390,
  });

  expect(first).toMatchObject({ x: 18, y: 56 });
  expect(second.x).not.toBe(first.x);
  expect(second.y).toBe(first.y);
});

test('appends the scrap to a selected book before archiving it', async () => {
  const scrap = await createScrap({
    userId: 'user-1',
    text: '把这一页夹回去。',
    sourceLabel: '旧信',
    sourceType: 'letter',
    color: 'white',
    availableWidth: 390,
  });

  await archiveScrapInBook(scrap.id, 'book-1');

  expect(mockAppendScrapToBook).toHaveBeenCalledWith(
    {
      bookId: 'book-1',
      scrapId: scrap.id,
      text: scrap.textContent,
      sourceLabel: '旧信',
    },
    expect.any(Function),
  );
  expect(scrap.archived).toBe(true);
  expect(scrap.sourceBookId).toBe('book-1');
});
