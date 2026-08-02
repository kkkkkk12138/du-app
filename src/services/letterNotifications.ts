import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

import { getArrivalNotificationDate } from '../features/newLetter/futureLetterLogic';

const letterChannelId = 'future-letters';

export async function requestLetterNotificationAccess() {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function scheduleLetterArrivalNotification({
  letterId,
  arriveDate,
  reminderTime = '09:00',
}: {
  letterId: string;
  arriveDate: Date;
  reminderTime?: string;
}) {
  const notificationDate = getArrivalNotificationDate(arriveDate, reminderTime);
  if (notificationDate.getTime() <= Date.now()) {
    return false;
  }

  let channelId: string | undefined;
  if (Platform.OS === 'android') {
    channelId = await notifee.createChannel({
      id: letterChannelId,
      name: '未来信',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: notificationDate.getTime(),
  };

  await notifee.createTriggerNotification(
    {
      id: `future-letter-${letterId}`,
      title: '有信到了',
      body: '从前的你寄来一封信',
      data: { letterId },
      android: channelId
        ? {
            channelId,
            pressAction: { id: 'default' },
          }
        : undefined,
      ios: {
        sound: 'default',
      },
    },
    trigger,
  );
  return true;
}

export async function cancelLetterArrivalNotification(letterId: string) {
  await notifee.cancelNotification(`future-letter-${letterId}`);
}
