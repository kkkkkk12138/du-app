import {localStorageKey, Q} from '@nozbe/watermelondb';

import {database} from './database';
import {Letter, Memory, Place, Tag} from './models';

const seedVersionKey = localStorageKey<number>('development_seed_version');
const seedVersion = 3;

const places = [
  {
    id: 'shanghai',
    name: '上海',
    chChar: '沪',
    pinyin: 'Shanghai',
    colorHex: '#C0392B',
    type: 'current',
    firstVisit: '2025-02-20',
    visitCount: 1,
    sortOrder: 100,
  },
  {
    id: 'changsha',
    name: '长沙',
    chChar: '长',
    pinyin: 'Changsha',
    colorHex: '#9AB8C8',
    type: 'hometown',
    firstVisit: '2000-01-01',
    lastVisit: '2024-10-15',
    visitCount: 20,
    sortOrder: 90,
  },
  {
    id: 'beijing',
    name: '北京',
    chChar: '京',
    pinyin: 'Beijing',
    colorHex: '#8FAA95',
    type: 'visited',
    firstVisit: '2025-10-03',
    lastVisit: '2026-02-15',
    visitCount: 4,
    sortOrder: 80,
  },
  {
    id: 'hangzhou',
    name: '杭州',
    chChar: '杭',
    pinyin: 'Hangzhou',
    colorHex: '#9AB8C8',
    type: 'visited',
    firstVisit: '2025-04-20',
    lastVisit: '2026-01-08',
    visitCount: 3,
    sortOrder: 70,
  },
  {
    id: 'chengdu',
    name: '成都',
    chChar: '蓉',
    pinyin: 'Chengdu',
    colorHex: '#C99B92',
    type: 'visited',
    firstVisit: '2025-12-18',
    lastVisit: '2025-12-23',
    visitCount: 1,
    sortOrder: 60,
  },
  {
    id: 'tokyo',
    name: '东京',
    chChar: '東',
    pinyin: 'Tokyo',
    colorHex: '#C0392B',
    type: 'visited',
    firstVisit: '2025-08-10',
    lastVisit: '2025-08-18',
    visitCount: 1,
    sortOrder: 50,
  },
];

const memories = [
  {
    id: 'seed-memory-project',
    type: 'text',
    content:
      '今天把项目交付了。没有想象中的如释重负，只是觉得，原来走到这里是这种感觉。',
    placeId: 'shanghai',
    placeDetail: '公司',
    tags: ['项目', '交付', '平静'],
    mood: 'calm',
    writtenAt: '2026-03-15T14:02:00+08:00',
  },
  {
    id: 'seed-memory-magnolia',
    type: 'anchor',
    content:
      '玉兰花又开了。公司楼下那棵树，去年来的时候就开过一次，今年居然又开了。',
    placeId: 'shanghai',
    placeDetail: '张江',
    tags: ['玉兰', '春天', '公司楼下', '一年'],
    mood: 'warm',
    writtenAt: '2026-03-12T12:30:00+08:00',
  },
  {
    id: 'seed-memory-home',
    type: 'note',
    content: '妈打电话来，问吃了没。说了句吃了，忽然鼻子有点酸。',
    placeId: 'shanghai',
    placeDetail: '家里',
    tags: ['妈妈', '想家', '电话'],
    mood: 'soft',
    writtenAt: '2026-03-14T22:14:00+08:00',
  },
  {
    id: 'seed-memory-letter',
    type: 'text',
    content: '你现在还好吗？还在上海吗？玉兰花应该开了吧……',
    placeId: 'shanghai',
    placeDetail: '张江',
    tags: ['玉兰', '春天', '未来信'],
    mood: 'soft',
    writtenAt: '2025-03-15T20:00:00+08:00',
  },
];

const tags = [
  ['weather', '风好大', '#9AB8C8', 'spring'],
  ['weather', '天晴了', '#D9A26B', ''],
  ['body', '困了', '#C99B92', ''],
  ['body', '手冰凉', '#9AB8C8', 'winter'],
  ['heart', '想家了', '#C0392B', ''],
  ['heart', '说不上来', '#8FAA95', ''],
] as const;

function toTimestamp(value?: string) {
  return value ? new Date(value).getTime() : undefined;
}

export async function seedDevelopmentData() {
  if (!__DEV__) {
    return;
  }

  const installedVersion = await database.localStorage.get(seedVersionKey);
  if (installedVersion === seedVersion) {
    return;
  }

  await database.write(async () => {
    if (!installedVersion) {
      for (const item of places) {
        await database.get<Place>('places').create(place => {
          place._raw.id = item.id;
          place.name = item.name;
          place.chChar = item.chChar;
          place.pinyin = item.pinyin;
          place.colorHex = item.colorHex;
          place.type = item.type;
          place.firstVisit = new Date(item.firstVisit);
          place.lastVisit = item.lastVisit
            ? new Date(item.lastVisit)
            : undefined;
          place.visitCount = item.visitCount;
          place.sortOrder = item.sortOrder;
        });
      }

      for (const item of memories.filter(
        memory => memory.id === 'seed-memory-letter',
      )) {
        await database.get<Memory>('memories').create(memory => {
          const timestamp = toTimestamp(item.writtenAt) ?? Date.now();
          memory._raw.id = item.id;
          memory.type = item.type;
          memory.content = item.content;
          memory.placeId = item.placeId;
          memory.placeDetail = item.placeDetail;
          memory.bodyTags = '[]';
          memory.heartTags = '[]';
          memory.customTags = JSON.stringify(item.tags);
          memory.mood = item.mood;
          memory.writtenAt = new Date(timestamp);
          memory.createdAt = new Date(timestamp);
          memory.updatedAt = new Date(timestamp);
          memory.isFutureLetter = item.id === 'seed-memory-letter';
          memory.letterId =
            item.id === 'seed-memory-letter'
              ? 'seed-letter-one-year'
              : undefined;
          memory.deleted = false;
        });
      }

      await database.get<Letter>('letters').create(letter => {
        letter._raw.id = 'seed-letter-one-year';
        letter.memoryId = 'seed-memory-letter';
        letter.sentAt = new Date('2025-03-15T20:00:00+08:00');
        letter.arriveDate = new Date('2026-03-15T00:00:00+08:00');
        letter.arriveType = 'one_year';
        letter.toType = 'future_self';
        letter.toName = '一年后的自己';
        letter.status = 'arrived';
      });

      for (const [category, text, colorHex, seasonHint] of tags) {
        await database.get<Tag>('tags').create(tag => {
          tag.category = category;
          tag.text = text;
          tag.colorHex = colorHex;
          tag.seasonHint = seasonHint || undefined;
          tag.sortOrder = 0;
        });
      }
    }

    const legacyDailyIds = [
      'seed-memory-project',
      'seed-memory-magnolia',
      'seed-memory-home',
      'seed-memory-photo-today',
      'seed-memory-audio-yesterday',
    ];
    const legacyMemories = await database
      .get<Memory>('memories')
      .query(Q.where('id', Q.oneOf(legacyDailyIds)))
      .fetch();
    const legacyUpdates = legacyMemories.map(memory =>
      memory.prepareUpdate(record => {
        record.deleted = true;
      }),
    );
    if (legacyUpdates.length) {
      await database.batch(...legacyUpdates);
    }

    const now = new Date();
    const today = (hours: number, minutes: number) =>
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
      );
    const yesterday = (hours: number, minutes: number) =>
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        hours,
        minutes,
      );
    const dailySeeds = [
      {
        id: 'seed-v3-photo-today',
        type: 'photo',
        content:
          '下班走出写字楼的时候，风很大。忽然想起小时候课本里写的“春风不度玉门关”，上海的风倒是毫不客气地度了我。',
        placeDetail: '陆家嘴 · 风很大',
        tags: ['车声很远', '脸有点凉', '恍惚'],
        photoTone: 'dusk',
        mood: 'intense',
        writtenAt: today(19, 24),
      },
      {
        id: 'seed-v3-project-today',
        type: 'text',
        content:
          '今天把项目交付了。没有想象中的如释重负，只是觉得，啊，原来走到这里是这种感觉。像走了很久的路，抬头发现已经过了桥。',
        placeDetail: '公司',
        tags: ['平静'],
        mood: 'calm',
        writtenAt: today(14, 2),
      },
      {
        id: 'seed-v3-audio-yesterday',
        type: 'audio',
        content:
          '一个人在江边坐了很久。对面外滩的灯亮起来的时候，忽然想起很多年前在电视上看到上海的夜晚……没想到自己真的站在这里了。',
        placeDetail: '外滩',
        tags: ['水声', '江水的味道', '说不出'],
        mood: 'soft',
        audioDuration: 12,
        writtenAt: yesterday(21, 37),
      },
      {
        id: 'seed-v3-note-yesterday',
        type: 'note',
        content: '妈打电话来，问吃了没。说了句吃了，忽然鼻子有点酸。',
        placeDetail: '家里',
        tags: ['想家'],
        mood: 'soft',
        writtenAt: yesterday(20, 14),
      },
      {
        id: 'seed-v3-tokyo-old',
        type: 'text',
        content:
          '在新宿的街头迷路了，但是一点都不着急。原来在陌生的地方，反而最自在。',
        placeDetail: '新宿',
        tags: ['夏夜', '霓虹灯', '自由'],
        mood: 'warm',
        writtenAt: new Date(now.getFullYear() - 1, 7, 15, 20, 10),
      },
      {
        id: 'seed-v3-dinner-old',
        type: 'text',
        content:
          '今天也是一个人吃的晚饭。在楼下便利店买了关东煮，站在路边吃完的。去年冬天也是这样，那时候觉得好孤独，今天倒觉得还好。人是会习惯的，习惯了就不苦了。',
        placeDetail: '小区门口',
        tags: ['一个人', '晚饭', '冬天'],
        mood: 'calm',
        writtenAt: new Date(now.getFullYear() - 1, 10, 8, 19, 20),
      },
      {
        id: 'seed-v3-anchor-march',
        type: 'anchor',
        content:
          '玉兰花又开了。公司楼下那棵树，去年来的时候就开过一次，今年居然又开了。我好像在这里已经一年了。',
        placeDetail: '张江',
        tags: ['玉兰', '春天', '一年'],
        mood: 'warm',
        writtenAt: new Date(now.getFullYear(), 2, 12, 12, 30),
      },
      {
        id: 'seed-v3-photo-march',
        type: 'photo',
        content: '楼下的玉兰，还是去年那棵。',
        placeDetail: '张江',
        tags: ['春天的味道', '释然'],
        photoTone: 'spring',
        mood: 'warm',
        writtenAt: new Date(now.getFullYear(), 2, 12, 12, 20),
      },
      {
        id: 'seed-v3-overtime-march',
        type: 'text',
        content:
          '今天加班到凌晨两点，走出公司的时候一个人都没有。打车回家，司机师傅说“小姑娘这么晚下班啊”，我说嗯。他说“年轻人别太累了”。我在后座差点哭出来。',
        placeDetail: '出租车',
        tags: ['电台在放老歌', '累'],
        mood: 'intense',
        writtenAt: new Date(now.getFullYear(), 2, 8, 2, 14),
      },
    ];

    for (const item of dailySeeds) {
      await database.get<Memory>('memories').create(memory => {
        memory._raw.id = item.id;
        memory.type = item.type;
        memory.content = item.content;
        memory.placeId = 'shanghai';
        memory.placeDetail = item.placeDetail;
        memory.audioDuration = item.audioDuration;
        memory.bodyTags = '[]';
        memory.heartTags = '[]';
        memory.customTags = JSON.stringify(item.tags);
        memory.photoTone = item.photoTone;
        memory.mood = item.mood;
        memory.writtenAt = item.writtenAt;
        memory.createdAt = now;
        memory.updatedAt = now;
        memory.isFutureLetter = false;
        memory.deleted = false;
      });
    }
  });

  await database.localStorage.set(seedVersionKey, seedVersion);
}
