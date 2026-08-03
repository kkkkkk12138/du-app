const mockMemories = [
  {
    writtenAt: new Date(2026, 0, 3, 10),
    placeId: 'shanghai',
  },
  {
    writtenAt: new Date(2026, 0, 3, 20),
    placeId: 'shanghai',
  },
  {
    writtenAt: new Date(2026, 7, 8, 10),
    placeId: 'tokyo',
  },
];

const mockLetters = [
  { openedAt: new Date(2026, 4, 1) },
  { openedAt: undefined },
];

jest.mock('../src/db/database', () => ({
  database: {
    get: jest.fn((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn().mockResolvedValue(
          table === 'memories'
            ? mockMemories
            : table === 'letters'
            ? mockLetters
            : [
                { id: 'shanghai', name: '上海' },
                { id: 'tokyo', name: '东京' },
              ],
        ),
      })),
    })),
  },
}));

import { getAnnualSummary } from '../src/features/profile/annualSummaryRepository';

test('builds an annual summary from persisted local records', async () => {
  await expect(getAnnualSummary(2026)).resolves.toEqual({
    year: 2026,
    memoryCount: 3,
    activeDayCount: 2,
    placeCount: 2,
    letterCount: 2,
    openedLetterCount: 1,
    topMonth: 1,
    topMonthCount: 2,
    topPlace: '上海',
    firstEntryAt: mockMemories[0].writtenAt,
    lastEntryAt: mockMemories[2].writtenAt,
  });
});
