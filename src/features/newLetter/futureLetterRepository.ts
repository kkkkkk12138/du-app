import {Q} from '@nozbe/watermelondb';

import {database} from '../../db/database';
import {Letter, Memory} from '../../db/models';
import type {FutureLetterDraft} from '../../navigation/RootNavigator';
import {
  finalizePreparedMedia,
  prepareMediaForPersistence,
  PreparedMediaFile,
  rollbackPreparedMedia,
} from '../../services/mediaStorage';
import {
  uploadOutboxRepository,
  type PendingUploadOutboxInput,
} from '../billing/uploadOutboxRepository';
import type {ArrivalPreset} from './futureLetterLogic';

export type FutureLetterPersistenceOptions = {
  localEntryId: string;
  outbox?: PendingUploadOutboxInput;
};

export async function createFutureLetter({
  draft,
  arriveDate,
  arriveType,
}: {
  draft: FutureLetterDraft;
  arriveDate: Date;
  arriveType: ArrivalPreset;
}, options?: FutureLetterPersistenceOptions) {
  const prepared: PreparedMediaFile[] = [];

  try {
    let existingDraft: Memory | undefined;
    const existingId = draft.draftId ?? options?.localEntryId;
    if (existingId) {
      try {
        existingDraft = await database
          .get<Memory>('memories')
          .find(existingId);
      } catch {
        existingDraft = undefined;
      }
    }
    const reuseCommittedMemory =
      options !== undefined &&
      existingDraft !== undefined &&
      existingDraft.status !== 'draft';
    if (reuseCommittedMemory && existingDraft) {
      prepared.push(
        {path: existingDraft.imagePath},
        {path: existingDraft.audioPath},
        {path: existingDraft.inkImagePath},
      );
    } else {
      prepared.push(
        await prepareMediaForPersistence(draft.imagePath, 'photo', 'jpg'),
      );
      prepared.push(
        await prepareMediaForPersistence(draft.audioPath, 'audio', 'wav'),
      );
      prepared.push(
        await prepareMediaForPersistence(
          draft.inkImagePath,
          'ink',
          'png',
        ),
      );
    }
    const result = await database.write(async () => {
      const now = new Date();
      const applyMemory = (record: Memory) => {
        record.type = draft.type;
        record.content = draft.content;
        record.status = 'published';
        record.imagePath = prepared[0].path;
        record.audioPath = prepared[1].path;
        record.audioDuration = draft.audioDuration;
        record.inkImagePath = prepared[2].path;
        record.placeDetail = draft.placeDetail;
        record.placeCity = draft.placeCity?.name;
        record.placeRegion = draft.placeCity?.region;
        record.placeCountryCode = draft.placeCity?.countryCode;
        record.bodyTags = '[]';
        record.heartTags = '[]';
        record.customTags = JSON.stringify(draft.customTags);
        record.writtenAt = now;
        record.updatedAt = now;
        record.isFutureLetter = true;
        record.futureArriveAt = arriveDate;
        record.futureArriveType = arriveType;
        record.deleted = false;
      };
      let memory: Memory;
      if (reuseCommittedMemory && existingDraft) {
        memory = existingDraft;
      } else if (existingDraft?.status === 'draft') {
        await existingDraft.update(applyMemory);
        memory = existingDraft;
      } else {
        memory = await database.get<Memory>('memories').create(record => {
          if (options?.localEntryId) {
            record._raw.id = options.localEntryId;
          }
          applyMemory(record);
          record.createdAt = now;
        });
      }

      let letter: Letter | undefined;
      if (reuseCommittedMemory) {
        letter = (
          await database
            .get<Letter>('letters')
            .query(Q.where('memory_id', memory.id), Q.take(1))
            .fetch()
        ).find(item => item.memoryId === memory.id);
      }
      if (!letter) {
        letter = await database.get<Letter>('letters').create(record => {
          record.memoryId = memory.id;
          record.sentAt = now;
          record.arriveDate = arriveDate;
          record.arriveType = arriveType;
          record.toType = 'future_self';
          record.toName = '未来的自己';
          record.status = options?.outbox
            ? 'pending_upload'
            : 'pending_notification';
          record.notificationStatus = 'pending';
        });
      }

      await memory.update(record => {
        record.letterId = letter?.id;
      });

      let uploadJobId: string | undefined;
      if (options?.outbox) {
        const paths = {
          photo: prepared[0].path,
          audio: prepared[1].path,
          ink: prepared[2].path,
        };
        const created = await uploadOutboxRepository.createJobInCurrentWriter({
          entryCommitId: options.outbox.entryCommitId,
          entryType: 'future_letter',
          localEntryId: memory.id,
          letterId: letter.id,
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

      return {letter, memory, uploadJobId};
    });
    await finalizePreparedMedia(prepared);
    return result;
  } catch (error) {
    await rollbackPreparedMedia(prepared);
    throw error;
  }
}
