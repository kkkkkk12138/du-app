import React from 'react';
import {StyleSheet, TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {AuthProvider} from '../src/features/account/AuthProvider';
import {AccountAccessScreen} from '../src/features/account/AccountAccessScreen';
import {AccountScreen} from '../src/features/account/AccountScreen';
import type {AccountSession} from '../src/features/account/authTypes';
import {useAccountStore} from '../src/features/account/useAccountStore';
import {ThemeContext} from '../src/theme/ThemeProvider';
import {lightColors} from '../src/tokens/colors';

const mockGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    replace: mockReplace,
  }),
  useRoute: () => ({
    params: {initialChannel: 'email'},
  }),
}));

const session: AccountSession = {
  uid: 'account-1',
  email: 'person@example.com',
  providers: ['email'],
};

function createAuthProvider(): jest.Mocked<AuthProvider> {
  return {
    restoreSession: jest.fn(),
    requestEmailCode: jest.fn().mockResolvedValue({
      channel: 'email',
      destination: 'person@example.com',
      verificationId: 'verification-email',
      raw: {verification_id: 'verification-email'},
    }),
    verifyEmailCode: jest.fn().mockResolvedValue(session),
    requestPhoneCode: jest.fn(),
    verifyPhoneCode: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(_listener => () => undefined),
  };
}

function renderWithTheme(element: React.ReactElement) {
  return ReactTestRenderer.create(
    <ThemeContext.Provider
      value={{
        colors: lightColors,
        isDark: false,
        mode: 'light',
        artSkin: 'paper',
        setMode: jest.fn(),
        setArtSkin: jest.fn(),
      }}
    >
      {element}
    </ThemeContext.Provider>,
  );
}

beforeEach(() => {
  jest.useRealTimers();
  mockGoBack.mockClear();
  mockReplace.mockClear();
  useAccountStore.getState().setSignedOut();
});

test('moves from email entry to the six-digit verification step', async () => {
  const provider = createAuthProvider();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = renderWithTheme(
      <AccountAccessScreen authProvider={provider} />,
    );
  });

  const emailInput = renderer.root.findByProps({
    accessibilityLabel: '邮箱地址',
  });
  act(() => emailInput.props.onChangeText('person@example.com'));

  const primary = renderer.root.findByProps({
    accessibilityLabel: '获取验证码',
  });
  const primaryStyle = StyleSheet.flatten(
    primary.props.style({pressed: false}),
  );
  expect(primaryStyle.minHeight).toBeGreaterThanOrEqual(44);

  await act(async () => {
    primary.props.onPress();
  });

  expect(provider.requestEmailCode).toHaveBeenCalledWith(
    'person@example.com',
  );
  const codeInput = renderer.root.findByProps({
    accessibilityLabel: '六位验证码',
  });
  expect(codeInput.type).toBe(TextInput);

  act(() => renderer.unmount());
});

test('disables resend for thirty seconds and verifies the code', async () => {
  jest.useFakeTimers();
  const provider = createAuthProvider();
  const initializeAccountMasterKey = jest
    .fn()
    .mockResolvedValue({status: 'unlocked'});
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = renderWithTheme(
      <AccountAccessScreen
        authProvider={provider}
        initializeAccountMasterKey={initializeAccountMasterKey}
      />,
    );
  });
  act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '邮箱地址'})
      .props.onChangeText('person@example.com');
  });
  await act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '获取验证码'})
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '重新获取验证码'})
      .props.disabled,
  ).toBe(true);
  act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '六位验证码'})
      .props.onChangeText('123456');
  });
  await act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '登录'})
      .props.onPress();
  });

  expect(provider.verifyEmailCode).toHaveBeenCalledWith(
    expect.objectContaining({channel: 'email'}),
    '123456',
  );
  expect(initializeAccountMasterKey).toHaveBeenCalledWith('account-1');
  expect(useAccountStore.getState().account).toEqual({
    status: 'signed_in_unlocked',
    session,
  });
  expect(mockReplace).toHaveBeenCalledWith('Account');

  act(() => renderer.unmount());
  jest.useRealTimers();
});

test('switches to phone verification without changing the account flow', async () => {
  const provider = createAuthProvider();
  provider.requestPhoneCode.mockResolvedValue({
    channel: 'phone',
    destination: '+86 13800000000',
    verificationId: 'verification-phone',
    raw: {verification_id: 'verification-phone'},
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = renderWithTheme(
      <AccountAccessScreen authProvider={provider} />,
    );
  });
  act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '手机号登录'})
      .props.onPress();
  });
  act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '手机号'})
      .props.onChangeText('13800000000');
  });
  await act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '获取验证码'})
      .props.onPress();
  });

  expect(provider.requestPhoneCode).toHaveBeenCalledWith('13800000000');
  expect(
    renderer.root.findByProps({accessibilityLabel: '六位验证码'}),
  ).toBeTruthy();

  act(() => renderer.unmount());
});

test('keeps the verified account locked when key recovery is required', async () => {
  const provider = createAuthProvider();
  const initializeAccountMasterKey = jest
    .fn()
    .mockResolvedValue({status: 'recovery_required'});
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = renderWithTheme(
      <AccountAccessScreen
        authProvider={provider}
        initializeAccountMasterKey={initializeAccountMasterKey}
      />,
    );
  });
  act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '邮箱地址'})
      .props.onChangeText('person@example.com');
  });
  await act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '获取验证码'})
      .props.onPress();
  });
  act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '六位验证码'})
      .props.onChangeText('123456');
  });
  await act(async () => {
    renderer.root.findByProps({accessibilityLabel: '登录'}).props.onPress();
  });

  expect(useAccountStore.getState().account).toEqual({
    status: 'signed_in_locked',
    session,
  });
  expect(mockReplace).toHaveBeenCalledWith('Account');

  act(() => renderer.unmount());
});

test('shows the encryption boundary and signs out without local deletion', async () => {
  const provider = createAuthProvider();
  useAccountStore.getState().setSignedIn(session, false);
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = renderWithTheme(<AccountScreen authProvider={provider} />);
  });

  expect(
    renderer.root.findByProps({
      accessibilityLabel:
        '账号已登录，需要恢复凭证或旧设备批准才能读取已同步内容',
    }),
  ).toBeTruthy();

  await act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '退出账号'})
      .props.onPress();
  });

  expect(provider.signOut).toHaveBeenCalledTimes(1);
  expect(useAccountStore.getState().account.status).toBe('signed_out');
  expect(mockGoBack).toHaveBeenCalledTimes(1);

  act(() => renderer.unmount());
});
