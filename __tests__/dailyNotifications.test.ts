import notifee, { RepeatFrequency } from '@notifee/react-native';

import {
  getNextDailyReminderDate,
  scheduleDailyReminder,
} from '../src/services/dailyNotifications';

test('moves a passed daily reminder time to tomorrow', () => {
  expect(
    getNextDailyReminderDate('09:15', new Date(2026, 7, 3, 10, 30)),
  ).toEqual(new Date(2026, 7, 4, 9, 15));
});

test('keeps a future daily reminder time on the same local day', () => {
  expect(
    getNextDailyReminderDate('22:30', new Date(2026, 7, 3, 10, 30)),
  ).toEqual(new Date(2026, 7, 3, 22, 30));
});

test('schedules a repeating local daily notification', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 3, 10, 30));
  const createMock = notifee.createTriggerNotification as jest.MockedFunction<
    typeof notifee.createTriggerNotification
  >;
  createMock.mockClear();

  await scheduleDailyReminder('22:30');

  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'daily-writing-reminder' }),
    expect.objectContaining({
      timestamp: new Date(2026, 7, 3, 22, 30).getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    }),
  );
  jest.useRealTimers();
});
