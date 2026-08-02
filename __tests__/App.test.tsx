/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {createMemory} from '../src/db/memoryRepository';
import {useSettingsStore} from '../src/store/useSettingsStore';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  return {
    ...Reanimated,
    useReducedMotion: () => false,
  };
});

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
  createMemory: jest.fn().mockResolvedValue({id: 'new-memory-id'}),
  getRecentMemories: jest.fn().mockResolvedValue([]),
  verifyMemoryRoundTrip: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/features/daily/dailyRepository', () => ({
  getDailyData: jest.fn().mockResolvedValue({
    memories: [],
    arrivedLetter: null,
  }),
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

  for (const label of ['信', '远方', '我', '日迹']) {
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({accessibilityLabel: label}).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '落笔'}).props.onPress();
  });
  expect(
    renderer.root.findByProps({accessibilityLabel: '此刻内容'}),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '收起'}).props.onPress();
  });

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

test('writes real content and keeps future letters out of Memory storage', async () => {
  const createMemoryMock = createMemory as jest.MockedFunction<
    typeof createMemory
  >;
  createMemoryMock.mockClear();
  const renderer = await renderApp();
  await completeOnboarding(renderer);

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '落笔'}).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '落下此刻'}).props.onPress();
  });
  expect(createMemoryMock).not.toHaveBeenCalled();

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '此刻内容'})
      .props.onChangeText('今天终于把这一笔落下来了。');
    renderer.root.findByProps({accessibilityLabel: '感觉分类心'}).props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '平静'}).props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '自己写感觉'})
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '自定义感觉'})
      .props.onChangeText('今天有点软');
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '加入自定义感觉'})
      .props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '落下此刻'}).props.onPress();
    await Promise.resolve();
  });

  expect(createMemoryMock).toHaveBeenCalledWith(
    expect.objectContaining({
      content: '今天终于把这一笔落下来了。',
      customTags: ['平静', '今天有点软'],
    }),
  );

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });

  useSettingsStore.setState({
    onboardingCompleted: false,
    privacyAcceptedAt: null,
  });
  const futureRenderer = await renderApp();
  await completeOnboarding(futureRenderer);
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({accessibilityLabel: '落笔'})
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({accessibilityLabel: '未来信模式'})
      .props.onPress();
  });
  createMemoryMock.mockClear();
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({accessibilityLabel: '继续写未来信'})
      .props.onPress();
  });
  expect(
    futureRenderer.root.findByProps({accessibilityLabel: '此刻内容'}),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({accessibilityLabel: '此刻内容'})
      .props.onChangeText('留给一年后的我。');
  });
  await ReactTestRenderer.act(async () => {
    futureRenderer.root
      .findByProps({accessibilityLabel: '继续写未来信'})
      .props.onPress();
    await new Promise<void>(resolve => setTimeout(resolve, 250));
  });
  expect(createMemoryMock).not.toHaveBeenCalled();
  expect(
    futureRenderer.root.findByProps({accessibilityLabel: '返回此刻'}),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({accessibilityLabel: '返回此刻'})
      .props.onPress();
  });
  expect(
    futureRenderer.root.findByProps({accessibilityLabel: '此刻内容'}).props
      .value,
  ).toBe('留给一年后的我。');

  await ReactTestRenderer.act(() => {
    futureRenderer.unmount();
  });
});
