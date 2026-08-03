import {
  buildFarawayViewData,
  calendarDaysBetween,
  formatPlaceDateRange,
} from '../src/features/faraway/farawayLogic';

const places = [
  {
    id: 'shanghai',
    name: '上海',
    chChar: '沪',
    pinyin: 'Shanghai',
    colorHex: '#C0392B',
    type: 'current',
    firstVisit: new Date(2025, 1, 20),
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
    firstVisit: new Date(2000, 0, 1),
    lastVisit: new Date(2026, 6, 1),
    visitCount: 20,
    sortOrder: 90,
  },
  {
    id: 'tokyo',
    name: '东京',
    chChar: '東',
    pinyin: 'Tokyo',
    colorHex: '#C0392B',
    type: 'visited',
    firstVisit: new Date(2025, 7, 10),
    lastVisit: new Date(2025, 7, 18),
    visitCount: 1,
    sortOrder: 50,
  },
];

test('counts local calendar days instead of elapsed 24-hour blocks', () => {
  expect(
    calendarDaysBetween(
      new Date(2026, 7, 2, 23, 55),
      new Date(2026, 7, 3, 0, 5),
    ),
  ).toBe(1);
});

test('formats a current stay and a completed visit range', () => {
  expect(formatPlaceDateRange(places[0])).toBe('2025.2 — 至今');
  expect(formatPlaceDateRange(places[2])).toBe('2025.8');
});

test('groups memories only through persisted place ids', () => {
  const data = buildFarawayViewData({
    user: {
      currentCityId: 'shanghai',
      hometownId: 'changsha',
      currentCityArrival: new Date(2025, 1, 20),
    },
    places,
    memories: [
      {
        id: 'shanghai-memory',
        content: '上海的一笔',
        placeId: 'shanghai',
        customTags: '["风","夜"]',
        writtenAt: new Date(2026, 7, 2),
      },
      {
        id: 'tokyo-memory',
        content: '东京的一笔',
        placeId: 'tokyo',
        customTags: '["迷路"]',
        writtenAt: new Date(2025, 7, 15),
      },
      {
        id: 'unassigned-memory',
        content: '正文提到东京，但没有地点关联',
        customTags: '["东京"]',
        writtenAt: new Date(2026, 7, 1),
      },
    ],
    now: new Date(2026, 7, 3),
  });

  expect(data.cityCount).toBe(3);
  expect(data.locatedMemoryCount).toBe(2);
  expect(data.yearsLabel).toBe('1年');
  expect(data.current?.memories.map(memory => memory.id)).toEqual([
    'shanghai-memory',
  ]);
  expect(data.visited[0].memories.map(memory => memory.id)).toEqual([
    'tokyo-memory',
  ]);
  expect(data.hometown?.memories).toHaveLength(0);
});
