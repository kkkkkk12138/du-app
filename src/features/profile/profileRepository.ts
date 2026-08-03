import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Letter, Memory, Place, User } from '../../db/models';

export type ProfileData = {
  nickname: string;
  avatarChar: string;
  daysSinceJoining: number;
  memoryCount: number;
  placeCount: number;
  letterCount: number;
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
  const [user, memoryCount, placeCount, letterCount] = await Promise.all([
    getUser(anonymousId),
    database
      .get<Memory>('memories')
      .query(Q.where('deleted', false), Q.where('is_future_letter', false))
      .fetchCount(),
    database.get<Place>('places').query().fetchCount(),
    database.get<Letter>('letters').query().fetchCount(),
  ]);

  return {
    nickname: user?.nickname ?? '渡河人',
    avatarChar: user?.avatarChar ?? '渡',
    daysSinceJoining: user?.createdAt
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
          ) + 1,
        )
      : 1,
    memoryCount,
    placeCount,
    letterCount,
  };
}

export async function updateProfile({
  anonymousId,
  nickname,
  avatarChar,
}: {
  anonymousId?: string;
  nickname: string;
  avatarChar: string;
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

  await database.write(() =>
    user.update(record => {
      record.nickname = nextNickname;
      record.avatarChar = nextAvatarChar;
    }),
  );
}
