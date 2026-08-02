import {Q} from '@nozbe/watermelondb';

import {database} from '../../db/database';
import {Letter, Memory} from '../../db/models';
import {getRecentMemories} from '../../db/memoryRepository';

export type ArrivedLetter = {
  letter: Letter;
  memory: Memory;
  yearsAgo: number;
};

export type DailyData = {
  memories: Memory[];
  arrivedLetter: ArrivedLetter | null;
};

export async function getDailyData(now = new Date()): Promise<DailyData> {
  const [memories, letters] = await Promise.all([
    getRecentMemories(50),
    database
      .get<Letter>('letters')
      .query(
        Q.where('status', Q.oneOf(['arriving', 'arrived'])),
        Q.where('arrive_date', Q.lte(now.getTime())),
        Q.sortBy('arrive_date', Q.desc),
        Q.take(1),
      )
      .fetch(),
  ]);

  const letter = letters.find(item => {
    const elapsed = now.getTime() - item.arriveDate.getTime();
    return elapsed >= 0 && elapsed <= 86_400_000;
  });
  if (!letter) {
    return {memories, arrivedLetter: null};
  }

  try {
    const memory = await database
      .get<Memory>('memories')
      .find(letter.memoryId);
    const elapsedYears = Math.max(
      1,
      now.getFullYear() - letter.sentAt.getFullYear(),
    );

    return {
      memories,
      arrivedLetter: {
        letter,
        memory,
        yearsAgo: elapsedYears,
      },
    };
  } catch {
    return {memories, arrivedLetter: null};
  }
}
