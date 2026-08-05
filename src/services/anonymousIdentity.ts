import { Q } from '@nozbe/watermelondb';
import { randomId } from '@nozbe/watermelondb/utils/common';
import * as Keychain from 'react-native-keychain';

import { database } from '../db/database';
import { Place, Setting, User } from '../db/models';

const keychainService = 'cn.du.app.anonymous-identity';
const settingsRecordId = 'local-settings';

function createDuNumber(id: string) {
  const numeric = Array.from(id).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) % 1000000,
    0,
  );
  return numeric.toString().padStart(6, '0');
}

async function getOrCreateAnonymousId() {
  const credentials = await Keychain.getGenericPassword({
    service: keychainService,
  });

  if (credentials) {
    return credentials.password;
  }

  const anonymousId = randomId();
  const saved = await Keychain.setGenericPassword(
    'anonymous-user',
    anonymousId,
    {
      service: keychainService,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    },
  );

  if (!saved) {
    throw new Error('无法将匿名身份写入系统安全存储');
  }

  return anonymousId;
}

async function ensureUserRecord(anonymousId: string) {
  const existing = await database
    .get<User>('users')
    .query(Q.where('id', anonymousId))
    .fetch();

  if (existing.length > 0) {
    return existing[0];
  }

  const hasDevelopmentPlaces =
    (await database.get<Place>('places').query().fetchCount()) > 0;

  return database.write(() =>
    database.get<User>('users').create(user => {
      user._raw.id = anonymousId;
      user.nickname = '渡河人';
      user.avatarChar = '渡';
      user.duNumber = createDuNumber(anonymousId);
      user.hometownId = hasDevelopmentPlaces ? 'changsha' : undefined;
      user.currentCityId = hasDevelopmentPlaces ? 'shanghai' : undefined;
      user.currentCityArrival = hasDevelopmentPlaces
        ? new Date('2025-02-20')
        : undefined;
      user.createdAt = new Date();
      user.dailyReminderTime = '22:30';
      user.letterReminderOn = true;
      user.theme = '素纸';
      user.passcodeOn = false;
      user.darkMode = 'system';
    }),
  );
}

async function ensureSettingsRecord(anonymousId: string) {
  const existing = await database
    .get<Setting>('settings')
    .query(Q.where('id', settingsRecordId))
    .fetch();

  if (existing.length > 0) {
    return existing[0];
  }

  return database.write(() =>
    database.get<Setting>('settings').create(settings => {
      settings._raw.id = settingsRecordId;
      settings.userId = anonymousId;
      settings.themeMode = 'system';
      settings.artSkin = 'paper';
      settings.dailyReminderOn = false;
      settings.dailyReminderTime = '22:30';
      settings.letterReminderOn = true;
      settings.letterReminderTime = '09:00';
      settings.biometricLockOn = false;
      settings.defaultCity = '上海';
      settings.onboardingCompleted = false;
      settings.updatedAt = new Date();
    }),
  );
}

export async function initializeAnonymousIdentity() {
  const anonymousId = await getOrCreateAnonymousId();
  const user = await ensureUserRecord(anonymousId);
  await ensureSettingsRecord(anonymousId);

  return {
    anonymousId,
    duNumber: user.duNumber,
  };
}

export async function resetAnonymousIdentity() {
  await Keychain.resetGenericPassword({ service: keychainService });
}
