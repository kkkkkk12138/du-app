import {
  getArrivalNotificationDate,
  getPresetArrivalDate,
  minimumArrivalDate,
} from '../src/features/newLetter/futureLetterLogic';

test('clamps month presets to the last valid local calendar day', () => {
  const date = getPresetArrivalDate(
    'three_months',
    new Date(2026, 0, 31, 22, 40),
  );

  expect(date).toEqual(new Date(2026, 3, 30));
});

test('handles leap-day one-year arrival without overflowing into March', () => {
  const date = getPresetArrivalDate(
    'one_year',
    new Date(2024, 1, 29, 8),
  );

  expect(date).toEqual(new Date(2025, 1, 28));
});

test('uses tomorrow as the earliest custom arrival date', () => {
  expect(minimumArrivalDate(new Date(2026, 11, 31, 23, 59))).toEqual(
    new Date(2027, 0, 1),
  );
});

test('schedules notification in device local time on arrival day', () => {
  const notificationDate = getArrivalNotificationDate(
    new Date(2027, 7, 2),
    '09:15',
  );

  expect(notificationDate).toEqual(new Date(2027, 7, 2, 9, 15));
});
