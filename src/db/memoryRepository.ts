import {Q} from '@nozbe/watermelondb';

import {database} from './database';
import {Memory} from './models';
import {getPlaceCity, resolvePlaceId} from './placeRepository';
import {
  recognizeCity,
  type RecognizedCity,
} from '../services/placeRecognition';
import {
  finalizePreparedMedia,
  prepareMediaForPersistence,
  PreparedMediaFile,
  rollbackPreparedMedia,
} from '../services/mediaStorage';

export type CreateMemoryInput = {
  draftId?: string;
  content: string;
  type?: string;
  writtenAt?: Date;
  placeId?: string;
  placeDetail?: string;
  placeCity?: RecognizedCity;
  customTags?: string[];
  imagePath?: string;
  audioPath?: string;
  audioDuration?: number;
  inkImagePath?: string;
};

export async function createMemory(input: CreateMemoryInput) {
  const prepared: PreparedMediaFile[] = [];

  try {
    prepared.push(
      await prepareMediaForPersistence(input.imagePath, 'photo', 'jpg'),
    );
    prepared.push(
      await prepareMediaForPersistence(input.audioPath, 'audio', 'wav'),
    );
    prepared.push(
      await prepareMediaForPersistence(input.inkImagePath, 'ink', 'png'),
    );
    let draft: Memory | undefined;
    if (input.draftId) {
      try {
        draft = await database.get<Memory>('memories').find(input.draftId);
      } catch {
        draft = undefined;
      }
    }
    const now = Date.now();
    const writtenAt = input.writtenAt ?? new Date(now);
    const placeCity =
      input.placeCity ?? recognizeCity(input.placeDetail);
    const placeId =
      input.placeId ??
      (await resolvePlaceId(input.placeDetail, writtenAt, placeCity));
    const storedPlaceCity = await getPlaceCity(placeId);
    const resolvedPlaceCity = storedPlaceCity ?? placeCity;
    const memory = await database.write(async () => {
      const apply = (record: Memory) => {
        record.type = input.type ?? 'text';
        record.content = input.content;
        record.status = 'published';
        record.placeId = placeId;
        record.placeDetail = input.placeDetail;
        record.placeCity = resolvedPlaceCity?.name;
        record.placeRegion = resolvedPlaceCity?.region;
        record.placeCountryCode = resolvedPlaceCity?.countryCode;
        record.imagePath = prepared[0].path;
        record.audioPath = prepared[1].path;
        record.audioDuration = input.audioDuration;
        record.inkImagePath = prepared[2].path;
        record.bodyTags = '[]';
        record.heartTags = '[]';
        record.customTags = JSON.stringify(input.customTags ?? []);
        record.writtenAt = writtenAt;
        record.updatedAt = new Date(now);
        record.isFutureLetter = false;
        record.futureArriveAt = undefined;
        record.futureArriveType = undefined;
        record.deleted = false;
      };

      if (draft?.status === 'draft') {
        await draft.update(apply);
        return draft;
      }

      return database.get<Memory>('memories').create(record => {
        apply(record);
        record.createdAt = new Date(now);
      });
    });
    await finalizePreparedMedia(prepared);
    return memory;
  } catch (error) {
    await rollbackPreparedMedia(prepared);
    throw error;
  }
}

export async function getRecentMemories(limit = 20) {
  return database
    .get<Memory>('memories')
    .query(
      Q.where('deleted', false),
      Q.where('is_future_letter', false),
      Q.where('status', Q.notEq('draft')),
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
