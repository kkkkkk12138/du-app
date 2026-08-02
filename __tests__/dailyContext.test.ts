import {
  getDailyContext,
  getMemorySectionLabel,
  groupMemoriesByDate,
  parseMemoryTags,
} from '../src/features/daily/dailyContext';

test('builds deterministic daily context for a known date', () => {
  const context = getDailyContext(new Date(2026, 7, 2, 14, 30));

  expect(context.greeting).toEqual({
    prefix: '大热天，',
    accent: '躲起来写字',
    suffix: '吧。',
  });
  expect(context.phenology.title).toBe('大暑 · 一年最热');
  expect(context.phenology.detail).toContain('丙午年六月二十');
  expect(context.phenology.yi).toBe('宜祭祀，宜沐浴，宜塑绘');
});

test('changes lunar date and solar term with the current date', () => {
  const springFestival = getDailyContext(new Date(2026, 1, 17, 12));
  const newYear = getDailyContext(new Date(2026, 0, 1, 12));

  expect(springFestival.phenology.detail).toContain('丙午年正月初一');
  expect(springFestival.phenology.title).toBe('立春 · 东风解冻');
  expect(newYear.phenology.detail).toContain('乙巳年冬月十三');
  expect(newYear.phenology.title).toBe('冬至 · 夜最长');
});

test('groups memory dates into human-readable sections', () => {
  const now = new Date(2026, 7, 2, 14, 30);

  expect(getMemorySectionLabel(new Date(2026, 7, 2), now)).toBe('今天');
  expect(getMemorySectionLabel(new Date(2026, 7, 1), now)).toBe('昨天');
  expect(getMemorySectionLabel(new Date(2026, 7, 10), now)).toBe('本月');
  expect(getMemorySectionLabel(new Date(2025, 2, 8), now)).toBe(
    '2025年三月',
  );
});

test('groups memories by written time instead of descriptive tags', () => {
  const now = new Date(2026, 7, 2, 14, 30);
  const memories = [
    {
      id: 'old-dinner',
      writtenAt: new Date(2025, 10, 8, 19),
      customTags: '["一个人","晚饭"]',
    },
    {
      id: 'today',
      writtenAt: new Date(2026, 7, 2, 9),
      customTags: '[]',
    },
  ];

  expect(groupMemoriesByDate(memories, now)).toEqual([
    {title: '2025年十一月', data: [memories[0]]},
    {title: '今天', data: [memories[1]]},
  ]);
});

test('parses stored tags defensively', () => {
  expect(parseMemoryTags('["春天","玉兰"]')).toEqual(['春天', '玉兰']);
  expect(parseMemoryTags('{invalid')).toEqual([]);
  expect(parseMemoryTags('{"tag":"春天"}')).toEqual([]);
});
