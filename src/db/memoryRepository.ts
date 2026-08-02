import {Q} from '@nozbe/watermelondb';

import {database} from './database';
import {Memory} from './models';

export type CreateMemoryInput = {
  content: string;
  type?: string;
  writtenAt?: Date;
  placeId?: string;
  placeDetail?: string;
  customTags?: string[];
  imagePath?: string;
  audioPath?: string;
  audioDuration?: number;
  inkImagePath?: string;
};

export async function createMemory(input: CreateMemoryInput) {
  return database.write(async () => {
    const now = Date.now();

    return database.get<Memory>('memories').create(memory => {
      memory.type = input.type ?? 'text';
      memory.content = input.content;
      memory.placeId = input.placeId;
      memory.placeDetail = input.placeDetail;
      memory.imagePath = input.imagePath;
      memory.audioPath = input.audioPath;
      memory.audioDuration = input.audioDuration;
      memory.inkImagePath = input.inkImagePath;
      memory.bodyTags = '[]';
      memory.heartTags = '[]';
      memory.customTags = JSON.stringify(input.customTags ?? []);
      memory.writtenAt = input.writtenAt ?? new Date(now);
      memory.createdAt = new Date(now);
      memory.updatedAt = new Date(now);
      memory.isFutureLetter = false;
      memory.deleted = false;
    });
  });
}

export async function getRecentMemories(limit = 20) {
  return database
    .get<Memory>('memories')
    .query(
      Q.where('deleted', false),
      Q.where('is_future_letter', false),
      Q.sortBy('written_at', Q.desc),
      Q.take(limit),
    )
    .fetch();
}

export async function verifyMemoryRoundTrip() {
  if (!__DEV__) {
    return;
  }

  const memory = await createMemory({
    content: '__database_round_trip__',
    type: 'note',
  });
  const fetched = await database.get<Memory>('memories').find(memory.id);

  if (fetched.content !== '__database_round_trip__') {
    throw new Error('Memory 写入后读取结果不一致');
  }

  await database.write(async () => {
    fetched.prepareDestroyPermanently();
    await database.batch(fetched);
  });
}
