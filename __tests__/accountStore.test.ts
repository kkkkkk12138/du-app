import type {AccountSession} from '../src/features/account/authTypes';
import {useAccountStore} from '../src/features/account/useAccountStore';

const session: AccountSession = {
  uid: 'account-1',
  email: 'person@example.com',
  providers: ['email'],
};

beforeEach(() => {
  useAccountStore.getState().beginRestore();
});

test('keeps only the transient account state required by the UI', () => {
  useAccountStore.getState().setSignedIn(session, false);

  expect(useAccountStore.getState().account).toEqual({
    status: 'signed_in_locked',
    session,
  });
  expect(JSON.stringify(useAccountStore.getState())).not.toMatch(
    /accessToken|refreshToken|verificationCode|providerToken|recoveryWords|masterKey/i,
  );
  expect(useAccountStore).not.toHaveProperty('persist');
});

test('distinguishes cryptographically unlocked sessions and sign-out', () => {
  useAccountStore.getState().setSignedIn(session, true);
  expect(useAccountStore.getState().account.status).toBe(
    'signed_in_unlocked',
  );

  useAccountStore.getState().setSignedOut();
  expect(useAccountStore.getState().account).toEqual({
    status: 'signed_out',
  });
});
