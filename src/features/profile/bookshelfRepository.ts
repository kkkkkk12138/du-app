import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Book, BookPage, Memory } from '../../db/models';
import {
  finalizePreparedMedia,
  prepareMediaForPersistence,
  removeMediaFile,
  rollbackPreparedMedia,
} from '../../services/mediaStorage';

export type BookCoverTemplate =
  | 'spring'
  | 'travel'
  | 'letter'
  | 'fragment'
  | 'night'
  | 'reading'
  | 'cafe'
  | 'draft';

export type BookCoverPalette = {
  bg: string;
  accent: string;
  text: string;
};

export type BookWithPages = {
  book: Book;
  pages: BookPage[];
};

export type BindableSource = {
  id: string;
  title: string;
  excerpt: string;
  date: Date;
  sourceType: 'diary' | 'letter';
  sourceLabel: string;
  decoration: 'mountain' | 'leaf';
};

type NewBookPage = {
  type: string;
  dateLabel?: string;
  textContent?: string;
  sourceType?: string;
  sourceId?: string;
  decoration?: string;
};

export const bookCoverTemplates: Array<{
  id: BookCoverTemplate;
  label: string;
  palette: BookCoverPalette;
}> = [
  {
    id: 'spring',
    label: '春岸',
    palette: { bg: '#F1D9D9', accent: '#8B4557', text: '#5B3340' },
  },
  {
    id: 'travel',
    label: '旅途',
    palette: { bg: '#B5C9B5', accent: '#3A5040', text: '#2E4034' },
  },
  {
    id: 'letter',
    label: '家信',
    palette: { bg: '#F0E8DA', accent: '#9BB0C4', text: '#3A332D' },
  },
  {
    id: 'fragment',
    label: '短句',
    palette: { bg: '#4A5D52', accent: '#C4A77D', text: '#F0EDE5' },
  },
  {
    id: 'night',
    label: '夜车',
    palette: { bg: '#9A8AAA', accent: '#3D3550', text: '#F7F0E8' },
  },
  {
    id: 'reading',
    label: '读记',
    palette: { bg: '#B5ADA5', accent: '#665D55', text: '#302B27' },
  },
  {
    id: 'cafe',
    label: '咖啡',
    palette: { bg: '#C4A090', accent: '#6F4E3D', text: '#3A2E25' },
  },
  {
    id: 'draft',
    label: '未成',
    palette: { bg: '#9BB0C4', accent: '#2F3E4E', text: '#F5F1EA' },
  },
];

export const suggestedBookCategories = ['2026', '歌词本', '诗集'] as const;

export function categoriesOf(book: Book): string[] {
  try {
    const parsed: unknown = JSON.parse(book.categories);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function bookMatchesFilter(book: Book, filter: string) {
  return filter === 'all' || categoriesOf(book).includes(filter);
}

export function bookContentPages(pages: BookPage[]) {
  return pages.filter(page => page.type === 'content' || page.type === 'quote');
}

export async function getBooks(userId?: string): Promise<BookWithPages[]> {
  if (!userId) {
    return [];
  }
  const books = await database
    .get<Book>('books')
    .query(
      Q.where('user_id', userId),
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.desc),
    )
    .fetch();
  const pages = await database
    .get<BookPage>('book_pages')
    .query(Q.sortBy('page_index', Q.asc))
    .fetch();
  return books.map(book => ({
    book,
    pages: pages.filter(page => page.bookId === book.id),
  }));
}

export async function getBindableSources(): Promise<BindableSource[]> {
  const memories = await database
    .get<Memory>('memories')
    .query(
      Q.where('deleted', false),
      Q.where('status', Q.notEq('draft')),
      Q.sortBy('written_at', Q.desc),
    )
    .fetch();
  return memories
    .filter(memory => Boolean(memory.content.trim()))
    .map(memory => {
      const sourceType =
        memory.isFutureLetter || memory.type === 'reply' ? 'letter' : 'diary';
      const title =
        memory.content
          .trim()
          .split(/\n/u)
          .find(line => line.trim())
          ?.slice(0, 22) ?? '无题';
      return {
        id: memory.id,
        title,
        excerpt: memory.content.trim(),
        date: memory.writtenAt,
        sourceType,
        sourceLabel:
          sourceType === 'letter'
            ? '信'
            : `${
                memory.writtenAt.getMonth() + 1
              }.${memory.writtenAt.getDate()} 日迹`,
        decoration: memory.placeId || memory.placeDetail ? 'mountain' : 'leaf',
      };
    });
}

export async function createBook({
  userId,
  title,
  subtitle,
  category,
  template,
  sourceIds,
  coverImagePath,
}: {
  userId: string;
  title: string;
  subtitle?: string;
  category: string;
  template: BookCoverTemplate;
  sourceIds: string[];
  coverImagePath?: string;
}) {
  const normalizedTitle = title.trim();
  const normalizedCategory = category.trim();
  if (!normalizedTitle) {
    throw new Error('书名不能为空');
  }
  if (!normalizedCategory) {
    throw new Error('请写下分类名称');
  }
  if (Array.from(normalizedCategory).length > 16) {
    throw new Error('分类名称最多 16 个字');
  }
  const sources = (await getBindableSources()).filter(source =>
    sourceIds.includes(source.id),
  );
  if (sourceIds.length && !sources.length) {
    throw new Error('所选文字已经不存在');
  }
  const selectedTemplate =
    bookCoverTemplates.find(item => item.id === template) ??
    bookCoverTemplates[0];
  const years = sources.map(source => source.date.getFullYear());
  const year = years.length
    ? String(Math.max(...years))
    : String(new Date().getFullYear());
  const now = new Date();
  const preparedCover = await prepareMediaForPersistence(
    coverImagePath,
    'photo',
    'jpg',
  );
  try {
    const book = await database.write(async () => {
      const createdBook = await database.get<Book>('books').create(record => {
        record.userId = userId;
        record.title = normalizedTitle;
        record.subtitle = subtitle?.trim() || normalizedCategory;
        record.year = year;
        record.categories = JSON.stringify([normalizedCategory]);
        record.coverTemplate = selectedTemplate.id;
        record.coverBg = selectedTemplate.palette.bg;
        record.coverAccent = selectedTemplate.palette.accent;
        record.coverText = selectedTemplate.palette.text;
        record.coverImagePath = preparedCover.path;
        record.spineWidth = 4 + Math.min(4, Math.floor(sources.length / 3));
        record.source = sources.length ? '装订' : '空册';
        record.currentPage = 0;
        record.createdAt = now;
        record.updatedAt = now;
      });

      const pages: NewBookPage[] = [
        { type: 'cover', decoration: selectedTemplate.id },
        { type: 'title', textContent: normalizedTitle, decoration: 'line' },
        ...sources
          .sort((left, right) => left.date.getTime() - right.date.getTime())
          .map(source => ({
            type: 'content',
            dateLabel: source.date.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            textContent: source.excerpt,
            sourceType: source.sourceType,
            sourceId: source.id,
            decoration: source.decoration,
          })),
        { type: 'back', textContent: '装订于渡', decoration: 'moon' },
      ];
      for (const [index, page] of pages.entries()) {
        await database.get<BookPage>('book_pages').create(record => {
          record.bookId = createdBook.id;
          record.pageIndex = index;
          record.type = page.type;
          record.dateLabel = page.dateLabel;
          record.textContent = page.textContent;
          record.decoration = page.decoration;
          record.sourceType = page.sourceType;
          record.sourceId = page.sourceId;
          record.createdAt = now;
        });
      }
      return createdBook;
    });
    await finalizePreparedMedia([preparedCover]);
    return book;
  } catch (error) {
    await rollbackPreparedMedia([preparedCover]);
    throw error;
  }
}

export async function updateBookProgress(bookId: string, pageIndex: number) {
  const book = await database.get<Book>('books').find(bookId);
  await database.write(() =>
    book.update(record => {
      record.currentPage = Math.max(0, pageIndex);
      record.updatedAt = new Date();
    }),
  );
}

export async function appendScrapToBook(
  {
    bookId,
    scrapId,
    text,
    sourceLabel,
  }: {
    bookId: string;
    scrapId: string;
    text: string;
    sourceLabel: string;
  },
  afterAppend?: () => Promise<unknown> | unknown,
) {
  const [book, pages] = await Promise.all([
    database.get<Book>('books').find(bookId),
    database
      .get<BookPage>('book_pages')
      .query(Q.where('book_id', bookId), Q.sortBy('page_index', Q.asc))
      .fetch(),
  ]);
  const back = pages.find(page => page.type === 'back');
  const insertIndex = back?.pageIndex ?? pages.length;
  await database.write(async () => {
    if (back) {
      await back.update(record => {
        record.pageIndex = insertIndex + 1;
      });
    }
    await database.get<BookPage>('book_pages').create(record => {
      record.bookId = bookId;
      record.pageIndex = insertIndex;
      record.type = 'quote';
      record.quote = text;
      record.author = sourceLabel;
      record.sourceType = 'scrap';
      record.sourceId = scrapId;
      record.decoration = 'line';
      record.createdAt = new Date();
    });
    await book.update(record => {
      if (record.source === '空册') {
        record.source = '散页';
      }
      record.updatedAt = new Date();
    });
    await afterAppend?.();
  });
}

export async function appendWritingToBook({
  bookId,
  eyebrow,
  pageId,
  text,
  placement = 'new-page',
}: {
  bookId: string;
  eyebrow?: string;
  pageId?: string;
  text: string;
  placement?: 'current-page' | 'new-page';
}) {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('先写下要续进书里的内容');
  }
  if (Array.from(normalized).length > 3000) {
    throw new Error('一次续写最多 3000 个字');
  }
  const normalizedEyebrow = eyebrow?.trim();
  if (normalizedEyebrow && Array.from(normalizedEyebrow).length > 40) {
    throw new Error('眉头最多 40 个字');
  }
  const [book, pages] = await Promise.all([
    database.get<Book>('books').find(bookId),
    database
      .get<BookPage>('book_pages')
      .query(Q.where('book_id', bookId), Q.sortBy('page_index', Q.asc))
      .fetch(),
  ]);
  if (placement === 'current-page') {
    const currentPage = pages.find(page => page.id === pageId);
    if (!currentPage || currentPage.type !== 'content') {
      throw new Error('这一页不能直接续写，请另起一页');
    }
    const now = new Date();
    await database.write(async () => {
      await currentPage.update(record => {
        const existing = record.textContent?.trim();
        record.textContent = existing
          ? `${existing}\n\n${normalized}`
          : normalized;
      });
      await book.update(record => {
        if (record.source === '空册') {
          record.source = '续写';
        }
        record.updatedAt = now;
      });
    });
    return;
  }
  const back = pages.find(page => page.type === 'back');
  const anchor = pages.find(page => page.id === pageId);
  const insertIndex =
    anchor && ['content', 'quote'].includes(anchor.type)
      ? anchor.pageIndex + 1
      : back?.pageIndex ?? pages.length;
  const laterPages = pages.filter(page => page.pageIndex >= insertIndex);
  const now = new Date();
  await database.write(async () => {
    await Promise.all(
      laterPages.map(page =>
        page.update(record => {
          record.pageIndex += 1;
        }),
      ),
    );
    await database.get<BookPage>('book_pages').create(record => {
      record.bookId = bookId;
      record.pageIndex = insertIndex;
      record.type = 'content';
      record.dateLabel = normalizedEyebrow;
      record.textContent = normalized;
      record.sourceType = 'writing';
      record.decoration = 'line';
      record.createdAt = now;
    });
    await book.update(record => {
      if (record.source === '空册') {
        record.source = '续写';
      }
      record.updatedAt = now;
    });
  });
}

export async function deleteBook(bookId: string) {
  const book = await database.get<Book>('books').find(bookId);
  const coverImagePath = book.coverImagePath;
  await database.write(() =>
    book.update(record => {
      record.deletedAt = new Date();
      record.coverImagePath = undefined;
      record.updatedAt = new Date();
    }),
  );
  await removeMediaFile(coverImagePath);
}

export async function deleteBookPage(bookId: string, pageId: string) {
  const [book, pages] = await Promise.all([
    database.get<Book>('books').find(bookId),
    database
      .get<BookPage>('book_pages')
      .query(Q.where('book_id', bookId), Q.sortBy('page_index', Q.asc))
      .fetch(),
  ]);
  const page = pages.find(item => item.id === pageId);
  if (!page || !['content', 'quote'].includes(page.type)) {
    throw new Error('这一页不能删除');
  }
  const laterPages = pages.filter(item => item.pageIndex > page.pageIndex);
  await database.write(async () => {
    await database.batch(
      page.prepareDestroyPermanently(),
      ...laterPages.map(item =>
        item.prepareUpdate(record => {
          record.pageIndex -= 1;
        }),
      ),
      book.prepareUpdate(record => {
        record.currentPage = Math.min(
          record.currentPage,
          Math.max(0, pages.length - 2),
        );
        record.source =
          bookContentPages(pages).length <= 1 ? '空册' : record.source;
        record.updatedAt = new Date();
      }),
    );
  });
}
