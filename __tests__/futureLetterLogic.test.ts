import {
  combineArrivalDateAndTime,
  getArrivalNotificationDate,
  getPresetArrivalDate,
  minimumArrivalDate,
} from '../src/features/newLetter/futureLetterLogic';

test('clamps month presets to the last valid local calendar day', () => {
  const date = getPresetArrivalDate('one_month', new Date(2026, 0, 31, 22, 40));

  expect(date).toEqual(new Date(2026, 1, 28, 22, 40));
});

test('handles leap-day one-year arrival without overflowing into March', () => {
  const date = getPresetArrivalDate('one_year', new Date(2024, 1, 29, 8, 12));

  expect(date).toEqual(new Date(2025, 1, 28, 8, 12));
});

test('uses tomorrow as the earliest custom arrival date', () => {
  expect(minimumArrivalDate(new Date(2026, 11, 31, 23, 59))).toEqual(
    new Date(2027, 0, 1, 23, 59),
  );
});

test('combines a chosen calendar date with minute-precision time', () => {
  expect(
    combineArrivalDateAndTime(
      new Date(2028, 4, 6, 0, 0),
      new Date(2026, 7, 5, 18, 37),
    ),
  ).toEqual(new Date(2028, 4, 6, 18, 37));
});

test('uses the upcoming birthday without retaining the birth year', () => {
  expect(
    getPresetArrivalDate(
      'next_birthday',
      new Date(2026, 7, 4, 14, 25),
      new Date(1995, 9, 12),
    ),
  ).toEqual(new Date(2026, 9, 12, 14, 25));
});

test('moves a birthday that already passed to the next year', () => {
  expect(
    getPresetArrivalDate(
      'next_birthday',
      new Date(2026, 10, 4, 9, 42),
      new Date(1995, 9, 12),
    ),
  ).toEqual(new Date(2027, 9, 12, 9, 42));
});

test('schedules notification at the exact letter arrival minute', () => {
  const notificationDate = getArrivalNotificationDate(
    new Date(2027, 7, 2, 18, 37),
  );

  expect(notificationDate).toEqual(new Date(2027, 7, 2, 18, 37));
});
