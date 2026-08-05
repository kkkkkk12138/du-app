export type ArrivalPreset =
  | 'one_month'
  | 'three_months'
  | 'half_year'
  | 'next_birthday'
  | 'one_year'
  | 'three_years'
  | 'five_years'
  | 'ten_years'
  | 'custom';

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
  return new Date(
    targetYear,
    normalizedMonth,
    targetDay,
    date.getHours(),
    date.getMinutes(),
  );
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function minimumArrivalDate(now = new Date()) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    now.getHours(),
    now.getMinutes(),
  );
}

export function combineArrivalDateAndTime(date: Date, time: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
  );
}

export function getPresetArrivalDate(
  preset: Exclude<ArrivalPreset, 'custom'>,
  now = new Date(),
  birthday?: Date,
) {
  if (preset === 'next_birthday') {
    if (!birthday) {
      throw new Error('需要先设置生日');
    }
    const today = startOfLocalDay(now);
    const birthdayInYear = (year: number) =>
      new Date(
        year,
        birthday.getMonth(),
        Math.min(birthday.getDate(), daysInMonth(year, birthday.getMonth())),
        now.getHours(),
        now.getMinutes(),
      );
    const thisYear = birthdayInYear(today.getFullYear());
    return thisYear > today
      ? thisYear
      : birthdayInYear(today.getFullYear() + 1);
  }
  const months = {
    one_month: 1,
    three_months: 3,
    half_year: 6,
    one_year: 12,
    three_years: 36,
    five_years: 60,
    ten_years: 120,
  }[preset];
  return addLocalMonths(now, months);
}

export function getArrivalNotificationDate(arriveDate: Date) {
  return new Date(arriveDate);
}

export function formatArrivalDate(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}年${
    date.getMonth() + 1
  }月${date.getDate()}日 ${hours}:${minutes}`;
}
