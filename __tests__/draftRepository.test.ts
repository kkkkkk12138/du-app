const mockMemories: any[] = [];

function mockMakeMemory() {
  const record: any = {
    id: `draft-${mockMemories.length + 1}`,
    update: async (change: (item: any) => void) => change(record),
    destroyPermanently: async () => {
      const index = mockMemories.indexOf(record);
      if (index >= 0) {
        mockMemories.splice(index, 1);
      }
    },
  };
  return record;
}

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    get: jest.fn(() => ({
      create: jest.fn(async (initialize: (record: any) => void) => {
        const record = mockMakeMemory();
        initialize(record);
        mockMemories.push(record);
        return record;
      }),
      find: jest.fn(async (id: string) => {
        const record = mockMemories.find(item => item.id === id);
        if (!record) {
          throw new Error('not found');
        }
        return record;
      }),
      query: jest.fn(() => ({
        fetch: jest.fn(async () =>
          mockMemories
            .filter(item => item.status === 'draft' && !item.deleted)
            .sort(
              (left, right) =>
                right.updatedAt.getTime() - left.updatedAt.getTime(),
            ),
        ),
      })),
    })),
  },
}));

import {
  getDraftMediaPaths,
  getLatestWriteDraft,
  saveWriteDraft,
} from '../src/features/write/draftRepository';

beforeEach(() => {
  mockMemories.length = 0;
});

test('persists and restores the complete write draft', async () => {
  const saved = await saveWriteDraft({
    content: '还没有写完',
    isFuture: true,
    futureArriveAt: new Date(2027, 7, 4),
    futureArriveType: 'one_year',
    customTags: ['想念'],
    imagePath: '/tmp/du-drafts/photo-one.jpg',
    audioPath: '/tmp/du-drafts/audio-one.wav',
    audioDuration: 8,
    placeDetail: '31.23040, 121.47370',
  });

  await expect(getLatestWriteDraft()).resolves.toEqual(
    expect.objectContaining({
      id: saved?.id,
      content: '还没有写完',
      isFuture: true,
      futureArriveAt: new Date(2027, 7, 4),
      futureArriveType: 'one_year',
      customTags: ['想念'],
      imagePath: '/tmp/du-drafts/photo-one.jpg',
      audioDuration: 8,
    }),
  );
  await expect(getDraftMediaPaths()).resolves.toEqual([
    '/tmp/du-drafts/photo-one.jpg',
    '/tmp/du-drafts/audio-one.wav',
  ]);
});

test('removes the draft record when all editable content is cleared', async () => {
  const saved = await saveWriteDraft({
    content: '临时内容',
    isFuture: false,
    customTags: [],
  });

  await expect(
    saveWriteDraft(
      {
        content: '',
        isFuture: false,
        customTags: [],
      },
      saved?.id,
    ),
  ).resolves.toBeNull();
  await expect(getLatestWriteDraft()).resolves.toBeNull();
});
