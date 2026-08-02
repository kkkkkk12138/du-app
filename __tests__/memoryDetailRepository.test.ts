const mockCollections: Record<string, any[]> = {
  memories: [],
  letters: [],
};

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn((table: string) => ({
      create: jest.fn(async (initialize: (record: any) => void) => {
        const records = mockCollections[table];
        const record = {
          id: `${table}-${records.length + 1}`,
          update: async (change: (item: any) => void) => change(record),
          destroyPermanently: jest.fn(),
        };
        initialize(record);
        records.push(record);
        return record;
      }),
    })),
  },
}));

import { Memory } from '../src/db/models';
import {
  createMemoryReply,
  setMemoryStamp,
} from '../src/features/daily/memoryDetailRepository';

beforeEach(() => {
  mockCollections.memories.length = 0;
  mockCollections.letters.length = 0;
});

test('stores a reply outside the Daily timeline and links it to its parent', async () => {
  const parent = { id: 'memory-parent' } as Memory;
  const reply = await createMemoryReply(parent, '  后来我明白了。  ');

  expect(reply).toEqual(
    expect.objectContaining({
      content: '后来我明白了。',
      type: 'reply',
      deleted: true,
      isFutureLetter: false,
    }),
  );
  expect(mockCollections.letters[0]).toEqual(
    expect.objectContaining({
      memoryId: 'memory-parent',
      replyMemoryId: 'memories-1',
      status: 'reply',
      toType: 'memory_reply',
    }),
  );
});

test('creates a future stamp linked to the original memory', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 0, 31, 18));
  const stamp = await setMemoryStamp({
    memory: { id: 'memory-parent' } as Memory,
    months: 3,
    existingStamp: null,
  });

  expect(stamp).toEqual(
    expect.objectContaining({
      memoryId: 'memory-parent',
      arriveDate: new Date(2026, 3, 30),
      arriveType: '3_months',
      status: 'traveling',
      toType: 'memory_future_self',
    }),
  );
  jest.useRealTimers();
});
