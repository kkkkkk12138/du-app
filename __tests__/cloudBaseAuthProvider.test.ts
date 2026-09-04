import {
  ACCOUNT_PROVIDERS,
  type AccountSession,
  type VerificationChallenge,
} from '../src/features/account/authTypes';
import type {AuthProvider} from '../src/features/account/AuthProvider';

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
