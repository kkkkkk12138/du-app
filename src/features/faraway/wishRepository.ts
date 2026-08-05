import {Q} from '@nozbe/watermelondb';

import {database} from '../../db/database';
import {Wish, WishTape} from '../../db/models';

export const wishTapeStyles = [
  'plain',
  'stripes',
  'blue',
  'green',
  'yellow',
  'vintage',
  'washi',
  'dots',
] as const;
export type WishTapeStyle = (typeof wishTapeStyles)[number];

export const wishCategories = [
  'place',
  'self',
  'time',
  'friend',
  'do',
  'habit',
] as const;
export type WishCategory = (typeof wishCategories)[number];

export type CreateWishInput = {
  userId: string;
  title: string;
  note?: string;
  color?: string;
  category?: WishCategory;
  targetAt?: Date;
};

export async function getWishes(userId?: string) {
  if (!userId) {
    return [];
  }
  return database
    .get<Wish>('wishes')
    .query(
      Q.where('user_id', userId),
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('pinned', Q.desc),
      Q.sortBy('updated_at', Q.desc),
    )
    .fetch();
}

export async function createWish({
  userId,
  title,
  note,
  color = 'yellow',
  category,
  targetAt,
}: CreateWishInput) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('念想需要一个名字');
  }
  const now = new Date();
  return database.write(() =>
    database.get<Wish>('wishes').create(wish => {
      wish.userId = userId;
      wish.title = normalizedTitle;
      wish.note = note?.trim() || undefined;
      wish.color = color;
      wish.category = category;
      wish.targetAt = targetAt;
      wish.status = 'open';
      wish.pinned = false;
      wish.createdAt = now;
      wish.updatedAt = now;
    }),
  );
}

export async function getWishTapes(wishId: string) {
  return database
    .get<WishTape>('wish_tapes')
    .query(
      Q.where('wish_id', wishId),
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.asc),
    )
    .fetch();
}

export async function createWishTape({
  wishId,
  text,
  style,
}: {
  wishId: string;
  text: string;
  style: WishTapeStyle;
}) {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('写一句再贴');
  }
  if (!wishTapeStyles.includes(style)) {
    throw new Error('胶带样式不可用');
  }
  await database.get<Wish>('wishes').find(wishId);
  const now = new Date();
  return database.write(() =>
    database.get<WishTape>('wish_tapes').create(tape => {
      tape.wishId = wishId;
      tape.text = normalizedText;
      tape.style = style;
      tape.createdAt = now;
      tape.updatedAt = now;
    }),
  );
}

export async function deleteWishTape(tapeId: string) {
  const tape = await database.get<WishTape>('wish_tapes').find(tapeId);
  return database.write(() =>
    tape.update(record => {
      const now = new Date();
      record.deletedAt = now;
      record.updatedAt = now;
    }),
  );
}

export async function updateWish({
  wishId,
  title,
  note,
  color,
  category,
  targetAt,
}: {
  wishId: string;
  title: string;
  note?: string;
  color: string;
  category?: WishCategory;
  targetAt?: Date;
}) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('念想需要一个名字');
  }
  const wish = await database.get<Wish>('wishes').find(wishId);
  return database.write(() =>
    wish.update(record => {
      record.title = normalizedTitle;
      record.note = note?.trim() || undefined;
      record.color = color;
      record.category = category;
      record.targetAt = targetAt;
      record.updatedAt = new Date();
    }),
  );
}

export async function setWishPinned(wishId: string, pinned: boolean) {
  const wish = await database.get<Wish>('wishes').find(wishId);
  return database.write(() =>
    wish.update(record => {
      record.pinned = pinned;
      record.updatedAt = new Date();
    }),
  );
}

export async function setWishFulfilled(wishId: string, fulfilled: boolean) {
  const wish = await database.get<Wish>('wishes').find(wishId);
  return database.write(() =>
    wish.update(record => {
      record.status = fulfilled ? 'fulfilled' : 'open';
      record.updatedAt = new Date();
    }),
  );
}

export async function deleteWish(wishId: string) {
  const wish = await database.get<Wish>('wishes').find(wishId);
  const tapes = await database
    .get<WishTape>('wish_tapes')
    .query(Q.where('wish_id', wishId), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  return database.write(async () => {
    const now = new Date();
    await wish.update(record => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
    await Promise.all(
      tapes.map(tape =>
        tape.update(record => {
          record.deletedAt = now;
          record.updatedAt = now;
        }),
      ),
    );
  });
}
