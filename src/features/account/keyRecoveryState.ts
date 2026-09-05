import * as Keychain from 'react-native-keychain';

import {developmentCloudBaseConfig} from '../../config/cloudServiceConfig';
import {
  createCloudBaseGateway,
  type AccountKeyInitialization,
} from '../../services/cloudBaseGateway';
import {
  generateRandomKey,
  keyVerifier,
} from '../../services/mediaCrypto';

export type KeyRecoveryState =
  | {status: 'locked'}
  | {status: 'unlocked'}
  | {status: 'recovery_required'};

export type AccountMasterKeyDependencies = {
  generateRandomKey: () => Promise<string>;
  keyVerifier: (
    uid: string,
    masterKeyBase64: string,
  ) => Promise<string>;
  initializeAccountKey: (input: {
    keyVerifier: string;
  }) => Promise<AccountKeyInitialization>;
};

const accountKeyServicePrefix = 'cn.du.app.account-master-key';
const accountMasterKey = /^[A-Za-z0-9+/]{43}=$/;

const defaultDependencies: AccountMasterKeyDependencies = {
  generateRandomKey,
  keyVerifier,
  initializeAccountKey: input =>
    createCloudBaseGateway(
      developmentCloudBaseConfig,
    ).initializeAccountKey(input),
};

function accountKeyService(uid: string) {
  if (!uid) {
    throw new Error('账号标识无效');
  }
  return `${accountKeyServicePrefix}.${uid}`;
}

function isAccountMasterKey(value: string) {
  return accountMasterKey.test(value);
}

export async function readAccountMasterKey(uid: string) {
  const credentials = await Keychain.getGenericPassword({
    service: accountKeyService(uid),
  });
  if (
    !credentials ||
    credentials.username !== uid ||
    !isAccountMasterKey(credentials.password)
  ) {
    return null;
  }
  return credentials.password;
}

export async function writeAccountMasterKey(
  uid: string,
  masterKeyBase64: string,
) {
  if (!isAccountMasterKey(masterKeyBase64)) {
    throw new Error('账号主密钥格式无效');
  }
  const saved = await Keychain.setGenericPassword(
    uid,
    masterKeyBase64,
    {
      service: accountKeyService(uid),
      accessible:
        Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    },
  );
  if (!saved) {
    throw new Error('无法安全保存账号主密钥');
  }
}

export async function deleteLocalAccountMasterKey(uid: string) {
  await Keychain.resetGenericPassword({
    service: accountKeyService(uid),
  });
}

async function claimExistingAccountKey(
  uid: string,
  masterKeyBase64: string,
  dependencies: AccountMasterKeyDependencies,
) {
  const verifier = await dependencies.keyVerifier(
    uid,
    masterKeyBase64,
  );
  return dependencies.initializeAccountKey({keyVerifier: verifier});
}

export async function hasUnlockedAccountKey(
  uid: string,
  dependencies: AccountMasterKeyDependencies = defaultDependencies,
) {
  try {
    const masterKey = await readAccountMasterKey(uid);
    if (!masterKey) {
      return false;
    }
    const result = await claimExistingAccountKey(
      uid,
      masterKey,
      dependencies,
    );
    return result.status === 'claimed' || result.status === 'existing';
  } catch {
    return false;
  }
}

export async function initializeAccountMasterKey(
  uid: string,
  dependencies: AccountMasterKeyDependencies = defaultDependencies,
): Promise<KeyRecoveryState> {
  let masterKey = await readAccountMasterKey(uid);
  const createdCandidate = masterKey === null;
  if (!masterKey) {
    masterKey = await dependencies.generateRandomKey();
    await writeAccountMasterKey(uid, masterKey);
  }

  const result = await claimExistingAccountKey(
    uid,
    masterKey,
    dependencies,
  );
  if (result.status === 'recovery_required') {
    if (createdCandidate) {
      await deleteLocalAccountMasterKey(uid);
    }
    return {status: 'recovery_required'};
  }
  return {status: 'unlocked'};
}
