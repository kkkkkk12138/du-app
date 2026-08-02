import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Letter, Memory } from '../../db/models';
import { startOfLocalDay } from '../newLetter/futureLetterLogic';
import { addMemoryDetailMonths } from './memoryDetailLogic';

export type MemoryDetailData = {
  replies: Memory[];
  stamp: Letter | null;
};

export async function getMemoryDetailData(
  memoryId: string,
): Promise<MemoryDetailData> {
  const links = await database
    .get<Letter>('letters')
    .query(Q.where('memory_id', memoryId))
    .fetch();

  const replies = (
    await Promise.all(
      links
        .filter(link => link.status === 'reply' && link.replyMemoryId)
        .map(async link => {
          try {
            return await database
              .get<Memory>('memories')
              .find(link.replyMemoryId!);
          } catch {
            return null;
          }
        }),
    )
  )
    .filter((reply): reply is Memory => Boolean(reply))
    .sort(
      (left, right) => left.writtenAt.getTime() - right.writtenAt.getTime(),
    );

  const stamp =
    links
      .filter(
        link =>
          link.toType === 'memory_future_self' && link.status !== 'cancelled',
      )
      .sort(
        (left, right) => right.sentAt.getTime() - left.sentAt.getTime(),
      )[0] ?? null;

  return { replies, stamp };
}

export async function createMemoryReply(memory: Memory, content: string) {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    throw new Error('回信内容不能为空');
  }

  return database.write(async () => {
    const now = new Date();
    const reply = await database.get<Memory>('memories').create(record => {
      record.type = 'reply';
      record.content = normalizedContent;
      record.bodyTags = '[]';
      record.heartTags = '[]';
      record.customTags = '[]';
      record.writtenAt = now;
      record.createdAt = now;
      record.updatedAt = now;
      record.isFutureLetter = false;
      // Replies belong to the parent detail thread, not the Daily timeline.
      record.deleted = true;
    });

    await database.get<Letter>('letters').create(record => {
      record.memoryId = memory.id;
      record.sentAt = now;
      record.arriveDate = now;
      record.arriveType = 'reply';
      record.toType = 'memory_reply';
      record.toName = '曾经的自己';
      record.status = 'reply';
      record.openedAt = now;
      record.replyMemoryId = reply.id;
    });

    return reply;
  });
}

export async function setMemoryStamp({
  memory,
  months,
  arriveOn,
  existingStamp,
}: {
  memory: Memory;
  months?: number;
  arriveOn?: Date;
  existingStamp: Letter | null;
}) {
  const now = new Date();
  const arriveDate = startOfLocalDay(
    arriveOn ?? addMemoryDetailMonths(now, months ?? 12),
  );
  const arriveType = arriveOn ? 'custom' : `${months ?? 12}_months`;

  return database.write(async () => {
    if (existingStamp) {
      await existingStamp.update(record => {
        record.sentAt = now;
        record.arriveDate = arriveDate;
        record.arriveType = arriveType;
        record.status = 'traveling';
        record.openedAt = undefined;
      });
      return existingStamp;
    }

    return database.get<Letter>('letters').create(record => {
      record.memoryId = memory.id;
      record.sentAt = now;
      record.arriveDate = arriveDate;
      record.arriveType = arriveType;
      record.toType = 'memory_future_self';
      record.toName = '未来的自己';
      record.status = 'traveling';
    });
  });
}

export async function removeMemoryStamp(stamp: Letter) {
  await database.write(async () => {
    await stamp.destroyPermanently();
  });
}
