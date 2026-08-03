import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const dailyReminderId = 'daily-writing-reminder';
const dailyChannelId = 'daily-writing';

export function getNextDailyReminderDate(
  reminderTime: string,
  now = new Date(),
) {
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function requestNotificationAccess() {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function scheduleDailyReminder(reminderTime: string) {
  let channelId: string | undefined;
  if (Platform.OS === 'android') {
    channelId = await notifee.createChannel({
      id: dailyChannelId,
      name: '每日落笔',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: getNextDailyReminderDate(reminderTime).getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
  };

  await notifee.createTriggerNotification(
    {
      id: dailyReminderId,
      title: '此刻，还没落下',
      body: '写几句给今天的自己',
      android: channelId
        ? { channelId, pressAction: { id: 'default' } }
        : undefined,
    },
    trigger,
  );
}

export async function cancelDailyReminder() {
  await notifee.cancelNotification(dailyReminderId);
}
