import { Solar } from 'lunar-javascript';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function addMemoryDetailMonths(date: Date, months: number) {
  const targetMonth = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(date.getDate(), daysInMonth(year, month));
  return new Date(year, month, day);
}

export function getMemoryDateContext(date: Date) {
  const lunar = Solar.fromDate(date).getLunar();
  const month = date.getMonth();
  const seasonChar =
    month >= 2 && month <= 4
      ? '春'
      : month >= 5 && month <= 7
      ? '夏'
      : month >= 8 && month <= 10
      ? '秋'
      : '冬';

  return {
    year: date.getFullYear(),
    monthName: monthNames[month],
    day: date.getDate(),
    weekday: weekdays[date.getDay()],
    lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    solarTerm: lunar.getPrevJieQi(true).getName(),
    seasonChar,
  };
}

export function formatDetailDate(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

export function formatReplyDate(date: Date) {
  const hour = date.getHours();
  const period = hour < 11 ? '晨' : hour < 18 ? '昼' : '晚';
  return `${monthNames[date.getMonth()]} ${date.getDate()} · ${period}`;
}

export function formatReplySign(parentDate: Date, replyDate: Date) {
  const start = new Date(
    parentDate.getFullYear(),
    parentDate.getMonth(),
    parentDate.getDate(),
  );
  const end = new Date(
    replyDate.getFullYear(),
    replyDate.getMonth(),
    replyDate.getDate(),
  );
  const days = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
  if (days === 0) {
    return '此刻的你';
  }
  if (days === 1) {
    return '一天后的你';
  }
  if (days === 7) {
    return '一周后的你';
  }
  return `${days}天后的你`;
}
