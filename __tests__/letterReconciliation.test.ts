const mockDueLetter: any = {
  id: 'due',
  status: 'traveling',
  arriveDate: new Date(2026, 7, 2),
  prepareUpdate: jest.fn((change: (record: any) => void) => {
    change(mockDueLetter);
    return mockDueLetter;
  }),
};
const mockFutureLetter: any = {
  id: 'future',
  status: 'traveling',
  arriveDate: new Date(2026, 7, 3),
};

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    batch: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () =>
          [mockDueLetter, mockFutureLetter].filter(
            letter =>
              letter.status === 'traveling' &&
              letter.arriveDate.getTime() <=
                new Date(2026, 7, 2, 12).getTime(),
          ),
        ),
      })),
    })),
  },
}));

import {reconcileLetterArrivals} from '../src/features/letters/lettersRepository';

beforeEach(() => {
  mockDueLetter.status = 'traveling';
  mockFutureLetter.status = 'traveling';
  mockDueLetter.prepareUpdate.mockClear();
});

test('marks only due traveling letters as arrived', async () => {
  await expect(
    reconcileLetterArrivals(new Date(2026, 7, 2, 12)),
  ).resolves.toBe(1);

  expect(mockDueLetter.status).toBe('arrived');
  expect(mockFutureLetter.status).toBe('traveling');
  expect(mockDueLetter.prepareUpdate).toHaveBeenCalledTimes(1);
});

test('is idempotent after the due letter has arrived', async () => {
  await reconcileLetterArrivals(new Date(2026, 7, 2, 12));

  await expect(
    reconcileLetterArrivals(new Date(2026, 7, 2, 12)),
  ).resolves.toBe(0);
});
