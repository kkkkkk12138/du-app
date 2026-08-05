import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Letter, Memory, Place, Quest, User, Wish } from '../../db/models';
import {
  finalizePreparedMedia,
  prepareMediaForPersistence,
  removeMediaFile,
  rollbackPreparedMedia,
} from '../../services/mediaStorage';

export type ProfileData = {
  nickname: string;
  avatarChar: string;
  avatarPath?: string;
  birthday?: Date;
  daysSinceJoining: number;
  memoryCount: number;
  placeCount: number;
  letterCount: number;
  questCount: number;
  wishCount: number;
};

async function getUser(anonymousId?: string) {
  if (anonymousId) {
    try {
      return await database.get<User>('users').find(anonymousId);
    } catch {
      // 安全存储与数据库短暂不同步时，回退到本机唯一用户。
    }
  }
  const users = await database
    .get<User>('users')
    .query(Q.sortBy('created_at', Q.asc), Q.take(1))
    .fetch();
  return users[0];
}

export async function getProfileData(
  anonymousId?: string,
): Promise<ProfileData> {
  const [user, memories, places, letterCount, wishCount, questCount] =
    await Promise.all([
      getUser(anonymousId),
      database
        .get<Memory>('memories')
        .query(
          Q.where('deleted', false),
          Q.where('is_future_letter', false),
          Q.where('status', Q.notEq('draft')),
        )
        .fetch(),
      database.get<Place>('places').query().fetch(),
      database
        .get<Letter>('letters')
        .query(
          Q.or(
            Q.where('opened_at', Q.notEq(null)),
            Q.where('status', Q.oneOf(['opened', 'reply'])),
          ),
        )
        .fetchCount(),
      database
        .get<Wish>('wishes')
        .query(
          Q.where('deleted_at', Q.eq(null)),
          Q.where('status', Q.notEq('archived')),
        )
        .fetchCount(),
      database
        .get<Quest>('quests')
        .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_template', false))
        .fetchCount(),
    ]);
  const knownPlaceIds = new Set(places.map(place => place.id));
  const placeCount = new Set(
    memories
      .map(memory => memory.placeId)
      .filter(
        (placeId): placeId is string =>
          typeof placeId === 'string' && knownPlaceIds.has(placeId),
      ),
  ).size;

  return {
    nickname: user?.nickname ?? '渡河人',
    avatarChar: user?.avatarChar ?? '渡',
    avatarPath: user?.avatarPath,
    birthday: user?.birthday,
    daysSinceJoining: user?.createdAt
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
          ) + 1,
        )
      : 1,
    memoryCount: memories.length,
    placeCount,
    letterCount,
    questCount,
    wishCount,
  };
}

export async function updateProfile({
  anonymousId,
  nickname,
  avatarChar,
  avatarPath,
  birthday,
}: {
  anonymousId?: string;
  nickname: string;
  avatarChar: string;
  avatarPath?: string;
  birthday?: Date;
}) {
  const user = await getUser(anonymousId);
  if (!user) {
    throw new Error('本地身份尚未准备好');
  }

  const nextNickname = nickname.trim();
  const nextAvatarChar = Array.from(avatarChar.trim())[0];
  if (!nextNickname || !nextAvatarChar) {
    throw new Error('昵称和头像不能为空');
  }

  const previousAvatarPath = user.avatarPath;
  const prepared = await prepareMediaForPersistence(avatarPath, 'photo', 'jpg');

  try {
    await database.write(() =>
      user.update(record => {
        record.nickname = nextNickname;
        record.avatarChar = nextAvatarChar;
        record.avatarPath = prepared.path;
        record.birthday = birthday;
      }),
    );
    await finalizePreparedMedia([prepared]);
    if (previousAvatarPath && previousAvatarPath !== prepared.path) {
      await removeMediaFile(previousAvatarPath).catch(error => {
        console.warn('旧头像清理失败', error);
      });
    }
  } catch (error) {
    await rollbackPreparedMedia([prepared]);
    throw error;
  }
}
