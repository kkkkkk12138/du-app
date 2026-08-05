import { localStorageKey } from '@nozbe/watermelondb';

import { database } from './database';
import {
  Book,
  BookPage,
  Letter,
  Memory,
  Place,
  Quest,
  QuestNode,
  QuestSticky,
  Scrap,
  Wish,
  WishTape,
} from './models';

const productExamplesSeededKey = localStorageKey<number>(
  'product_examples_seeded',
);
const productExamplesVersion = 4;

export const productExampleManifest = {
  memories: 6,
  letters: 4,
  wishes: 3,
  quests: 3,
  books: 3,
  scraps: 12,
} as const;

const literaryBookSeeds = [
  {
    template: 'spring',
    title: '二〇二六',
    subtitle: '这一年的来处与去处',
    category: '2026',
    background: '#F1D9D9',
    accent: '#8B4557',
    text: '#5B3340',
    pages: [
      {
        label: '一月 · 起笔',
        text: '年初没有许很大的愿。\n只在新日历的背面写：把匆忙还给钟表，把清醒留给自己。\n\n窗外有人拖着行李经过，轮子在石板上发出短促的声响。新的一年，就这样从门缝里进来了。',
      },
      {
        label: '三月 · 风',
        text: '三月的风并不温柔，它把晾在阳台的衬衫吹得鼓起来，像一个人忽然想起远方。\n我没有出门，只把窗推开一点，让城市的声音在屋里停了十分钟。',
      },
      {
        label: '六月 · 小雨',
        text: '傍晚下了一场很轻的雨。\n公交车拐过旧电影院时，玻璃上的水把霓虹揉成一团。我第一次觉得，模糊也可以是一种诚实：看不清前路，却知道车仍在向前。',
      },
      {
        label: '九月 · 回程',
        text: '回程的票夹在书里，过了很久才被发现。\n纸角已经卷起，日期仍清楚。原来有些抵达不在站台发生，而是在往后的某一天，终于能平静地翻到那一页。',
      },
      {
        label: '十二月 · 留白',
        text: '这一年没有被总结成一句漂亮的话。\n有几件事完成了，几件事停在半路，还有一些名字慢慢不再提起。\n\n最后一页留白。不是因为无话可写，是想给明年的第一阵风留一个位置。',
      },
    ],
  },
  {
    template: 'reading',
    title: '歌词本',
    subtitle: '五首还没有旋律的歌',
    category: '歌词本',
    background: '#B5ADA5',
    accent: '#665D55',
    text: '#302B27',
    pages: [
      {
        label: '原创歌词 ·《灯还亮着》',
        text: '[主歌]\n楼下的店收起最后一把伞\n雨水沿招牌慢慢转弯\n我把没说完的话放在桌边\n让一盏灯替我等到明天\n\n[副歌]\n如果你经过这条街\n别急着问谁在想念\n灯还亮着，不是挽留\n只是有人还没写完告别',
      },
      {
        label: '原创歌词 ·《慢车》',
        text: '车窗一格一格\n剪开田野和夜色\n我们都没有睡\n假装终点还很远\n\n慢一点，再慢一点\n让站名从耳边轻轻滑过去\n天亮以前不谈以后\n只听铁轨把沉默唱成两行',
      },
      {
        label: '原创歌词 ·《潮汐信箱》',
        text: '[Verse]\n把信投进没有地址的海\n浪会替邮差辨认口袋\n\n[Chorus]\n涨潮时你离我近一些\n退潮后沙滩留下空白\n我没有追问海的答案\n只把名字写得比昨天更浅',
      },
      {
        label: '原创歌词 ·《厨房里的月亮》',
        text: '冰箱轻轻响了一夜\n水壶冒出白色的街\n你切开的橙子像小小月亮\n照着两只没来得及洗的碗\n\n日子没有宏大的和弦\n只有盐落下的一瞬间\n我们在厨房说天气\n却把一生说得很甜',
      },
      {
        label: '原创歌词 ·《没有寄出的副歌》',
        text: '我写了很多遍开头\n每一遍都绕回门口\n纸飞机飞不过走廊\n就停在旧鞋柜上\n\n这段副歌没有寄出\n也没有人替它结束\n等某天风从窗外来\n它会自己找到下一句',
      },
    ],
  },
  {
    template: 'fragment',
    title: '诗集',
    subtitle: '风从纸上经过',
    category: '诗集',
    background: '#4A5D52',
    accent: '#C4A77D',
    text: '#F0EDE5',
    pages: [
      {
        label: '现代诗 · 原创《旧站台》',
        text: '广播把一个地名\n念得很慢\n像怕惊动长椅上的灰\n\n列车已经走远\n风还在替每个人\n保管没有挥完的手',
      },
      {
        label: '现代诗 · 原创《植物知道》',
        text: '绿萝不知道星期几\n仍把新叶\n递向最亮的那块玻璃\n\n人却常常站在光里\n反复询问\n应该往哪里生长',
      },
      {
        label: '唐 · 李白《静夜思》',
        text: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
      },
      {
        label: '宋 · 李清照《如梦令·常记溪亭日暮》',
        text: '常记溪亭日暮，\n沉醉不知归路。\n兴尽晚回舟，\n误入藕花深处。\n争渡，争渡，\n惊起一滩鸥鹭。',
      },
      {
        label: '现代诗 · 原创《留白》',
        text: '纸没有催促我\n于是我也没有催促黄昏\n\n一只鸟从句号旁飞过\n没有留下解释\n\n剩下的空白\n刚好够明天\n放下一场小雨',
      },
    ],
  },
] as const;

async function retireLegacyLiteraryExamples() {
  const books = await database.get<Book>('books').query().fetch();
  const legacyBooks = books.filter(
    book =>
      book.id.startsWith('example-book-') &&
      !book.id.startsWith('example-book-v4-') &&
      !book.deletedAt,
  );
  await database.write(async () => {
    for (const book of legacyBooks) {
      await book.update(record => {
        record.deletedAt = new Date();
        record.updatedAt = new Date();
      });
    }
  });
}

async function seedLiteraryExamples(
  userId: string,
  now: Date,
  includeScraps = true,
) {
  const memories = await database.get<Memory>('memories').query().fetch();
  await database.write(async () => {
    for (const [index, seed] of literaryBookSeeds.entries()) {
      const bookId = `example-book-v4-${index + 1}`;
      await database.get<Book>('books').create(record => {
        record._raw.id = bookId;
        record.userId = userId;
        record.title = seed.title;
        record.subtitle = seed.subtitle;
        record.year = '2026';
        record.categories = JSON.stringify([seed.category]);
        record.coverTemplate = seed.template;
        record.coverBg = seed.background;
        record.coverAccent = seed.accent;
        record.coverText = seed.text;
        record.spineWidth = 4 + (index % 4);
        record.source = '范例书';
        record.currentPage = 0;
        record.createdAt = relativeDate(now, -20 + index, 9, 0);
        record.updatedAt = relativeDate(now, -20 + index, 9, 0);
      });
      const pages = [
        { type: 'cover', text: undefined, label: undefined },
        { type: 'title', text: seed.title, label: undefined },
        ...seed.pages.map(page => ({
          type: 'content',
          text: page.text,
          label: page.label,
        })),
        { type: 'back', text: '装订于渡', label: undefined },
      ];
      for (const [pageIndex, page] of pages.entries()) {
        await database.get<BookPage>('book_pages').create(record => {
          record._raw.id = `${bookId}-page-${pageIndex + 1}`;
          record.bookId = bookId;
          record.pageIndex = pageIndex;
          record.type = page.type;
          record.textContent = page.text;
          record.dateLabel = page.label;
          record.sourceType =
            page.type === 'content' ? 'example-book' : undefined;
          record.decoration = 'leaf';
          record.createdAt = relativeDate(now, -20 + index, 9, pageIndex);
        });
      }
    }

    if (!includeScraps) {
      return;
    }
    const sourceMemories = memories.filter(
      memory => memory.status !== 'draft' && !memory.deleted && memory.content,
    );
    const snippets = sourceMemories.flatMap(memory =>
      memory.content
        .split(/[。\n]/u)
        .map(text => text.trim())
        .filter(text => Array.from(text).length >= 4)
        .map(text => ({ memory, text: `${text}。` })),
    );
    const colors = ['yellow', 'white', 'pink', 'blue', 'green'] as const;
    for (let index = 0; index < Math.min(12, snippets.length); index += 1) {
      const { memory, text } = snippets[index];
      await database.get<Scrap>('scraps').create(record => {
        record._raw.id = `example-scrap-${index + 1}`;
        record.userId = userId;
        record.textContent = text;
        record.sourceLabel = memory.isFutureLetter
          ? '旧信'
          : `${
              memory.writtenAt.getMonth() + 1
            }.${memory.writtenAt.getDate()} 日迹`;
        record.sourceType = memory.isFutureLetter ? 'letter' : 'diary';
        record.sourceId = memory.id;
        record.color = colors[index % colors.length];
        record.cardType =
          Array.from(text).length <= 18
            ? 'line'
            : Array.from(text).length <= 46
            ? 'quote'
            : 'para';
        record.x = 18 + (index % 2) * 184 + ((index * 7) % 18);
        record.y = 56 + Math.floor(index / 2) * 190 + ((index * 13) % 34);
        record.rotation = ((index * 17) % 60) / 10 - 3;
        record.tapeColor =
          index % 3 === 0 ? 'yellow' : index % 3 === 1 ? 'blue' : undefined;
        record.hasLetterLine = record.color === 'blue';
        record.archived = false;
        record.createdAt = relativeDate(now, -12 + index, 10, index);
        record.updatedAt = relativeDate(now, -12 + index, 10, index);
      });
    }
  });
}

function relativeDate(
  now: Date,
  dayOffset: number,
  hours: number,
  minutes: number,
) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
    minutes,
  );
}

type MemorySeed = {
  id: string;
  type: string;
  content: string;
  writtenAt: Date;
  placeId?: string;
  placeDetail?: string;
  tags?: string[];
  mood?: string;
  status?: string;
  deleted?: boolean;
  isFutureLetter?: boolean;
  futureArriveAt?: Date;
  futureArriveType?: string;
  letterId?: string;
};

function applyMemorySeed(record: Memory, seed: MemorySeed, now: Date) {
  record._raw.id = seed.id;
  record.type = seed.type;
  record.content = seed.content;
  record.status = seed.status ?? 'published';
  record.placeId = seed.placeId;
  record.placeDetail = seed.placeDetail;
  record.bodyTags = '[]';
  record.heartTags = '[]';
  record.customTags = JSON.stringify(seed.tags ?? []);
  record.mood = seed.mood;
  record.writtenAt = seed.writtenAt;
  record.createdAt = now;
  record.updatedAt = now;
  record.isFutureLetter = seed.isFutureLetter ?? false;
  record.futureArriveAt = seed.futureArriveAt;
  record.futureArriveType = seed.futureArriveType;
  record.letterId = seed.letterId;
  record.deleted = seed.deleted ?? false;
}

export async function seedProductExamples(userId: string, now = new Date()) {
  const installedVersion = await database.localStorage.get(
    productExamplesSeededKey,
  );
  const installedVersionNumber = Number(installedVersion ?? 0);
  if (installedVersionNumber >= productExamplesVersion) {
    return false;
  }
  if ([1, 2, 3].includes(installedVersionNumber)) {
    await retireLegacyLiteraryExamples();
    await seedLiteraryExamples(userId, now, installedVersionNumber === 1);
    await database.localStorage.set(
      productExamplesSeededKey,
      productExamplesVersion,
    );
    return true;
  }

  const rainMemoryId = 'example-memory-rain-walk';
  const morningMemoryId = 'example-memory-quiet-morning';
  const replyMemoryId = 'example-memory-rain-reply';
  const arrivedMemoryId = 'example-memory-letter-arrived';
  const travelingMemoryId = 'example-memory-letter-traveling';
  const openedMemoryId = 'example-memory-letter-opened';

  const arrivedLetterId = 'example-letter-arrived';
  const travelingLetterId = 'example-letter-traveling';
  const openedLetterId = 'example-letter-opened';
  const replyLetterId = 'example-letter-reply';

  const arrivedAt = relativeDate(now, 0, 7, 42);
  const travelingAt = relativeDate(now, 31, 8, 26);
  const openedAt = relativeDate(now, -7, 21, 10);

  const memorySeeds: MemorySeed[] = [
    {
      id: rainMemoryId,
      type: 'text',
      content:
        '雨停在傍晚六点十七分。便利店门口的伞一把把合起来，叶尖还挂着水。我没有急着回去，沿河多走了十分钟。原来一天里，真的可以有一小段路，不用赶往任何地方。',
      placeId: 'example-place-hangzhou',
      placeDetail: '苏州 · 平江路',
      tags: ['雨后', '河边', '慢一点'],
      mood: 'soft',
      writtenAt: relativeDate(now, -1, 18, 17),
    },
    {
      id: morningMemoryId,
      type: 'anchor',
      content:
        '清晨醒得很早。窗帘缝里先亮了一线，屋里还没有声音。我烧了水，坐着等它沸腾，忽然觉得今天还没有被任何事情拿走。',
      placeDetail: '窗边',
      tags: ['清晨', '水沸之前', '留白'],
      mood: 'warm',
      writtenAt: relativeDate(now, 0, 6, 28),
    },
    {
      id: replyMemoryId,
      type: 'reply',
      content:
        '后来再经过那条河，我已经记不起那天在为什么发愁了。只记得雨后的风很轻，你替我多走的那十分钟，真的留了下来。',
      placeDetail: '同一条河的下游',
      writtenAt: relativeDate(now, 0, 20, 46),
      deleted: true,
    },
    {
      id: arrivedMemoryId,
      type: 'text',
      content:
        '展信安。\n\n写下这封信时，窗外也刚下过雨。我不知道你现在走到了哪里，只想问一句：那些总觉得来不及的事，后来真的有那么要紧吗？\n\n愿你仍肯为一阵风停下来，也仍能认出自己真正想去的方向。',
      placeDetail: '旧住处的书桌',
      tags: ['未来信', '雨后', '问候'],
      mood: 'soft',
      writtenAt: relativeDate(now, -365, 22, 14),
      isFutureLetter: true,
      futureArriveAt: arrivedAt,
      futureArriveType: 'one_year',
      letterId: arrivedLetterId,
    },
    {
      id: travelingMemoryId,
      type: 'text',
      content:
        '等这封信到达时，春天应该已经站稳了。希望你去看过一次真正安静的海，也希望你不再把休息当作需要解释的事情。',
      placeDetail: '夜班车最后一排',
      tags: ['未来信', '春天', '海'],
      mood: 'calm',
      writtenAt: relativeDate(now, -14, 23, 8),
      isFutureLetter: true,
      futureArriveAt: travelingAt,
      futureArriveType: 'custom',
      letterId: travelingLetterId,
    },
    {
      id: openedMemoryId,
      type: 'text',
      content:
        '那时的我总怕慢下来，就会被生活落在后面。\n\n现在想想，真正错过的，反而是那些匆匆走过却没有看清的傍晚。你不必一下子成为更好的人，先把今天过完整，就很好。',
      placeDetail: '去往南方的列车',
      tags: ['旧信', '慢下来', '傍晚'],
      mood: 'warm',
      writtenAt: relativeDate(now, -190, 19, 36),
      isFutureLetter: true,
      futureArriveAt: openedAt,
      futureArriveType: 'half_year',
      letterId: openedLetterId,
    },
  ];

  const questSeeds = [
    {
      id: 'example-quest-cairo',
      title: '走遍开罗',
      description: '把一座城拆成可以慢慢抵达的纸页。',
      color: '#B85C38',
      nodes: [
        ['抵达老城', '城', '先不赶景点，沿着旧街走到迷路。', 'yellow'],
        ['清晨看尼罗河', '河', '带一杯薄荷茶，在船声出现前坐一会儿。', 'blue'],
        ['逛哈利利市场', '市', '只带回一件真正会使用的东西。', 'orange'],
        ['去吉萨看落日', '日', '等游客散去，再看金字塔变成剪影。', 'pink'],
        ['写一封返程信', '信', '记录离开时最舍不得的一个声音。', 'green'],
      ],
    },
    {
      id: 'example-quest-poems',
      title: '写一本诗集',
      description: '不等灵感完整，先让零散句子有地方落脚。',
      color: '#8FAA95',
      nodes: [
        ['收集一百个句子', '句', '先记下，不判断它是不是诗。', 'yellow'],
        ['分成四个季节', '季', '让相近的天气和心事住在一起。', 'green'],
        ['删掉解释的话', '删', '留下画面、声音和停顿。', 'blue'],
        ['印十本小册子', '印', '送给真正读过这些日子的人。', 'purple'],
      ],
    },
    {
      id: 'example-quest-hotpot',
      title: '吃遍成都老火锅',
      description: '不做排行榜，只记每一锅的脾气。',
      color: '#C56D4E',
      nodes: [
        [
          '先找居民楼下的店',
          '巷',
          '菜单不必长，锅底要有自己的香气。',
          'orange',
        ],
        ['记一份蘸碟', '碟', '蒜泥、香油、蚝油，各家比例都不同。', 'yellow'],
        ['点一次冷门菜', '菜', '不只吃毛肚，也给陌生食材一次机会。', 'green'],
        ['问老板开了多少年', '问', '把店的来处写在味道旁边。', 'blue'],
        ['留下最后一锅', '锅', '等很久以后，再和重要的人回来。', 'pink'],
      ],
    },
  ] as const;

  await database.write(async () => {
    await database.get<Place>('places').create(place => {
      place._raw.id = 'example-place-hangzhou';
      place.name = '苏州';
      place.chChar = '苏';
      place.pinyin = 'Suzhou';
      place.colorHex = '#8FAA95';
      place.type = 'visited';
      place.firstVisit = relativeDate(now, -1, 0, 0);
      place.lastVisit = relativeDate(now, -1, 0, 0);
      place.visitCount = 1;
      place.sortOrder = 1;
    });

    for (const seed of memorySeeds) {
      await database.get<Memory>('memories').create(record => {
        applyMemorySeed(record, seed, now);
      });
    }

    const letterSeeds = [
      {
        id: arrivedLetterId,
        memoryId: arrivedMemoryId,
        sentAt: relativeDate(now, -365, 22, 14),
        arriveDate: arrivedAt,
        arriveType: 'one_year',
        toType: 'future_self',
        toName: '雨停之后的我',
        status: 'arrived',
      },
      {
        id: travelingLetterId,
        memoryId: travelingMemoryId,
        sentAt: relativeDate(now, -14, 23, 8),
        arriveDate: travelingAt,
        arriveType: 'custom',
        toType: 'future_self',
        toName: '明年春天的我',
        status: 'traveling',
      },
      {
        id: openedLetterId,
        memoryId: openedMemoryId,
        sentAt: relativeDate(now, -190, 19, 36),
        arriveDate: openedAt,
        arriveType: 'half_year',
        toType: 'future_self',
        toName: '那个总在赶路的我',
        status: 'opened',
        openedAt,
      },
      {
        id: replyLetterId,
        memoryId: rainMemoryId,
        sentAt: relativeDate(now, 0, 20, 46),
        arriveDate: relativeDate(now, 0, 20, 46),
        arriveType: 'reply',
        toType: 'memory_reply',
        toName: '雨停那天的自己',
        status: 'reply',
        openedAt: relativeDate(now, 0, 20, 46),
        replyMemoryId,
      },
    ];
    for (const seed of letterSeeds) {
      await database.get<Letter>('letters').create(record => {
        record._raw.id = seed.id;
        record.memoryId = seed.memoryId;
        record.sentAt = seed.sentAt;
        record.arriveDate = seed.arriveDate;
        record.arriveType = seed.arriveType;
        record.toType = seed.toType;
        record.toName = seed.toName;
        record.status = seed.status;
        record.openedAt = seed.openedAt;
        record.replyMemoryId = seed.replyMemoryId;
      });
    }

    const wishSeeds = [
      {
        id: 'example-wish-trees',
        title: '学会辨认二十四种树',
        note: '不只记住名字，也记住叶子的边缘、树皮和它最安静的季节。',
        color: 'green',
        category: 'habit',
        pinned: true,
        status: 'open',
      },
      {
        id: 'example-wish-morning',
        title: '把一整个清晨留给自己',
        note: '不开消息，不赶路，只做一顿慢一点的早餐。',
        color: 'yellow',
        category: 'self',
        pinned: false,
        status: 'open',
      },
      {
        id: 'example-wish-sea',
        title: '在入冬前去看一次海',
        note: '不是为了拍照，只想听一会儿浪退回去的声音。',
        color: 'blue',
        category: 'place',
        pinned: false,
        status: 'fulfilled',
      },
    ];
    for (const [index, seed] of wishSeeds.entries()) {
      await database.get<Wish>('wishes').create(record => {
        record._raw.id = seed.id;
        record.userId = userId;
        record.title = seed.title;
        record.note = seed.note;
        record.color = seed.color;
        record.category = seed.category;
        record.status = seed.status;
        record.pinned = seed.pinned;
        record.createdAt = relativeDate(now, -6 + index, 9, 0);
        record.updatedAt = relativeDate(now, -index, 9, 0);
      });
    }

    const tapeSeeds = [
      {
        id: 'example-wish-tape-trees',
        wishId: 'example-wish-trees',
        text: '从住处到地铁站，已经认出香樟、栾树和悬铃木。',
        style: 'green',
      },
      {
        id: 'example-wish-tape-morning',
        wishId: 'example-wish-morning',
        text: '先试一个没有闹钟的星期六。',
        style: 'washi',
      },
    ];
    for (const [index, seed] of tapeSeeds.entries()) {
      await database.get<WishTape>('wish_tapes').create(record => {
        record._raw.id = seed.id;
        record.wishId = seed.wishId;
        record.text = seed.text;
        record.style = seed.style;
        record.createdAt = relativeDate(now, -2 + index, 10, 0);
        record.updatedAt = relativeDate(now, -2 + index, 10, 0);
      });
    }

    for (const [questIndex, seed] of questSeeds.entries()) {
      const questDate = relativeDate(now, -12 + questIndex, 12, 0);
      await database.get<Quest>('quests').create(record => {
        record._raw.id = seed.id;
        record.userId = userId;
        record.title = seed.title;
        record.description = seed.description;
        record.themeColor = seed.color;
        record.coverMode = 'auto';
        // Product examples use normal records so every example stays deletable.
        record.isTemplate = false;
        record.createdAt = questDate;
        record.updatedAt = questDate;
      });

      for (const [nodeIndex, node] of seed.nodes.entries()) {
        const nodeId = `${seed.id}-node-${nodeIndex + 1}`;
        const nodeDate = relativeDate(now, -12 + questIndex, 12, nodeIndex);
        await database.get<QuestNode>('quest_nodes').create(record => {
          record._raw.id = nodeId;
          record.questId = seed.id;
          record.title = node[0];
          record.icon = node[1];
          record.x = 0;
          record.y = nodeIndex;
          record.createdAt = nodeDate;
          record.updatedAt = nodeDate;
        });
        await database.get<QuestSticky>('quest_stickies').create(record => {
          record._raw.id = `${nodeId}-sticky`;
          record.questId = seed.id;
          record.nodeId = nodeId;
          record.text = node[2];
          record.color = node[3];
          record.createdAt = nodeDate;
          record.updatedAt = nodeDate;
        });
      }
    }
  });

  await seedLiteraryExamples(userId, now);
  await database.localStorage.set(
    productExamplesSeededKey,
    productExamplesVersion,
  );
  return true;
}
