const mockPlaces: any[] = [];
const mockMemories: any[] = [];

const mockPlaceCollection = {
  query: jest.fn(() => ({
    fetch: jest.fn(async () => mockPlaces),
  })),
  create: jest.fn(async (change: (record: any) => void) => {
    const record = {id: `place-${mockPlaces.length + 1}`};
    change(record);
    mockPlaces.push(record);
    return record;
  }),
};
const mockMemoryCollection = {
  query: jest.fn(() => ({
    fetch: jest.fn(async () => mockMemories),
  })),
  find: jest.fn(),
  create: jest.fn(async (change: (record: any) => void) => {
    const record = {id: `memory-${mockMemories.length + 1}`};
    change(record);
    mockMemories.push(record);
    return record;
  }),
};

jest.mock('../src/db/database', () => ({
  database: {
    get: jest.fn((table: string) =>
      table === 'places' ? mockPlaceCollection : mockMemoryCollection,
    ),
    write: jest.fn((work: () => Promise<unknown>) => work()),
  },
}));

jest.mock('../src/services/mediaStorage', () => ({
  finalizePreparedMedia: jest.fn(),
  prepareMediaForPersistence: jest.fn(async () => ({path: undefined})),
  rollbackPreparedMedia: jest.fn(),
}));

import {createMemory} from '../src/db/memoryRepository';
import {getLatestRecognizedCity} from '../src/db/placeRepository';

describe('memory city integration', () => {
  beforeEach(() => {
    mockPlaces.splice(0);
    mockMemories.splice(0);
    jest.clearAllMocks();
  });

  test('creates and attaches a city when publishing a manual place', async () => {
    const memory = await createMemory({
      content: '走过西湖边。',
      placeDetail: '杭州 · 西湖',
      writtenAt: new Date('2026-08-06T08:00:00Z'),
    });

    expect(mockPlaces).toHaveLength(1);
    expect(mockPlaces[0]).toMatchObject({
      name: '杭州',
      pinyin: 'HANGZHOU',
      type: 'visited',
    });
    expect(memory).toMatchObject({
      placeDetail: '杭州 · 西湖',
      placeId: mockPlaces[0].id,
    });
  });

  test('reuses an existing city instead of duplicating it', async () => {
    mockPlaces.push({
      id: 'existing-suzhou',
      name: '苏州',
      pinyin: 'SUZHOU',
    });

    const memory = await createMemory({
      content: '沿河多走十分钟。',
      placeDetail: '苏州市平江路',
    });

    expect(mockPlaces).toHaveLength(1);
    expect(memory.placeId).toBe('existing-suzhou');
  });

  test('keeps non-city details without creating false city statistics', async () => {
    const memory = await createMemory({
      content: '在窗边写字。',
      placeDetail: '窗边',
    });

    expect(mockPlaces).toHaveLength(0);
    expect(memory.placeId).toBeUndefined();
    expect(memory.placeDetail).toBe('窗边');
  });

  test('hydrates memory metadata from an existing city entity', async () => {
    mockPlaces.push({
      id: 'existing-harbin',
      name: '哈尔滨',
      pinyin: 'HAERBIN',
      region: '黑龙江',
      countryCode: 'CN',
    });

    const memory = await createMemory({
      content: '下雪了。',
      placeDetail: '哈尔滨',
    });

    expect(memory).toMatchObject({
      placeId: 'existing-harbin',
      placeCity: '哈尔滨',
      placeRegion: '黑龙江',
      placeCountryCode: 'CN',
    });
  });

  test('finds the latest valid city across unresolved newer memories', async () => {
    mockPlaces.push({
      id: 'existing-harbin',
      name: '哈尔滨',
      pinyin: 'HAERBIN',
      region: '黑龙江',
      countryCode: 'CN',
    });
    mockMemories.push(
      {
        id: 'unresolved',
        writtenAt: new Date('2026-08-06T09:00:00Z'),
      },
      {
        id: 'harbin',
        placeId: 'existing-harbin',
        writtenAt: new Date('2026-08-06T08:00:00Z'),
      },
    );

    await expect(getLatestRecognizedCity()).resolves.toEqual({
      name: '哈尔滨',
      pinyin: 'HAERBIN',
      region: '黑龙江',
      countryCode: 'CN',
    });
  });
});
