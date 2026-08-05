const mockWishes: any[] = [];
const mockTapes: any[] = [];

function mockMakeWish() {
  const record: any = {
    id: `wish-${mockWishes.length + 1}`,
    update: async (change: (item: any) => void) => change(record),
  };
  return record;
}

function mockMakeTape() {
  const record: any = {
    id: `tape-${mockTapes.length + 1}`,
    update: async (change: (item: any) => void) => change(record),
  };
  return record;
}

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => ({
      create: jest.fn(async (initialize: (record: any) => void) => {
        const record =
          table === 'wish_tapes' ? mockMakeTape() : mockMakeWish();
        initialize(record);
        (table === 'wish_tapes' ? mockTapes : mockWishes).push(record);
        return record;
      }),
      find: jest.fn(async (id: string) => {
        const records = table === 'wish_tapes' ? mockTapes : mockWishes;
        const record = records.find(item => item.id === id);
        if (!record) {
          throw new Error('not found');
        }
        return record;
      }),
      query: jest.fn(() => ({
        fetch: jest.fn(async () => {
          const records = table === 'wish_tapes' ? mockTapes : mockWishes;
          return records
            .filter(item => !item.deletedAt)
            .sort((left, right) =>
              table === 'wish_tapes'
                ? left.createdAt.getTime() - right.createdAt.getTime()
                : Number(right.pinned) - Number(left.pinned) ||
                  right.updatedAt.getTime() - left.updatedAt.getTime(),
            );
        }),
      })),
    })),
  },
}));

import {
  createWishTape,
  createWish,
  deleteWishTape,
  deleteWish,
  getWishTapes,
  getWishes,
  setWishFulfilled,
  setWishPinned,
  updateWish,
} from '../src/features/faraway/wishRepository';

beforeEach(() => {
  mockWishes.length = 0;
  mockTapes.length = 0;
});

test('persists, pins, and fulfills a real wish', async () => {
  const wish = await createWish({
    userId: 'user-1',
    title: '  去看一次极光  ',
    note: '冬天出发',
    color: 'blue',
    category: 'place',
    targetAt: new Date('2027-01-03T00:00:00.000Z'),
  });

  expect(wish).toEqual(
    expect.objectContaining({
      userId: 'user-1',
      title: '去看一次极光',
      note: '冬天出发',
      color: 'blue',
      category: 'place',
      targetAt: new Date('2027-01-03T00:00:00.000Z'),
      status: 'open',
      pinned: false,
    }),
  );

  await setWishPinned(wish.id, true);
  await setWishFulfilled(wish.id, true);
  await expect(getWishes('user-1')).resolves.toEqual([
    expect.objectContaining({
      id: wish.id,
      pinned: true,
      status: 'fulfilled',
    }),
  ]);
});

test('edits a wish without changing its completion state', async () => {
  const wish = await createWish({
    userId: 'user-1',
    title: '去海边',
  });

  await updateWish({
    wishId: wish.id,
    title: '  去北方看海  ',
    note: '等一个冬天',
    color: 'purple',
    category: 'self',
    targetAt: new Date('2028-02-01T00:00:00.000Z'),
  });
  await expect(getWishes('user-1')).resolves.toEqual([
    expect.objectContaining({
      id: wish.id,
      title: '去北方看海',
      note: '等一个冬天',
      color: 'purple',
      category: 'self',
      targetAt: new Date('2028-02-01T00:00:00.000Z'),
      status: 'open',
    }),
  ]);
});

test('soft-deletes a wish and rejects an empty title', async () => {
  await expect(
    createWish({userId: 'user-1', title: '   '}),
  ).rejects.toThrow('念想需要一个名字');

  const wish = await createWish({userId: 'user-1', title: '学会冲浪'});
  await deleteWish(wish.id);
  await expect(getWishes('user-1')).resolves.toEqual([]);
  expect(wish.deletedAt).toBeInstanceOf(Date);
});

test('persists and soft-deletes tapes with their wish', async () => {
  const wish = await createWish({userId: 'user-1', title: '慢慢走'});
  const tape = await createWishTape({
    wishId: wish.id,
    text: '  先走到江边  ',
    style: 'washi',
  });

  await expect(getWishTapes(wish.id)).resolves.toEqual([
    expect.objectContaining({
      wishId: wish.id,
      text: '先走到江边',
      style: 'washi',
    }),
  ]);

  await deleteWishTape(tape.id);
  await expect(getWishTapes(wish.id)).resolves.toEqual([]);

  const secondTape = await createWishTape({
    wishId: wish.id,
    text: '再写一封信',
    style: 'plain',
  });
  await deleteWish(wish.id);
  expect(secondTape.deletedAt).toBeInstanceOf(Date);
});
