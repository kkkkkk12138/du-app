const mockCollections: Record<string, unknown[]> = {
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
        };
        initialize(record);
        records.push(record);
        return record;
      }),
    })),
  },
}));

import { createFutureLetter } from '../src/features/newLetter/futureLetterRepository';

beforeEach(() => {
  mockCollections.memories.length = 0;
  mockCollections.letters.length = 0;
});

test('creates linked future memory and pending notification atomically', async () => {
  const result = await createFutureLetter({
    draft: {
      content: '留给未来的这一封。',
      type: 'audio',
      customTags: ['平静'],
      audioPath: '/documents/future.wav',
      audioDuration: 12,
      placeDetail: '31.23040, 121.47370',
    },
    arriveDate: new Date(2027, 7, 2, 18, 30),
    arriveType: 'one_year',
  });

  expect(result.memory).toEqual(
    expect.objectContaining({
      content: '留给未来的这一封。',
      type: 'audio',
      customTags: '["平静"]',
      isFutureLetter: true,
      futureArriveAt: new Date(2027, 7, 2, 18, 30),
      futureArriveType: 'one_year',
      audioPath: '/documents/future.wav',
      letterId: 'letters-1',
    }),
  );
  expect(result.letter).toEqual(
    expect.objectContaining({
      memoryId: 'memories-1',
      arriveDate: new Date(2027, 7, 2, 18, 30),
      arriveType: 'one_year',
      status: 'pending_notification',
      notificationStatus: 'pending',
      toType: 'future_self',
    }),
  );
});
