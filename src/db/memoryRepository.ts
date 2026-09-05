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
import {
  uploadOutboxRepository,
  type PendingUploadOutboxInput,
} from '../features/billing/uploadOutboxRepository';

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

export type MemoryPersistenceOptions = {
  localEntryId: string;
  outbox?: PendingUploadOutboxInput;
};

export type MemoryPersistenceResult = {
  memory: Memory;
  uploadJobId?: string;
};

export function createMemory(
  input: CreateMemoryInput,
): Promise<Memory>;
export function createMemory(
  input: CreateMemoryInput,
  options: MemoryPersistenceOptions,
): Promise<MemoryPersistenceResult>;
export async function createMemory(
  input: CreateMemoryInput,
  options?: MemoryPersistenceOptions,
): Promise<Memory | MemoryPersistenceResult> {
  const prepared: PreparedMediaFile[] = [];

  try {
    let draft: Memory | undefined;
    const existingId = input.draftId ?? options?.localEntryId;
    if (existingId) {
      try {
        draft = await database
          .get<Memory>('memories')
          .find(existingId);
      } catch {
        draft = undefined;
      }
    }
    const reuseCommittedMemory =
      options !== undefined &&
      draft !== undefined &&
      draft.status !== 'draft';
    if (reuseCommittedMemory && draft) {
      prepared.push(
        {path: draft.imagePath},
        {path: draft.audioPath},
        {path: draft.inkImagePath},
      );
    } else {
      prepared.push(
        await prepareMediaForPersistence(input.imagePath, 'photo', 'jpg'),
      );
      prepared.push(
        await prepareMediaForPersistence(input.audioPath, 'audio', 'wav'),
      );
      prepared.push(
        await prepareMediaForPersistence(
          input.inkImagePath,
          'ink',
          'png',
        ),
      );
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
    const result = await database.write(async () => {
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

      let memory: Memory;
      if (reuseCommittedMemory && draft) {
        memory = draft;
      } else if (draft?.status === 'draft') {
        await draft.update(apply);
        memory = draft;
      } else {
        memory = await database.get<Memory>('memories').create(record => {
          if (options?.localEntryId) {
            record._raw.id = options.localEntryId;
          }
          apply(record);
          record.createdAt = new Date(now);
        });
      }

      let uploadJobId: string | undefined;
      if (options?.outbox) {
        const paths = {
          photo: prepared[0].path,
          audio: prepared[1].path,
          ink: prepared[2].path,
        };
        const created = await uploadOutboxRepository.createJobInCurrentWriter({
          entryCommitId: options.outbox.entryCommitId,
          entryType: 'memory',
          localEntryId: memory.id,
          accountUid: options.outbox.accountUid,
          state: options.outbox.state,
          items: options.outbox.items.map(item => {
            const sourcePath = paths[item.mediaKind];
            if (!sourcePath) {
              throw new Error('上传媒体缺少持久化路径');
            }
            return {...item, sourcePath};
          }),
        });
        uploadJobId = created.job.id;
      }

      return {memory, uploadJobId};
    });
    await finalizePreparedMedia(prepared);
    return options ? result : result.memory;
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
