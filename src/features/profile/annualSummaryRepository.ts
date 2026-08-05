import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Letter, Memory, Place } from '../../db/models';

export type AnnualSummary = {
  year: number;
  memoryCount: number;
  activeDayCount: number;
  placeCount: number;
  letterCount: number;
  openedLetterCount: number;
  topMonth?: number;
  topMonthCount: number;
  topPlace?: string;
  firstEntryAt?: Date;
  lastEntryAt?: Date;
};

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export async function getAnnualSummary(
  year = new Date().getFullYear(),
): Promise<AnnualSummary> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const [memories, letters, places] = await Promise.all([
    database
      .get<Memory>('memories')
      .query(
        Q.where('deleted', false),
        Q.where('is_future_letter', false),
        Q.where('status', Q.notEq('draft')),
        Q.where('written_at', Q.gte(start.getTime())),
        Q.where('written_at', Q.lt(end.getTime())),
        Q.sortBy('written_at', Q.asc),
      )
      .fetch(),
    database
      .get<Letter>('letters')
      .query(
        Q.where('sent_at', Q.gte(start.getTime())),
        Q.where('sent_at', Q.lt(end.getTime())),
      )
      .fetch(),
    database.get<Place>('places').query().fetch(),
  ]);

  const monthCounts = Array.from({ length: 12 }, () => 0);
  const activeDays = new Set<string>();
  const placeCounts = new Map<string, number>();
  const placeNames = new Map(places.map(place => [place.id, place.name]));

  memories.forEach(memory => {
    monthCounts[memory.writtenAt.getMonth()] += 1;
    activeDays.add(localDayKey(memory.writtenAt));
    if (memory.placeId && placeNames.has(memory.placeId)) {
      placeCounts.set(
        memory.placeId,
        (placeCounts.get(memory.placeId) ?? 0) + 1,
      );
    }
  });

  const topMonthCount = Math.max(0, ...monthCounts);
  const topMonthIndex = monthCounts.indexOf(topMonthCount);
  const topPlaceEntry = [...placeCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  return {
    year,
    memoryCount: memories.length,
    activeDayCount: activeDays.size,
    placeCount: placeCounts.size,
    letterCount: letters.length,
    openedLetterCount: letters.filter(letter => letter.openedAt).length,
    topMonth: topMonthCount > 0 ? topMonthIndex + 1 : undefined,
    topMonthCount,
    topPlace: topPlaceEntry ? placeNames.get(topPlaceEntry[0]) : undefined,
    firstEntryAt: memories[0]?.writtenAt,
    lastEntryAt: memories[memories.length - 1]?.writtenAt,
  };
}
