import {
  addMemoryDetailMonths,
  formatReplySign,
  getMemoryDateContext,
} from '../src/features/daily/memoryDetailLogic';

test('clamps future stamp dates at the end of a shorter month', () => {
  expect(addMemoryDetailMonths(new Date(2026, 0, 31), 3)).toEqual(
    new Date(2026, 3, 30),
  );
});

test('keeps leap-day future stamps on the last valid February day', () => {
  expect(addMemoryDetailMonths(new Date(2024, 1, 29), 12)).toEqual(
    new Date(2025, 1, 28),
  );
});

test('builds the detail date header from the memory date', () => {
  expect(getMemoryDateContext(new Date(2026, 2, 12))).toEqual(
    expect.objectContaining({
      year: 2026,
      monthName: 'March',
      day: 12,
      weekday: '周四',
      seasonChar: '春',
    }),
  );
});

test('describes reply distance by local calendar days', () => {
  expect(
    formatReplySign(new Date(2026, 7, 2, 23, 50), new Date(2026, 7, 3, 0, 10)),
  ).toBe('一天后的你');
  expect(formatReplySign(new Date(2026, 7, 2), new Date(2026, 7, 9))).toBe(
    '一周后的你',
  );
});
