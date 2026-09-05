import * as Keychain from 'react-native-keychain';

import {
  deleteLocalAccountMasterKey,
  hasUnlockedAccountKey,
  initializeAccountMasterKey,
  readAccountMasterKey,
  writeAccountMasterKey,
  type AccountMasterKeyDependencies,
} from '../src/features/account/keyRecoveryState';

const uid = 'account-1';
const key =
  'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const verifier = 'a'.repeat(64);
const service = 'cn.du.app.account-master-key.account-1';

const getGenericPassword =
  Keychain.getGenericPassword as jest.MockedFunction<
    typeof Keychain.getGenericPassword
  >;
const setGenericPassword =
  Keychain.setGenericPassword as jest.MockedFunction<
    typeof Keychain.setGenericPassword
  >;
const resetGenericPassword =
  Keychain.resetGenericPassword as jest.MockedFunction<
    typeof Keychain.resetGenericPassword
  >;

function credentials(
  username: string,
  password: string,
): Keychain.UserCredentials {
  return {
    username,
    password,
    service,
    storage: 'KeystoreAESGCM_NoAuth' as Keychain.STORAGE_TYPE,
  };
}

function createDependencies(
  status: 'claimed' | 'existing' | 'recovery_required' = 'claimed',
): jest.Mocked<AccountMasterKeyDependencies> {
  return {
    generateRandomKey: jest.fn().mockResolvedValue(key),
    keyVerifier: jest.fn().mockResolvedValue(verifier),
    initializeAccountKey: jest.fn().mockResolvedValue({
      status,
      keyVersion: 1,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getGenericPassword.mockReset();
  setGenericPassword.mockReset();
  resetGenericPassword.mockReset();
  setGenericPassword.mockResolvedValue({
    service,
    storage: 'KeystoreAESGCM_NoAuth' as Keychain.STORAGE_TYPE,
  });
  resetGenericPassword.mockResolvedValue(true);
});

test('reads only a matching UID and exactly 32 decoded bytes', async () => {
  getGenericPassword
    .mockResolvedValueOnce(credentials('another-account', key))
    .mockResolvedValueOnce(credentials(uid, 'bm90LTMyLWJ5dGVz'))
    .mockResolvedValueOnce(credentials(uid, key));

  await expect(readAccountMasterKey(uid)).resolves.toBeNull();
  await expect(readAccountMasterKey(uid)).resolves.toBeNull();
  await expect(readAccountMasterKey(uid)).resolves.toBe(key);
  expect(getGenericPassword).toHaveBeenCalledWith({service});
});

test('stores with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY', async () => {
  await writeAccountMasterKey(uid, key);

  expect(setGenericPassword).toHaveBeenCalledWith(uid, key, {
    service,
    accessible:
      Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
});

test('does not replace an invalid or missing key during session restore', async () => {
  const dependencies = createDependencies();
  getGenericPassword
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(credentials(uid, 'invalid'));

  await expect(
    hasUnlockedAccountKey(uid, dependencies),
  ).resolves.toBe(false);
  await expect(
    hasUnlockedAccountKey(uid, dependencies),
  ).resolves.toBe(false);

  expect(dependencies.generateRandomKey).not.toHaveBeenCalled();
  expect(dependencies.keyVerifier).not.toHaveBeenCalled();
  expect(dependencies.initializeAccountKey).not.toHaveBeenCalled();
  expect(setGenericPassword).not.toHaveBeenCalled();
});

test('keeps an existing matching key when the server says existing', async () => {
  const dependencies = createDependencies('existing');
  getGenericPassword.mockResolvedValue(credentials(uid, key));

  await expect(
    initializeAccountMasterKey(uid, dependencies),
  ).resolves.toEqual({status: 'unlocked'});

  expect(dependencies.generateRandomKey).not.toHaveBeenCalled();
  expect(dependencies.keyVerifier).toHaveBeenCalledWith(uid, key);
  expect(dependencies.initializeAccountKey).toHaveBeenCalledWith({
    keyVerifier: verifier,
  });
  expect(setGenericPassword).not.toHaveBeenCalled();
  expect(resetGenericPassword).not.toHaveBeenCalled();
});

test('deletes a newly generated candidate when the server requires recovery', async () => {
  const dependencies = createDependencies('recovery_required');
  getGenericPassword.mockResolvedValue(false);

  await expect(
    initializeAccountMasterKey(uid, dependencies),
  ).resolves.toEqual({status: 'recovery_required'});

  expect(setGenericPassword).toHaveBeenCalledTimes(1);
  expect(resetGenericPassword).toHaveBeenCalledWith({service});
});

test('does not delete an existing key when the server requires recovery', async () => {
  const dependencies = createDependencies('recovery_required');
  getGenericPassword.mockResolvedValue(credentials(uid, key));

  await expect(
    initializeAccountMasterKey(uid, dependencies),
  ).resolves.toEqual({status: 'recovery_required'});

  expect(resetGenericPassword).not.toHaveBeenCalled();
});

test('resumes a crash between local write and server claim with the same verifier', async () => {
  const dependencies = createDependencies();
  dependencies.initializeAccountKey
    .mockRejectedValueOnce(new Error('network interrupted'))
    .mockResolvedValueOnce({status: 'claimed', keyVersion: 1});
  getGenericPassword
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(credentials(uid, key));

  await expect(
    initializeAccountMasterKey(uid, dependencies),
  ).rejects.toThrow('network interrupted');
  await expect(
    initializeAccountMasterKey(uid, dependencies),
  ).resolves.toEqual({status: 'unlocked'});

  expect(dependencies.generateRandomKey).toHaveBeenCalledTimes(1);
  expect(setGenericPassword).toHaveBeenCalledTimes(1);
  expect(dependencies.keyVerifier).toHaveBeenNthCalledWith(1, uid, key);
  expect(dependencies.keyVerifier).toHaveBeenNthCalledWith(2, uid, key);
  expect(dependencies.initializeAccountKey).toHaveBeenNthCalledWith(1, {
    keyVerifier: verifier,
  });
  expect(dependencies.initializeAccountKey).toHaveBeenNthCalledWith(2, {
    keyVerifier: verifier,
  });
});

test('deletes only the requested account key', async () => {
  await deleteLocalAccountMasterKey(uid);

  expect(resetGenericPassword).toHaveBeenCalledWith({service});
});
