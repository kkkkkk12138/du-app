import * as Keychain from 'react-native-keychain';

export type KeyRecoveryState =
  | {status: 'locked'}
  | {status: 'unlocked'}
  | {status: 'recovery_required'};

const accountKeyServicePrefix = 'cn.du.app.account-master-key';

export async function hasUnlockedAccountKey(uid: string) {
  const credentials = await Keychain.getGenericPassword({
    service: `${accountKeyServicePrefix}.${uid}`,
  });
  return Boolean(credentials && credentials.username === uid);
}
