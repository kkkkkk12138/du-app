import {Letter, Memory} from '../src/db/models';
import {
  classifyLetters,
  daysUntil,
  getLetterProgress,
  LetterWithMemory,
} from '../src/features/letters/letterLogic';

function item({
  id,
  sentAt,
  arriveDate,
  status = 'traveling',
  openedAt,
}: {
  id: string;
  sentAt: Date;
  arriveDate: Date;
  status?: string;
  openedAt?: Date;
}): LetterWithMemory {
  return {
    letter: {
      id,
      sentAt,
      arriveDate,
      status,
      openedAt,
    } as Letter,
    memory: {id: `memory-${id}`, content: id} as Memory,
  };
}

test('counts calendar days without depending on the time of day', () => {
  const now = new Date(2026, 7, 2, 23, 50);

  expect(daysUntil(new Date(2026, 7, 3, 0, 5), now)).toBe(1);
  expect(daysUntil(new Date(2026, 7, 2, 0, 1), now)).toBe(0);
});

test('classifies opened letters before checking their arrival date', () => {
  const now = new Date(2026, 7, 2, 12);
  const openedFuture = item({
    id: 'opened-future',
    sentAt: new Date(2026, 6, 1),
    arriveDate: new Date(2026, 7, 10),
    status: 'opened',
    openedAt: new Date(2026, 7, 1),
  });
  const arrived = item({
    id: 'arrived',
    sentAt: new Date(2026, 6, 1),
    arriveDate: new Date(2026, 7, 2, 11),
  });
  const traveling = item({
    id: 'traveling',
    sentAt: new Date(2026, 7, 1),
    arriveDate: new Date(2026, 7, 3, 18),
  });

  const sections = classifyLetters(
    [traveling, arrived, openedFuture],
    now,
  );

  expect(sections.opened).toEqual([openedFuture]);
  expect(sections.arriving).toEqual([arrived]);
  expect(sections.traveling).toEqual([traveling]);
  expect(sections.tomorrowCount).toBe(1);
});

test('uses openedAt as an opened signal even with stale status', () => {
  const now = new Date(2026, 7, 2, 12);
  const stale = item({
    id: 'stale',
    sentAt: new Date(2026, 7, 1),
    arriveDate: new Date(2026, 7, 10),
    openedAt: new Date(2026, 7, 2),
  });

  expect(classifyLetters([stale], now).opened).toEqual([stale]);
});

test('clamps letter progress before departure and after arrival', () => {
  const letter = item({
    id: 'progress',
    sentAt: new Date(2026, 7, 1),
    arriveDate: new Date(2026, 7, 3),
  }).letter;

  expect(getLetterProgress(letter, new Date(2026, 6, 31))).toBe(0);
  expect(getLetterProgress(letter, new Date(2026, 7, 2))).toBe(0.5);
  expect(getLetterProgress(letter, new Date(2026, 7, 4))).toBe(1);
});
