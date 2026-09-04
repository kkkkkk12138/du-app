import {
  ACCOUNT_PROVIDERS,
  type AccountSession,
  type VerificationChallenge,
} from '../src/features/account/authTypes';
import type {AuthProvider} from '../src/features/account/AuthProvider';
import {createCloudBaseAuthProvider} from '../src/features/account/cloudBaseAuthProvider';

const configuredCloud = {
  envId: 'du-test-123',
  region: 'ap-shanghai' as const,
  databaseMode: 'postgresql' as const,
};

function createRuntime() {
  const auth = {
    getVerification: jest.fn(),
    signInWithEmail: jest.fn(),
    signInWithSms: jest.fn(),
    getLoginState: jest.fn(),
    getCredentials: jest.fn(),
    setCredentials: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(),
    onLoginStateChanged: jest.fn(),
  };
  const initialize = jest.fn(() => ({
    auth: () => auth,
  }));

  return {auth, initialize};
}

function createCredentialStore() {
  return {
    read: jest.fn(),
    write: jest.fn(),
    clear: jest.fn(),
  };
}

test('defines every supported account provider in rollout order', () => {
  expect(ACCOUNT_PROVIDERS).toEqual([
    'email',
    'phone',
    'apple',
    'wechat',
  ]);
});

test('keeps authentication independent from provider credentials', async () => {
  const session: AccountSession = {
    uid: 'account-1',
    email: 'person@example.com',
    providers: ['email'],
  };
  const challenge: VerificationChallenge = {
    channel: 'email',
    destination: 'person@example.com',
    verificationId: 'verification-1',
    raw: {verification_id: 'verification-1'},
  };
  const provider: AuthProvider = {
    restoreSession: jest.fn().mockResolvedValue(session),
    requestEmailCode: jest.fn().mockResolvedValue(challenge),
    verifyEmailCode: jest.fn().mockResolvedValue(session),
    requestPhoneCode: jest.fn(),
    verifyPhoneCode: jest.fn(),
    signOut: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  };

  await expect(provider.restoreSession()).resolves.toEqual(session);
  await expect(
    provider.requestEmailCode('person@example.com'),
  ).resolves.toEqual(challenge);
  expect(session).not.toHaveProperty('accessToken');
  expect(session).not.toHaveProperty('refreshToken');
});

test('requests and verifies an email code through CloudBase', async () => {
  const {auth, initialize} = createRuntime();
  auth.getVerification.mockResolvedValue({
    verification_id: 'verification-email',
    is_user: true,
  });
  auth.signInWithEmail.mockResolvedValue({
    user: {
      uid: 'account-1',
      email: 'person@example.com',
      providers: [{name: 'email'}],
    },
  });
  const provider = createCloudBaseAuthProvider(configuredCloud, initialize);

  const challenge = await provider.requestEmailCode(
    ' Person@Example.com ',
  );
  const session = await provider.verifyEmailCode(challenge, '123456');

  expect(auth.getVerification).toHaveBeenCalledWith({
    email: 'person@example.com',
  });
  expect(auth.signInWithEmail).toHaveBeenCalledWith({
    verificationInfo: challenge.raw,
    verificationCode: '123456',
    email: 'person@example.com',
  });
  expect(session).toEqual({
    uid: 'account-1',
    email: 'person@example.com',
    providers: ['email'],
  });
});

test('requests and verifies a mainland phone code through CloudBase', async () => {
  const {auth, initialize} = createRuntime();
  auth.getVerification.mockResolvedValue({
    verification_id: 'verification-phone',
    is_user: true,
  });
  auth.signInWithSms.mockResolvedValue({
    user: {
      uid: 'account-2',
      phoneNumber: '+86 13800000000',
      providers: [{name: 'phone'}],
    },
  });
  const provider = createCloudBaseAuthProvider(configuredCloud, initialize);

  const challenge = await provider.requestPhoneCode('13800000000');
  const session = await provider.verifyPhoneCode(challenge, '654321');

  expect(auth.getVerification).toHaveBeenCalledWith({
    phone_number: '+86 13800000000',
  });
  expect(auth.signInWithSms).toHaveBeenCalledWith({
    verificationInfo: challenge.raw,
    verificationCode: '654321',
    phoneNum: '+86 13800000000',
  });
  expect(session).toEqual({
    uid: 'account-2',
    phone: '+86 13800000000',
    providers: ['phone'],
  });
});

test('restores a provider-neutral account session', async () => {
  const {auth, initialize} = createRuntime();
  auth.getLoginState.mockResolvedValue({
    user: {
      uid: 'account-3',
      email: 'person@example.com',
      phoneNumber: '+86 13800000000',
      providers: [{name: 'email'}, {name: 'phone'}],
    },
  });
  const provider = createCloudBaseAuthProvider(configuredCloud, initialize);

  await expect(provider.restoreSession()).resolves.toEqual({
    uid: 'account-3',
    email: 'person@example.com',
    phone: '+86 13800000000',
    providers: ['email', 'phone'],
  });
});

test('maps invalid verification codes to a stable user message', async () => {
  const {auth, initialize} = createRuntime();
  auth.getVerification.mockResolvedValue({
    verification_id: 'verification-email',
  });
  auth.signInWithEmail.mockRejectedValue({error: 'invalid_code'});
  const provider = createCloudBaseAuthProvider(configuredCloud, initialize);
  const challenge = await provider.requestEmailCode('person@example.com');

  await expect(
    provider.verifyEmailCode(challenge, '000000'),
  ).rejects.toThrow('验证码不正确，请重新输入');
});

test('subscribes through the removable CloudBase auth listener', () => {
  const {auth, initialize} = createRuntime();
  const unsubscribe = jest.fn();
  auth.onAuthStateChange.mockReturnValue({
    data: {subscription: {unsubscribe}},
  });
  const provider = createCloudBaseAuthProvider(configuredCloud, initialize);
  const listener = jest.fn();

  const removeListener = provider.subscribe(listener);
  const callback = auth.onAuthStateChange.mock.calls[0][0];
  callback('SIGNED_IN', {
    user: {
      id: 'account-4',
      email: 'person@example.com',
      phone: '+86 13800000000',
      app_metadata: {
        providers: ['email', 'phone'],
      },
    },
  });
  removeListener();

  expect(listener).toHaveBeenCalledWith({
    uid: 'account-4',
    email: 'person@example.com',
    phone: '+86 13800000000',
    providers: ['email', 'phone'],
  });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(auth.onLoginStateChanged).not.toHaveBeenCalled();
});

test('restores CloudBase credentials from secure storage', async () => {
  const {auth, initialize} = createRuntime();
  const credentialStore = createCredentialStore();
  const credentials = {refresh_token: 'refresh-secret'};
  credentialStore.read.mockResolvedValue(credentials);
  auth.setCredentials.mockResolvedValue(undefined);
  auth.getLoginState.mockResolvedValue({
    user: {
      uid: 'account-5',
      email: 'person@example.com',
    },
  });
  const provider = createCloudBaseAuthProvider(
    configuredCloud,
    initialize,
    credentialStore,
  );

  await provider.restoreSession();

  expect(auth.setCredentials).toHaveBeenCalledWith(credentials);
  expect(auth.getLoginState).toHaveBeenCalledTimes(1);
});
