import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Quest, QuestEdge, QuestNode, QuestSticky } from '../../db/models';
import {
  finalizePreparedMedia,
  prepareMediaForPersistence,
  removeMediaFile,
  rollbackPreparedMedia,
} from '../../services/mediaStorage';

export type QuestAggregate = {
  quest: Quest;
  nodes: QuestNode[];
  edges: QuestEdge[];
  stickies: QuestSticky[];
};

function isActive(record: { deletedAt?: Date }) {
  return !record.deletedAt;
}

export function sortQuestNodesByCreatedAt(nodes: QuestNode[]) {
  return [...nodes].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
}

async function touchQuest(questId: string, now = new Date()) {
  const quest = await database.get<Quest>('quests').find(questId);
  await quest.update(record => {
    record.updatedAt = now;
  });
}

export async function getQuestAggregates(userId?: string) {
  const [quests, nodes, edges, stickies] = await Promise.all([
    database
      .get<Quest>('quests')
      .query(
        ...(userId ? [Q.where('user_id', userId)] : []),
        Q.sortBy('updated_at', Q.desc),
      )
      .fetch(),
    database.get<QuestNode>('quest_nodes').query().fetch(),
    database.get<QuestEdge>('quest_edges').query().fetch(),
    database.get<QuestSticky>('quest_stickies').query().fetch(),
  ]);

  return quests.filter(isActive).map(quest => ({
    quest,
    nodes: sortQuestNodesByCreatedAt(
      nodes.filter(node => node.questId === quest.id && isActive(node)),
    ),
    edges: edges.filter(edge => edge.questId === quest.id && isActive(edge)),
    stickies: stickies.filter(
      sticky => sticky.questId === quest.id && isActive(sticky),
    ),
  }));
}

export async function createQuest({
  userId,
  title,
  description,
  themeColor = '#B85C38',
  coverImagePath,
}: {
  userId: string;
  title: string;
  description?: string;
  themeColor?: string;
  coverImagePath?: string;
}) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('副本名称不能为空');
  }
  const prepared = await prepareMediaForPersistence(
    coverImagePath,
    'photo',
    'jpg',
  );
  try {
    const quest = await database.write(() => {
      const now = new Date();
      return database.get<Quest>('quests').create(record => {
        record.userId = userId;
        record.title = normalizedTitle;
        record.description = description?.trim() || undefined;
        record.themeColor = themeColor;
        record.coverMode = prepared.path ? 'photo' : 'auto';
        record.coverImageAssetId = prepared.path;
        record.isTemplate = false;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
    await finalizePreparedMedia([prepared]);
    return quest;
  } catch (error) {
    await rollbackPreparedMedia([prepared]);
    throw error;
  }
}

export async function createQuestNode({
  questId,
  title,
  icon = '渡',
  x,
  y,
}: {
  questId: string;
  title: string;
  icon?: string;
  x: number;
  y: number;
}) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('节点名称不能为空');
  }
  return database.write(async () => {
    const now = new Date();
    const node = await database.get<QuestNode>('quest_nodes').create(record => {
      record.questId = questId;
      record.title = normalizedTitle;
      record.icon = icon;
      record.x = Math.max(0, x);
      record.y = Math.max(0, y);
      record.createdAt = now;
      record.updatedAt = now;
    });
    await touchQuest(questId, now);
    return node;
  });
}

export async function moveQuestNode({
  nodeId,
  x,
  y,
}: {
  nodeId: string;
  x: number;
  y: number;
}) {
  return database.write(async () => {
    const node = await database.get<QuestNode>('quest_nodes').find(nodeId);
    const now = new Date();
    await node.update(record => {
      record.x = Math.max(0, x);
      record.y = Math.max(0, y);
      record.updatedAt = now;
    });
    await touchQuest(node.questId, now);
    return node;
  });
}

export async function createQuestEdge({
  questId,
  fromNodeId,
  toNodeId,
  style = 'solid',
}: {
  questId: string;
  fromNodeId: string;
  toNodeId: string;
  style?: 'solid' | 'dashed';
}) {
  if (fromNodeId === toNodeId) {
    throw new Error('节点不能连接自己');
  }
  const [fromNode, toNode, existingEdges] = await Promise.all([
    database.get<QuestNode>('quest_nodes').find(fromNodeId),
    database.get<QuestNode>('quest_nodes').find(toNodeId),
    database
      .get<QuestEdge>('quest_edges')
      .query(Q.where('quest_id', questId))
      .fetch(),
  ]);
  if (
    fromNode.questId !== questId ||
    toNode.questId !== questId ||
    !isActive(fromNode) ||
    !isActive(toNode)
  ) {
    throw new Error('连接节点不属于当前副本');
  }
  const duplicate = existingEdges.some(
    edge =>
      isActive(edge) &&
      ((edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId) ||
        (edge.fromNodeId === toNodeId && edge.toNodeId === fromNodeId)),
  );
  if (duplicate) {
    throw new Error('这两个节点已经连接');
  }

  return database.write(async () => {
    const now = new Date();
    const edge = await database.get<QuestEdge>('quest_edges').create(record => {
      record.questId = questId;
      record.fromNodeId = fromNodeId;
      record.toNodeId = toNodeId;
      record.style = style;
      record.createdAt = now;
    });
    await touchQuest(questId, now);
    return edge;
  });
}

export async function addQuestSticky({
  questId,
  nodeId,
  text,
  color = 'yellow',
  memoryId,
}: {
  questId: string;
  nodeId: string;
  text: string;
  color?: 'yellow' | 'pink' | 'green' | 'blue' | 'purple' | 'orange';
  memoryId?: string;
}) {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('贴纸内容不能为空');
  }
  const node = await database.get<QuestNode>('quest_nodes').find(nodeId);
  if (node.questId !== questId || !isActive(node)) {
    throw new Error('节点不属于当前副本');
  }

  return database.write(async () => {
    const now = new Date();
    const sticky = await database
      .get<QuestSticky>('quest_stickies')
      .create(record => {
        record.questId = questId;
        record.nodeId = nodeId;
        record.text = normalizedText;
        record.color = color;
        record.memoryId = memoryId;
        record.createdAt = now;
        record.updatedAt = now;
      });
    await touchQuest(questId, now);
    return sticky;
  });
}

export async function deleteQuestEdge(edgeId: string) {
  const edge = await database.get<QuestEdge>('quest_edges').find(edgeId);
  const now = new Date();
  await database.write(async () => {
    await edge.update(record => {
      record.deletedAt = now;
    });
    await touchQuest(edge.questId, now);
  });
}

export async function deleteQuestSticky(stickyId: string) {
  const sticky = await database
    .get<QuestSticky>('quest_stickies')
    .find(stickyId);
  const now = new Date();
  await database.write(async () => {
    await sticky.update(record => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
    await touchQuest(sticky.questId, now);
  });
}

export async function deleteQuestNode(nodeId: string) {
  const node = await database.get<QuestNode>('quest_nodes').find(nodeId);
  const [edges, stickies] = await Promise.all([
    database
      .get<QuestEdge>('quest_edges')
      .query(Q.where('from_node_id', Q.oneOf([nodeId])))
      .fetch(),
    database
      .get<QuestSticky>('quest_stickies')
      .query(Q.where('node_id', nodeId))
      .fetch(),
  ]);
  const otherEdges = await database
    .get<QuestEdge>('quest_edges')
    .query(Q.where('to_node_id', nodeId))
    .fetch();
  const now = new Date();

  await database.write(async () => {
    await database.batch(
      node.prepareUpdate(record => {
        record.deletedAt = now;
        record.updatedAt = now;
      }),
      ...[...edges, ...otherEdges].filter(isActive).map(edge =>
        edge.prepareUpdate(record => {
          record.deletedAt = now;
        }),
      ),
      ...stickies.filter(isActive).map(sticky =>
        sticky.prepareUpdate(record => {
          record.deletedAt = now;
          record.updatedAt = now;
        }),
      ),
    );
    await touchQuest(node.questId, now);
  });
}

export async function deleteQuest(questId: string) {
  const quest = await database.get<Quest>('quests').find(questId);
  const coverImagePath = quest.coverImageAssetId;
  const [nodes, edges, stickies] = await Promise.all([
    database
      .get<QuestNode>('quest_nodes')
      .query(Q.where('quest_id', questId))
      .fetch(),
    database
      .get<QuestEdge>('quest_edges')
      .query(Q.where('quest_id', questId))
      .fetch(),
    database
      .get<QuestSticky>('quest_stickies')
      .query(Q.where('quest_id', questId))
      .fetch(),
  ]);
  const now = new Date();
  await database.write(() =>
    database.batch(
      quest.prepareUpdate(record => {
        record.deletedAt = now;
        record.updatedAt = now;
      }),
      ...nodes.filter(isActive).map(node =>
        node.prepareUpdate(record => {
          record.deletedAt = now;
          record.updatedAt = now;
        }),
      ),
      ...edges.filter(isActive).map(edge =>
        edge.prepareUpdate(record => {
          record.deletedAt = now;
        }),
      ),
      ...stickies.filter(isActive).map(sticky =>
        sticky.prepareUpdate(record => {
          record.deletedAt = now;
          record.updatedAt = now;
        }),
      ),
    ),
  );
  await removeMediaFile(coverImagePath);
}
