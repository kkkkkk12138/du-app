/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {useSettingsStore} from '../src/store/useSettingsStore';

jest.mock('../src/db/database', () => ({
  database: {},
}));

jest.mock('@nozbe/watermelondb/react', () => {
  const ReactModule = require('react');

  return {
    DatabaseProvider: ({children}: {children: React.ReactNode}) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

jest.mock('../src/db/seed', () => ({
  seedDevelopmentData: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/db/settingsRepository', () => ({
  saveSettingsSnapshot: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/db/memoryRepository', () => ({
  getRecentMemories: jest.fn().mockResolvedValue([]),
  verifyMemoryRoundTrip: jest.fn().mockResolvedValue(undefined),
}));


jest.mock('../src/services/anonymousIdentity', () => ({
  initializeAnonymousIdentity: jest.fn().mockResolvedValue({
    anonymousId: 'test-anonymous-id',
    duNumber: '100327',
  }),
}));

beforeEach(() => {
  useSettingsStore.setState({
    hasHydrated: true,
    anonymousId: null,
    duNumber: null,
    themeMode: 'system',
    onboardingCompleted: false,
    privacyAcceptedAt: null,
  });
});

async function renderApp() {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer!;
}

async function completeOnboarding(
  renderer: ReactTestRenderer.ReactTestRenderer,
) {
  for (let index = 0; index < 2; index += 1) {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({accessibilityLabel: '继续'}).props.onPress();
    });
  }

  const startButton = renderer.root.findByProps({
    accessibilityLabel: '同意隐私政策并开始',
  });
  expect(startButton.props.disabled).toBe(true);

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '同意隐私政策'})
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '同意隐私政策并开始'})
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
}

test('blocks the home screen until privacy consent is accepted', async () => {
  const renderer = await renderApp();

  expect(
    renderer.root.findByProps({accessibilityLabel: '继续'}),
  ).toBeTruthy();

  await completeOnboarding(renderer);

  expect(
    renderer.root.findByProps({accessibilityLabel: '日迹'}),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('switches all tabs and theme modes', async () => {
  const renderer = await renderApp();
  await completeOnboarding(renderer);

  for (const label of ['信', '落笔', '远方', '我', '日迹']) {
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({accessibilityLabel: label}).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '我'}).props.onPress();
  });

  for (const label of ['浅色', '深色', '跟随系统']) {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({accessibilityLabel: label}).props.onPress();
    });
  }

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});
