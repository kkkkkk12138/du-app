const reminderTimePattern = /^(\d{2}):(\d{2})$/;

export function normalizeReminderTime(value: string, fallback = '09:00') {
  const match = reminderTimePattern.exec(value);
  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return fallback;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}`;
}

export function reminderTimeToDate(value: string, now = new Date()) {
  const [hours, minutes] = normalizeReminderTime(value).split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatReminderTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}
