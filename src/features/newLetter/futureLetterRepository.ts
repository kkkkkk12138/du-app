import { database } from '../../db/database';
import { Letter, Memory } from '../../db/models';
import type { FutureLetterDraft } from '../../navigation/RootNavigator';
import {
  finalizePreparedMedia,
  prepareMediaForPersistence,
  PreparedMediaFile,
  rollbackPreparedMedia,
} from '../../services/mediaStorage';
import type { ArrivalPreset } from './futureLetterLogic';

export async function createFutureLetter({
  draft,
  arriveDate,
  arriveType,
}: {
  draft: FutureLetterDraft;
  arriveDate: Date;
  arriveType: ArrivalPreset;
}) {
  const prepared: PreparedMediaFile[] = [];

  try {
    prepared.push(
      await prepareMediaForPersistence(draft.imagePath, 'photo', 'jpg'),
    );
    prepared.push(
      await prepareMediaForPersistence(draft.audioPath, 'audio', 'wav'),
    );
    prepared.push(
      await prepareMediaForPersistence(draft.inkImagePath, 'ink', 'png'),
    );
    let existingDraft: Memory | undefined;
    if (draft.draftId) {
      try {
        existingDraft = await database
          .get<Memory>('memories')
          .find(draft.draftId);
      } catch {
        existingDraft = undefined;
      }
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
      if (existingDraft?.status === 'draft') {
        await existingDraft.update(applyMemory);
        memory = existingDraft;
      } else {
        memory = await database.get<Memory>('memories').create(record => {
          applyMemory(record);
          record.createdAt = now;
        });
      }

      const letter = await database.get<Letter>('letters').create(record => {
        record.memoryId = memory.id;
        record.sentAt = now;
        record.arriveDate = arriveDate;
        record.arriveType = arriveType;
        record.toType = 'future_self';
        record.toName = '未来的自己';
        record.status = 'traveling';
      });

      await memory.update(record => {
        record.letterId = letter.id;
      });

      return { letter, memory };
    });
    await finalizePreparedMedia(prepared);
    return result;
  } catch (error) {
    await rollbackPreparedMedia(prepared);
    throw error;
  }
}
