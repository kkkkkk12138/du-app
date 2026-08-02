import {
  formatReminderTime,
  normalizeReminderTime,
  reminderTimeToDate,
} from '../src/features/profile/reminderTimeLogic';

test('normalizes a valid persisted reminder time', () => {
  expect(normalizeReminderTime('07:05')).toBe('07:05');
  expect(normalizeReminderTime('23:59')).toBe('23:59');
});

test('falls back when a persisted reminder time is invalid', () => {
  expect(normalizeReminderTime('25:00')).toBe('09:00');
  expect(normalizeReminderTime('8:30')).toBe('09:00');
  expect(normalizeReminderTime('invalid', '10:15')).toBe('10:15');
});

test('converts reminder values without changing the local calendar day', () => {
  expect(reminderTimeToDate('18:45', new Date(2026, 7, 3, 2, 30))).toEqual(
    new Date(2026, 7, 3, 18, 45),
  );
});

test('formats picker values with leading zeroes', () => {
  expect(formatReminderTime(new Date(2026, 7, 3, 6, 7))).toBe('06:07');
});
