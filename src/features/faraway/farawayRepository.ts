import { Q } from '@nozbe/watermelondb';

import { database } from '../../db/database';
import { Memory, Place, User } from '../../db/models';
import {
  buildFarawayViewData,
  FarawayMemory,
  FarawayPlace,
  FarawayUser,
} from './farawayLogic';

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

export async function getFarawayData(anonymousId?: string, now = new Date()) {
  const [user, places, memories] = await Promise.all([
    getUser(anonymousId),
    database.get<Place>('places').query(Q.sortBy('sort_order', Q.desc)).fetch(),
    database
      .get<Memory>('memories')
      .query(
        Q.where('deleted', false),
        Q.where('is_future_letter', false),
        Q.sortBy('written_at', Q.desc),
      )
      .fetch(),
  ]);

  return buildFarawayViewData({
    user: user
      ? ({
          currentCityId: user.currentCityId,
          hometownId: user.hometownId,
          currentCityArrival: user.currentCityArrival,
        } satisfies FarawayUser)
      : undefined,
    places: places.map(
      place =>
        ({
          id: place.id,
          name: place.name,
          chChar: place.chChar,
          pinyin: place.pinyin,
          colorHex: place.colorHex,
          type: place.type,
          firstVisit: place.firstVisit,
          lastVisit: place.lastVisit,
          visitCount: place.visitCount,
          sortOrder: place.sortOrder,
        } satisfies FarawayPlace),
    ),
    memories: memories.map(
      memory =>
        ({
          id: memory.id,
          content: memory.content,
          placeId: memory.placeId,
          customTags: memory.customTags,
          writtenAt: memory.writtenAt,
        } satisfies FarawayMemory),
    ),
    now,
  });
}

export async function getFarawayMemory(memoryId: string) {
  const memory = await database.get<Memory>('memories').find(memoryId);

  if (memory.deleted || memory.isFutureLetter) {
    throw new Error('这条日迹已不可用');
  }

  return memory;
}
