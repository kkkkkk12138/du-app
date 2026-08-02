import {database} from '../../db/database';
import {Letter, Memory} from '../../db/models';
import type {FutureLetterDraft} from '../../navigation/RootNavigator';
import {startOfLocalDay} from './futureLetterLogic';
import type {ArrivalPreset} from './futureLetterLogic';

export async function createFutureLetter({
  draft,
  arriveDate,
  arriveType,
}: {
  draft: FutureLetterDraft;
  arriveDate: Date;
  arriveType: ArrivalPreset;
}) {
  return database.write(async () => {
    const now = new Date();
    const memory = await database.get<Memory>('memories').create(record => {
      record.type = draft.type;
      record.content = draft.content;
      record.imagePath = draft.imagePath;
      record.audioPath = draft.audioPath;
      record.audioDuration = draft.audioDuration;
      record.inkImagePath = draft.inkImagePath;
      record.placeDetail = draft.placeDetail;
      record.bodyTags = '[]';
      record.heartTags = '[]';
      record.customTags = JSON.stringify(draft.customTags);
      record.writtenAt = now;
      record.createdAt = now;
      record.updatedAt = now;
      record.isFutureLetter = true;
      record.deleted = false;
    });

    const letter = await database.get<Letter>('letters').create(record => {
      record.memoryId = memory.id;
      record.sentAt = now;
      record.arriveDate = startOfLocalDay(arriveDate);
      record.arriveType = arriveType;
      record.toType = 'future_self';
      record.toName = '未来的自己';
      record.status = 'traveling';
    });

    await memory.update(record => {
      record.letterId = letter.id;
    });

    return {letter, memory};
  });
}
