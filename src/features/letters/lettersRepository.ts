import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Letter, Memory } from '../../db/models';
import { classifyLetters } from './letterLogic';

export {
  daysUntil,
  filterLetterSections,
  getLetterProgress,
} from './letterLogic';
export type {
  LetterFilter,
  LetterSections,
  LetterWithMemory,
} from './letterLogic';

export async function reconcileLetterArrivals(now = new Date()) {
  const traveling = await database
    .get<Letter>('letters')
    .query(
      Q.where('status', 'traveling'),
      Q.where('arrive_date', Q.lte(now.getTime())),
    )
    .fetch();

  const due = traveling.filter(
    letter =>
      letter.status === 'traveling' &&
      letter.arriveDate.getTime() <= now.getTime(),
  );

  if (!due.length) {
    return 0;
  }

  await database.write(() =>
    database.batch(
      ...due.map(letter =>
        letter.prepareUpdate(record => {
          record.status = 'arrived';
        }),
      ),
    ),
  );
  return due.length;
}

async function getDisplayedMemory(letter: Letter) {
  const memoryId =
    letter.status === 'reply' && letter.replyMemoryId
      ? letter.replyMemoryId
      : letter.memoryId;
  return database.get<Memory>('memories').find(memoryId);
}

export async function getLettersData(now = new Date()) {
  await reconcileLetterArrivals(now);
  const letters = await database
    .get<Letter>('letters')
    .query(Q.sortBy('arrive_date', Q.asc))
    .fetch();
  const items = await Promise.all(
    letters.map(async letter => ({
      letter,
      memory: await getDisplayedMemory(letter),
    })),
  );
  return classifyLetters(items, now);
}

export async function getLetterDetail(letterId?: string) {
  let letter: Letter;
  if (letterId) {
    letter = await database.get<Letter>('letters').find(letterId);
  } else {
    const arrived = await database
      .get<Letter>('letters')
      .query(
        Q.where('arrive_date', Q.lte(Date.now())),
        Q.sortBy('arrive_date', Q.desc),
        Q.take(1),
      )
      .fetch();
    if (!arrived[0]) {
      throw new Error('没有可拆的信');
    }
    letter = arrived[0];
  }
  const memory = await getDisplayedMemory(letter);
  return { letter, memory };
}

export async function markLetterOpened(letter: Letter) {
  if (letter.status === 'opened' && letter.openedAt) {
    return;
  }
  await database.write(async () => {
    await letter.update(record => {
      record.status = 'opened';
      record.openedAt = new Date();
    });
  });
}

export async function deleteLetter({
  letter,
  memory,
}: {
  letter: Letter;
  memory: Memory;
}) {
  await database.write(async () => {
    await database.batch(
      letter.prepareDestroyPermanently(),
      memory.prepareDestroyPermanently(),
    );
  });
}
