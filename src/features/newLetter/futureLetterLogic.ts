export type ArrivalPreset = 'one_year' | 'half_year' | 'three_months' | 'custom';

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function addLocalMonths(date: Date, months: number) {
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getDate(),
    daysInMonth(targetYear, normalizedMonth),
  );
  return new Date(targetYear, normalizedMonth, targetDay);
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function minimumArrivalDate(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function getPresetArrivalDate(
  preset: Exclude<ArrivalPreset, 'custom'>,
  now = new Date(),
) {
  const months =
    preset === 'one_year' ? 12 : preset === 'half_year' ? 6 : 3;
  return startOfLocalDay(addLocalMonths(now, months));
}

export function getArrivalNotificationDate(
  arriveDate: Date,
  reminderTime = '09:00',
) {
  const [hours, minutes] = reminderTime
    .split(':')
    .map(value => Number.parseInt(value, 10));
  return new Date(
    arriveDate.getFullYear(),
    arriveDate.getMonth(),
    arriveDate.getDate(),
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
  );
}

export function formatArrivalDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
