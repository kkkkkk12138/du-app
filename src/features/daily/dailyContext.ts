import {Solar} from 'lunar-javascript';

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

type SolarTerm = {
  name: string;
  imagery: string;
};

const solarTermImagery: Record<string, string> = {
  小寒: '腊梅初香',
  大寒: '水泽腹坚',
  立春: '东风解冻',
  雨水: '草木萌动',
  惊蛰: '雷声初动',
  春分: '昼夜等长',
  清明: '桐始华',
  谷雨: '雨生百谷',
  立夏: '蝼蝈鸣',
  小满: '麦粒渐满',
  芒种: '梅雨将至',
  夏至: '蝉始鸣',
  小暑: '温风至',
  大暑: '一年最热',
  立秋: '凉风至',
  处暑: '暑气渐消',
  白露: '露凝而白',
  秋分: '昼夜均',
  寒露: '菊有黄华',
  霜降: '柿子红',
  立冬: '水始冰',
  小雪: '初雪将至',
  大雪: '雪盛',
  冬至: '夜最长',
};

const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const chineseMonths = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

const seasonalDetails: Record<
  Season,
  {icon: string; flowers: readonly string[]; winds: readonly string[]}
> = {
  spring: {
    icon: '花',
    flowers: ['玉兰', '桃花', '樱花', '海棠', '牡丹', '桐花'],
    winds: ['东风解冻', '惠风和畅', '春风拂面'],
  },
  summer: {
    icon: '荷',
    flowers: ['栀子', '茉莉', '荷', '石榴花'],
    winds: ['南风悠悠', '荷风送香', '晚风微凉'],
  },
  autumn: {
    icon: '月',
    flowers: ['桂花', '菊', '彼岸花', '木槿'],
    winds: ['金风送爽', '西风落叶', '秋风清'],
  },
  winter: {
    icon: '雪',
    flowers: ['蜡梅', '水仙', '山茶', '梅'],
    winds: ['朔风凛凛', '北风其凉', '寒风侵肌'],
  },
};

function getSeason(date: Date): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return 'spring';
  }
  if (month >= 6 && month <= 8) {
    return 'summer';
  }
  if (month >= 9 && month <= 11) {
    return 'autumn';
  }
  return 'winter';
}

function getLunarContext(date: Date) {
  const lunar = Solar.fromDate(date).getLunar();
  const termName = lunar.getPrevJieQi(true).getName();
  const term: SolarTerm = {
    name: termName,
    imagery: solarTermImagery[termName] ?? termName,
  };

  return {
    lunar,
    term,
    lunarText: `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yi: lunar.getDayYi().slice(0, 3),
  };
}

export function getDailyContext(date = new Date()) {
  const season = getSeason(date);
  const {term, lunarText, yi} = getLunarContext(date);
  const details = seasonalDetails[season];
  const flower = details.flowers[(date.getDate() + date.getMonth()) % details.flowers.length];
  const wind = details.winds[date.getDate() % details.winds.length];
  const termGreetings: Record<string, [string, string, string, string]> = {
    大暑: ['大热天，', '躲起来写字', '吧。', '屋里开着空调写几句，最好'],
    立秋: ['秋风来了，', '落一笔', '吧。', '风的味道变了，你闻到了吗'],
    处暑: ['暑气散了，', '写几句', '给夏天。', '夏天要走了，留一笔吧'],
    白露: ['露从今夜白，', '写几笔', '吧。', '桂花香透了整条街'],
    秋分: ['半是秋光，', '落一笔', '吧。', '昼夜又等长了'],
  };
  const greeting = termGreetings[term.name] ?? [
    `${flower}正好，`,
    '落一笔',
    '吧。',
    '适合写几句给以后的自己',
  ];

  return {
    date,
    greeting: {
      prefix: greeting[0],
      accent: greeting[1],
      suffix: greeting[2],
    },
    headerDate: `${weekdays[date.getDay()]} · ${months[date.getMonth()]} ${date.getDate()}`,
    subtitle: greeting[3],
    phenology: {
      icon: details.icon,
      title: `${term.name} · ${term.imagery}`,
      detail: `${lunarText} · ${term.imagery} · ${wind}`,
      yi: `宜${yi.join('，宜')}`,
    },
  };
}

export function getSimilarityReason(date: Date, now = new Date()) {
  const yearsAgo = Math.max(1, now.getFullYear() - date.getFullYear());
  return `${yearsAgo}年前的${getLunarContext(date).term.name}`;
}

export function getSeasonalDistance(date: Date, now = new Date()) {
  const normalizedNow = new Date(2000, now.getMonth(), now.getDate());
  const normalizedDate = new Date(2000, date.getMonth(), date.getDate());
  const rawDays = Math.abs(
    (normalizedNow.getTime() - normalizedDate.getTime()) / 86_400_000,
  );
  return Math.min(rawDays, 365 - rawDays);
}

export function parseMemoryTags(value: string) {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

export function formatMemoryTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getMemorySectionLabel(date: Date, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (start.getTime() - target.getTime()) / 86_400_000,
  );

  if (dayDifference === 0) {
    return '今天';
  }
  if (dayDifference === 1) {
    return '昨天';
  }
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  ) {
    return '本月';
  }
  if (date.getFullYear() === now.getFullYear()) {
    return chineseMonths[date.getMonth()];
  }
  return `${date.getFullYear()}年${chineseMonths[date.getMonth()]}`;
}

export function groupMemoriesByDate<T extends {writtenAt: Date}>(
  memories: T[],
  now = new Date(),
) {
  const groups = new Map<string, T[]>();
  for (const memory of memories) {
    const title = getMemorySectionLabel(memory.writtenAt, now);
    groups.set(title, [...(groups.get(title) ?? []), memory]);
  }
  return Array.from(groups, ([title, data]) => ({title, data}));
}

export function formatMemoryDate(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}
