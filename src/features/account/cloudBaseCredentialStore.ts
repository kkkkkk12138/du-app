import * as Keychain from 'react-native-keychain';

export type CloudBaseCredentials = Record<string, unknown>;

export interface CloudBaseCredentialStore {
  read(): Promise<CloudBaseCredentials | null>;
  write(credentials: CloudBaseCredentials): Promise<void>;
  clear(): Promise<void>;
}

const credentialService = 'cn.du.app.cloudbase-session';

export const cloudBaseCredentialStore: CloudBaseCredentialStore = {
  async read() {
    const stored = await Keychain.getGenericPassword({
      service: credentialService,
    });
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored.password) as CloudBaseCredentials;
    } catch {
      await Keychain.resetGenericPassword({service: credentialService});
      return null;
    }
  },

  async write(credentials) {
    const saved = await Keychain.setGenericPassword(
      'cloudbase-session',
      JSON.stringify(credentials),
      {
        service: credentialService,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );
    if (!saved) {
      throw new Error('无法安全保存账号会话');
    }
  },

  async clear() {
    await Keychain.resetGenericPassword({service: credentialService});
  },
};
