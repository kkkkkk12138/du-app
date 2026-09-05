import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {AuthProvider} from '../src/features/account/AuthProvider';
import {AccountSessionBootstrap} from '../src/features/account/AccountSessionBootstrap';
import type {AccountSession} from '../src/features/account/authTypes';
import {useAccountStore} from '../src/features/account/useAccountStore';

const session: AccountSession = {
  uid: 'account-1',
  email: 'person@example.com',
  providers: ['email'],
};

function createAuthProvider(restoredSession: AccountSession | null) {
  let authListener: ((value: AccountSession | null) => void) | undefined;
  const unsubscribe = jest.fn();
  const provider: AuthProvider = {
    restoreSession: jest.fn().mockResolvedValue(restoredSession),
    requestEmailCode: jest.fn(),
    verifyEmailCode: jest.fn(),
    requestPhoneCode: jest.fn(),
    verifyPhoneCode: jest.fn(),
    signOut: jest.fn(),
    subscribe: jest.fn(listener => {
      authListener = listener;
      return unsubscribe;
    }),
  };

  return {
    provider,
    unsubscribe,
    emit: (value: AccountSession | null) => authListener?.(value),
  };
}

beforeEach(() => {
  useAccountStore.getState().beginRestore();
});

test('restores a signed-in account as locked without a local key', async () => {
  const {provider} = createAuthProvider(session);
  const hasUnlockedAccountKey = jest.fn().mockResolvedValue(false);

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AccountSessionBootstrap
        authProvider={provider}
        hasUnlockedAccountKey={hasUnlockedAccountKey}
      >
        <></>
      </AccountSessionBootstrap>,
    );
  });

  expect(provider.restoreSession).toHaveBeenCalledTimes(1);
  expect(hasUnlockedAccountKey).toHaveBeenCalledWith('account-1');
  expect(useAccountStore.getState().account).toEqual({
    status: 'signed_in_locked',
    session,
  });

  act(() => renderer.unmount());
});

test('keeps a restored account locked when key validation fails', async () => {
  const {provider} = createAuthProvider(session);
  const hasUnlockedAccountKey = jest
    .fn()
    .mockRejectedValue(new Error('network unavailable'));

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AccountSessionBootstrap
        authProvider={provider}
        hasUnlockedAccountKey={hasUnlockedAccountKey}
      >
        <></>
      </AccountSessionBootstrap>,
    );
  });

  expect(useAccountStore.getState().account).toEqual({
    status: 'signed_in_locked',
    session,
  });

  act(() => renderer.unmount());
});

test('tracks auth changes and removes the listener on unmount', async () => {
  const {provider, emit, unsubscribe} = createAuthProvider(null);
  const hasUnlockedAccountKey = jest.fn().mockResolvedValue(true);

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AccountSessionBootstrap
        authProvider={provider}
        hasUnlockedAccountKey={hasUnlockedAccountKey}
      >
        <></>
      </AccountSessionBootstrap>,
    );
  });
  expect(useAccountStore.getState().account.status).toBe('signed_out');

  await act(async () => {
    emit(session);
  });
  expect(useAccountStore.getState().account.status).toBe(
    'signed_in_unlocked',
  );

  act(() => renderer.unmount());
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
