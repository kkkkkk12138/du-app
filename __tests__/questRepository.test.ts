const mockCollections: Record<string, any[]> = {
  quests: [],
  quest_nodes: [],
  quest_edges: [],
  quest_stickies: [],
};

import RNFS from 'react-native-fs';

function mockMakeRecord(table: string) {
  const records = mockCollections[table];
  const record: any = {
    id: `${table}-${records.length + 1}`,
    update: async (change: (item: any) => void) => change(record),
    prepareUpdate: (change: (item: any) => void) => {
      change(record);
      return record;
    },
  };
  return record;
}

jest.mock('../src/db/database', () => ({
  database: {
    write: jest.fn((work: () => unknown) => work()),
    batch: jest.fn(async () => undefined),
    get: jest.fn((table: string) => ({
      create: jest.fn(async (initialize: (record: any) => void) => {
        const record = mockMakeRecord(table);
        initialize(record);
        mockCollections[table].push(record);
        return record;
      }),
      find: jest.fn(async (id: string) => {
        const record = mockCollections[table].find(item => item.id === id);
        if (!record) {
          throw new Error('not found');
        }
        return record;
      }),
      query: jest.fn(() => ({
        fetch: jest.fn(async () => [...mockCollections[table]]),
      })),
    })),
  },
}));

import {
  addQuestSticky,
  createQuest,
  createQuestEdge,
  createQuestNode,
  deleteQuest,
  deleteQuestNode,
  moveQuestNode,
  sortQuestNodesByCreatedAt,
} from '../src/features/faraway/questRepository';

beforeEach(() => {
  Object.values(mockCollections).forEach(records => {
    records.length = 0;
  });
});

test('creates a quest and keeps node coordinates inside the canvas origin', async () => {
  const quest = await createQuest({
    userId: 'user-1',
    title: '  北方路线  ',
  });
  const node = await createQuestNode({
    questId: quest.id,
    title: '  第一站  ',
    x: -40,
    y: -10,
  });

  expect(quest.title).toBe('北方路线');
  expect(node).toEqual(
    expect.objectContaining({ title: '第一站', x: 0, y: 0 }),
  );

  await moveQuestNode({ nodeId: node.id, x: -2, y: 96 });
  expect(node).toEqual(expect.objectContaining({ x: 0, y: 96 }));
});

test('moves an optional quest cover from draft storage into attachments', async () => {
  const quest = await createQuest({
    userId: 'user-1',
    title: '有封面的副本',
    coverImagePath: '/tmp/du-drafts/photo-cover.jpg',
  });

  expect(quest.coverMode).toBe('photo');
  expect(quest.coverImageAssetId).toContain('/du-attachments/photo-');
  expect(RNFS.copyFile).toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-cover.jpg',
    expect.stringContaining('/du-attachments/photo-'),
  );
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/du-drafts/photo-cover.jpg');
});

test('rejects duplicate undirected edges', async () => {
  const quest = await createQuest({ userId: 'user-1', title: '沿海' });
  const first = await createQuestNode({
    questId: quest.id,
    title: '厦门',
    x: 20,
    y: 20,
  });
  const second = await createQuestNode({
    questId: quest.id,
    title: '泉州',
    x: 120,
    y: 80,
  });

  await createQuestEdge({
    questId: quest.id,
    fromNodeId: first.id,
    toNodeId: second.id,
  });
  await expect(
    createQuestEdge({
      questId: quest.id,
      fromNodeId: second.id,
      toNodeId: first.id,
    }),
  ).rejects.toThrow('这两个节点已经连接');
});

test('soft-deletes a node with its edges and stickies', async () => {
  const quest = await createQuest({ userId: 'user-1', title: '旧路' });
  const first = await createQuestNode({
    questId: quest.id,
    title: '起点',
    x: 20,
    y: 20,
  });
  const second = await createQuestNode({
    questId: quest.id,
    title: '终点',
    x: 180,
    y: 80,
  });
  const edge = await createQuestEdge({
    questId: quest.id,
    fromNodeId: first.id,
    toNodeId: second.id,
  });
  const sticky = await addQuestSticky({
    questId: quest.id,
    nodeId: first.id,
    text: '在这里停过',
  });

  await deleteQuestNode(first.id);

  expect(first.deletedAt).toBeInstanceOf(Date);
  expect(edge.deletedAt).toBeInstanceOf(Date);
  expect(sticky.deletedAt).toBeInstanceOf(Date);
});

test('orders journal nodes by creation time instead of legacy map position', () => {
  const later = {
    id: 'later',
    x: 0,
    y: 0,
    createdAt: new Date(2026, 7, 2),
  } as any;
  const earlier = {
    id: 'earlier',
    x: 900,
    y: 1200,
    createdAt: new Date(2026, 7, 1),
  } as any;

  expect(
    sortQuestNodesByCreatedAt([later, earlier]).map(node => node.id),
  ).toEqual(['earlier', 'later']);
});

test('allows an example quest to be deleted with its contents', async () => {
  const quest = await createQuest({ userId: 'user-1', title: '走遍开罗' });
  quest.isTemplate = true;
  const node = await createQuestNode({
    questId: quest.id,
    title: '老城',
    x: 0,
    y: 0,
  });
  const sticky = await addQuestSticky({
    questId: quest.id,
    nodeId: node.id,
    text: '慢慢走',
  });

  await deleteQuest(quest.id);

  expect(quest.deletedAt).toBeInstanceOf(Date);
  expect(node.deletedAt).toBeInstanceOf(Date);
  expect(sticky.deletedAt).toBeInstanceOf(Date);
});
