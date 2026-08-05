import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Book, Memory, Scrap } from '../../db/models';
import { appendScrapToBook } from './bookshelfRepository';

export type ScrapColor = 'white' | 'yellow' | 'pink' | 'blue' | 'green';
export type ScrapCardType = 'quote' | 'para' | 'line' | 'tag';
export type ScrapSourceType = 'diary' | 'letter' | 'book' | 'manual';
export type ScrapTapeColor = 'yellow' | 'blue' | 'pink';

export type ScrapSource = {
  id: string;
  text: string;
  label: string;
  sourceType: ScrapSourceType;
};

export const scrapColors: ScrapColor[] = [
  'white',
  'yellow',
  'pink',
  'blue',
  'green',
];

function cardTypeForText(text: string): ScrapCardType {
  const length = Array.from(text.trim()).length;
  if (length <= 4) {
    return 'tag';
  }
  if (length <= 18 && !text.includes('\n')) {
    return 'line';
  }
  if (length <= 48) {
    return 'quote';
  }
  return 'para';
}

function stableRotation(text: string) {
  const hash = Array.from(text).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 601,
    0,
  );
  return hash / 100 - 3;
}

const scrapSize: Record<ScrapCardType, { width: number; height: number }> = {
  tag: { width: 82, height: 82 },
  line: { width: 160, height: 40 },
  quote: { width: 152, height: 138 },
  para: { width: 182, height: 180 },
};

export function findAutomaticScrapPosition(
  scraps: Array<Pick<Scrap, 'cardType' | 'x' | 'y'>>,
  cardType: ScrapCardType,
  availableWidth = 390,
) {
  const size = scrapSize[cardType];
  const rightX = Math.max(18, availableWidth - size.width - 18);
  const columns = rightX - 18 > 80 ? [18, rightX] : [18];
  const overlaps = (x: number, y: number) =>
    scraps.some(scrap => {
      const existing = scrapSize[(scrap.cardType as ScrapCardType) ?? 'quote'];
      return (
        x < scrap.x + existing.width + 14 &&
        x + size.width + 14 > scrap.x &&
        y < scrap.y + existing.height + 18 &&
        y + size.height + 18 > scrap.y
      );
    });
  for (let y = 56; y < 10000; y += 24) {
    for (const x of columns) {
      if (!overlaps(x, y)) {
        return { x, y };
      }
    }
  }
  const lowest = scraps.reduce((value, scrap) => {
    const existing = scrapSize[(scrap.cardType as ScrapCardType) ?? 'quote'];
    return Math.max(value, scrap.y + existing.height);
  }, 56);
  return { x: 18, y: lowest + 24 };
}

export async function getScraps(userId?: string) {
  if (!userId) {
    return [];
  }
  return database
    .get<Scrap>('scraps')
    .query(
      Q.where('user_id', userId),
      Q.where('archived', false),
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.desc),
    )
    .fetch();
}

export async function getScrapSources(
  sourceType: Exclude<ScrapSourceType, 'manual'>,
): Promise<ScrapSource[]> {
  if (sourceType === 'book') {
    const [books, pages] = await Promise.all([
      database
        .get<Book>('books')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch(),
      database
        .get('book_pages')
        .query(Q.where('type', Q.oneOf(['content', 'quote'])))
        .fetch(),
    ]);
    return pages
      .flatMap(page => {
        const raw = page._raw as Record<string, unknown>;
        const book = books.find(item => item.id === raw.book_id);
        if (!book) {
          return [];
        }
        const text =
          typeof raw.text_content === 'string'
            ? raw.text_content
            : typeof raw.quote === 'string'
            ? raw.quote
            : '';
        return [
          {
            id: String(raw.id),
            text,
            label: book.title,
            sourceType: 'book' as const,
          },
        ];
      })
      .filter(source => Boolean(source.text.trim()));
  }

  const memories = await database
    .get<Memory>('memories')
    .query(
      Q.where('deleted', false),
      Q.where('status', Q.notEq('draft')),
      Q.sortBy('written_at', Q.desc),
    )
    .fetch();
  return memories
    .filter(memory => {
      const isLetter = memory.isFutureLetter || memory.type === 'reply';
      return sourceType === 'letter' ? isLetter : !isLetter;
    })
    .map(memory => ({
      id: memory.id,
      text: memory.content.trim(),
      label:
        sourceType === 'letter'
          ? '信'
          : `${
              memory.writtenAt.getMonth() + 1
            }.${memory.writtenAt.getDate()} 日迹`,
      sourceType,
    }))
    .filter(source => Boolean(source.text));
}

export async function createScrap({
  userId,
  text,
  sourceLabel,
  sourceType,
  sourceId,
  color,
  availableWidth,
}: {
  userId: string;
  text: string;
  sourceLabel: string;
  sourceType: ScrapSourceType;
  sourceId?: string;
  color: ScrapColor;
  availableWidth?: number;
}) {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('先写下或选中一段文字');
  }
  if (Array.from(normalized).length > 600) {
    throw new Error('一张散页最多保留 600 个字');
  }
  const now = new Date();
  const type = cardTypeForText(normalized);
  const existing = await database
    .get<Scrap>('scraps')
    .query(
      Q.where('user_id', userId),
      Q.where('archived', false),
      Q.where('deleted_at', Q.eq(null)),
    )
    .fetch();
  const position = findAutomaticScrapPosition(existing, type, availableWidth);
  const tapeColor =
    type === 'para' || type === 'quote'
      ? color === 'blue'
        ? 'blue'
        : color === 'pink'
        ? 'pink'
        : 'yellow'
      : undefined;
  return database.write(() =>
    database.get<Scrap>('scraps').create(record => {
      record.userId = userId;
      record.textContent = normalized;
      record.sourceLabel = sourceLabel.trim();
      record.sourceType = sourceType;
      record.sourceId = sourceId;
      record.color = color;
      record.cardType = type;
      record.x = position.x;
      record.y = position.y;
      record.rotation = stableRotation(normalized);
      record.tapeColor = tapeColor;
      record.hasLetterLine = color === 'blue';
      record.archived = false;
      record.createdAt = now;
      record.updatedAt = now;
    }),
  );
}

export async function updateScrapPosition(
  scrapId: string,
  x: number,
  y: number,
) {
  const scrap = await database.get<Scrap>('scraps').find(scrapId);
  await database.write(() =>
    scrap.update(record => {
      record.x = Math.max(8, x);
      record.y = Math.max(24, y);
      record.updatedAt = new Date();
    }),
  );
}

export async function rotateScrap(scrapId: string) {
  const scrap = await database.get<Scrap>('scraps').find(scrapId);
  await database.write(() =>
    scrap.update(record => {
      const next = record.rotation + 15;
      record.rotation = next > 10 ? -10 : next;
      record.updatedAt = new Date();
    }),
  );
  return scrap;
}

export async function recolorScrap(scrapId: string, color: ScrapColor) {
  const scrap = await database.get<Scrap>('scraps').find(scrapId);
  await database.write(() =>
    scrap.update(record => {
      record.color = color;
      record.hasLetterLine = color === 'blue';
      record.updatedAt = new Date();
    }),
  );
  return scrap;
}

export async function discardScrap(scrapId: string) {
  const scrap = await database.get<Scrap>('scraps').find(scrapId);
  await database.write(() =>
    scrap.update(record => {
      record.deletedAt = new Date();
      record.updatedAt = new Date();
    }),
  );
  return scrap;
}

export async function undoDiscardScrap(scrapId: string) {
  const scrap = await database.get<Scrap>('scraps').find(scrapId);
  await database.write(() =>
    scrap.update(record => {
      record.deletedAt = undefined;
      record.updatedAt = new Date();
    }),
  );
}

export async function archiveScrapInBook(scrapId: string, bookId: string) {
  const scrap = await database.get<Scrap>('scraps').find(scrapId);
  await appendScrapToBook(
    {
      bookId,
      scrapId,
      text: scrap.textContent,
      sourceLabel: scrap.sourceLabel,
    },
    () =>
      scrap.update(record => {
        record.archived = true;
        record.sourceBookId = bookId;
        record.updatedAt = new Date();
      }),
  );
}
