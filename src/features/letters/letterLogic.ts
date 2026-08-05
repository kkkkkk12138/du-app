import type {Letter, Memory} from '../../db/models';

export type LetterWithMemory = {
  letter: Letter;
  memory: Memory;
};

export type LetterSections = {
  arriving: LetterWithMemory[];
  traveling: LetterWithMemory[];
  opened: LetterWithMemory[];
  tomorrowCount: number;
};

export type LetterFilter = 'all' | 'tomorrow' | 'traveling' | 'opened';

const OPENED_LETTER_RULE_SPACING = 32;
const OPENED_LETTER_MIN_RULES = 24;

export function getOpenedLetterRuleCount(bodyHeight: number) {
  return Math.max(
    OPENED_LETTER_MIN_RULES,
    Math.ceil(bodyHeight / OPENED_LETTER_RULE_SPACING) + 1,
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(date: Date, now = new Date()) {
  const target = startOfDay(date).getTime();
  const today = startOfDay(now).getTime();
  return Math.ceil((target - today) / 86_400_000);
}

export function getLetterProgress(letter: Letter, now = new Date()) {
  const total = letter.arriveDate.getTime() - letter.sentAt.getTime();
  if (total <= 0) {
    return 1;
  }
  return Math.max(
    0,
    Math.min(1, (now.getTime() - letter.sentAt.getTime()) / total),
  );
}

export function classifyLetters(
  items: LetterWithMemory[],
  now = new Date(),
): LetterSections {
  const arriving: LetterWithMemory[] = [];
  const traveling: LetterWithMemory[] = [];
  const opened: LetterWithMemory[] = [];

  for (const item of items) {
    if (item.letter.status === 'opened' || item.letter.openedAt) {
      opened.push(item);
    } else if (item.letter.arriveDate.getTime() <= now.getTime()) {
      arriving.push(item);
    } else {
      traveling.push(item);
    }
  }

  arriving.sort(
    (left, right) =>
      right.letter.arriveDate.getTime() - left.letter.arriveDate.getTime(),
  );
  traveling.sort(
    (left, right) =>
      left.letter.arriveDate.getTime() - right.letter.arriveDate.getTime(),
  );
  opened.sort(
    (left, right) =>
      (right.letter.openedAt?.getTime() ??
        right.letter.arriveDate.getTime()) -
      (left.letter.openedAt?.getTime() ?? left.letter.arriveDate.getTime()),
  );

  return {
    arriving,
    traveling,
    opened,
    tomorrowCount: traveling.filter(
      item => daysUntil(item.letter.arriveDate, now) === 1,
    ).length,
  };
}

export function filterLetterSections(
  sections: LetterSections,
  filter: LetterFilter,
  now = new Date(),
) {
  if (filter === 'tomorrow') {
    return {
      arriving: [],
      traveling: sections.traveling.filter(
        item => daysUntil(item.letter.arriveDate, now) === 1,
      ),
      opened: [],
    };
  }
  return {
    arriving: filter === 'all' ? sections.arriving : [],
    traveling:
      filter === 'all' || filter === 'traveling' ? sections.traveling : [],
    opened: filter === 'all' || filter === 'opened' ? sections.opened : [],
  };
}
