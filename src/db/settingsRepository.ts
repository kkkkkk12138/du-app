import {Q} from '@nozbe/watermelondb';

import type {ThemeMode} from '../store/useSettingsStore';
import {database} from './database';
import {Setting} from './models';

export type SettingsSnapshot = {
  themeMode: ThemeMode;
  dailyReminderOn: boolean;
  dailyReminderTime: string;
  letterReminderOn: boolean;
  letterReminderTime: string;
  biometricLockOn: boolean;
  defaultCity: string;
  onboardingCompleted: boolean;
  privacyAcceptedAt: number | null;
};

export async function saveSettingsSnapshot(snapshot: SettingsSnapshot) {
  const records = await database
    .get<Setting>('settings')
    .query(Q.where('id', 'local-settings'))
    .fetch();
  const settings = records[0];

  if (!settings) {
    return;
  }

  await database.write(() =>
    settings.update(record => {
      record.themeMode = snapshot.themeMode;
      record.dailyReminderOn = snapshot.dailyReminderOn;
      record.dailyReminderTime = snapshot.dailyReminderTime;
      record.letterReminderOn = snapshot.letterReminderOn;
      record.letterReminderTime = snapshot.letterReminderTime;
      record.biometricLockOn = snapshot.biometricLockOn;
      record.defaultCity = snapshot.defaultCity;
      record.onboardingCompleted = snapshot.onboardingCompleted;
      record.privacyAcceptedAt = snapshot.privacyAcceptedAt
        ? new Date(snapshot.privacyAcceptedAt)
        : undefined;
      record.updatedAt = new Date();
    }),
  );
}
