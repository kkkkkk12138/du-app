const mockCollections: Record<string, any[]> = {
  places: [],
  memories: [],
  letters: [],
  tags: [],
};
let mockInstalledVersion: number | undefined;
let mockGeneratedId = 0;

function mockRecord(table: string, id: string, values: object = {}) {
  const record: any = {
    _raw: {id},
    id,
    ...values,
  };
  record.update = jest.fn(async (change: (value: any) => void) => {
    change(record);
    return record;
  });
  record.prepareUpdate = jest.fn((change: (value: any) => void) => ({
    apply: () => change(record),
  }));
  return record;
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/db/database', () => ({
  database: {
    adapter: {
      getDeletedRecords: jest.fn(async (table: string) =>
        mockCollections[table]
          .filter(record => record._raw._status === 'deleted')
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
    batch: jest.fn(async (...updates: Array<{apply: () => void}>) => {
      updates.forEach(update => update.apply());
    }),
    get: jest.fn((table: string) => ({
      query: jest.fn((...clauses: any[]) => ({
        fetch: jest.fn(async () => {
          const visibleRecords = mockCollections[table].filter(
            record => record._raw._status !== 'deleted',
          );
          const where = clauses.find(clause => clause.type === 'where');
          if (!where) {
            return visibleRecords;
          }
          if (
            where.left === 'id' &&
            where.comparison.operator === 'oneOf'
          ) {
            const ids = new Set(where.comparison.right.values);
            return visibleRecords.filter(record =>
              ids.has(record.id),
            );
          }
          return visibleRecords;
        }),
      })),
      create: jest.fn(async (initialize: (record: any) => void) => {
        mockGeneratedId += 1;
        const record = mockRecord(
          table,
          `generated-${table}-${mockGeneratedId}`,
        );
        initialize(record);
        record.id = record._raw.id;
        if (
          mockCollections[table].some(
            existing => existing.id === record.id,
          )
        ) {
          throw new Error(`UNIQUE constraint failed: ${table}.id`);
        }
        mockCollections[table].push(record);
        return record;
      }),
    })),
  },
}));

import {seedDevelopmentData} from '../src/db/seed';

beforeEach(() => {
  mockInstalledVersion = undefined;
  mockGeneratedId = 0;
  Object.values(mockCollections).forEach(records => {
    records.length = 0;
  });
});

test('recovers a partial development seed without duplicating fixed IDs', async () => {
  const deletedShanghai = mockRecord('places', 'shanghai', {
    name: '上海',
  });
  deletedShanghai._raw._status = 'deleted';
  mockCollections.places.push(deletedShanghai);

  await expect(seedDevelopmentData()).resolves.toBeUndefined();

  expect(
    mockCollections.places.filter(place => place.id === 'shanghai'),
  ).toHaveLength(1);
  expect(mockCollections.places).toEqual(
    expect.arrayContaining([
      expect.objectContaining({id: 'changsha'}),
      expect.objectContaining({id: 'tokyo'}),
    ]),
  );
  expect(mockCollections.places).toHaveLength(6);
  expect(mockInstalledVersion).toBe(4);

  await expect(seedDevelopmentData()).resolves.toBeUndefined();
  expect(mockCollections.places).toHaveLength(6);
});

test.each([
  ['memories', 'seed-memory-letter'],
  ['letters', 'seed-letter-one-year'],
] as const)(
  'does not duplicate an existing fixed record in %s',
  async (table, id) => {
    const deletedRecord = mockRecord(table, id);
    deletedRecord._raw._status = 'deleted';
    mockCollections[table].push(deletedRecord);

    await expect(seedDevelopmentData()).resolves.toBeUndefined();

    expect(
      mockCollections[table].filter(record => record.id === id),
    ).toHaveLength(1);
    expect(mockInstalledVersion).toBe(4);
  },
);

test('does not duplicate a development tag with the same identity', async () => {
  mockCollections.tags.push(
    mockRecord('tags', 'existing-weather-tag', {
      category: 'weather',
      text: '风好大',
    }),
  );

  await expect(seedDevelopmentData()).resolves.toBeUndefined();

  expect(
    mockCollections.tags.filter(
      tag => tag.category === 'weather' && tag.text === '风好大',
    ),
  ).toHaveLength(1);
  expect(mockInstalledVersion).toBe(4);
});
