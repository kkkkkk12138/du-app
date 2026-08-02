/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  activateKeepAwake,
  deactivateKeepAwake,
} from '@sayem314/react-native-keep-awake';
import { AppState } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import Geolocation from 'react-native-geolocation-service';
import { request } from 'react-native-permissions';
import App from '../App';
import { createMemory } from '../src/db/memoryRepository';
import { getDailyData } from '../src/features/daily/dailyRepository';
import {
  getLetterDetail,
  getLettersData,
} from '../src/features/letters/lettersRepository';
import { useSettingsStore } from '../src/store/useSettingsStore';

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
    DatabaseProvider: ({ children }: { children: React.ReactNode }) =>
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
  createMemory: jest.fn().mockResolvedValue({ id: 'new-memory-id' }),
  getRecentMemories: jest.fn().mockResolvedValue([]),
  verifyMemoryRoundTrip: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/features/daily/dailyRepository', () => ({
  getDailyData: jest.fn().mockResolvedValue({
    memories: [],
    arrivedLetter: null,
  }),
}));

jest.mock('../src/features/daily/memoryDetailRepository', () => ({
  getMemoryDetailData: jest.fn().mockResolvedValue({
    replies: [],
    stamp: null,
  }),
  createMemoryReply: jest.fn(),
  setMemoryStamp: jest.fn(),
  removeMemoryStamp: jest.fn(),
}));

jest.mock('../src/features/letters/lettersRepository', () => ({
  daysUntil: jest.fn().mockReturnValue(0),
  getLetterProgress: jest.fn().mockReturnValue(0),
  getLettersData: jest.fn().mockResolvedValue({
    arriving: [],
    traveling: [],
    opened: [],
    tomorrowCount: 0,
  }),
  getLetterDetail: jest.fn().mockRejectedValue(new Error('没有可拆的信')),
  markLetterOpened: jest.fn().mockResolvedValue(undefined),
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
      renderer.root.findByProps({ accessibilityLabel: '继续' }).props.onPress();
    });
  }

  const startButton = renderer.root.findByProps({
    accessibilityLabel: '同意隐私政策并开始',
  });
  expect(startButton.props.disabled).toBe(true);

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '同意隐私政策' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '同意隐私政策并开始' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
}

test('blocks the home screen until privacy consent is accepted', async () => {
  const renderer = await renderApp();

  expect(
    renderer.root.findByProps({ accessibilityLabel: '继续' }),
  ).toBeTruthy();

  await completeOnboarding(renderer);

  expect(
    renderer.root.findByProps({ accessibilityLabel: '日迹' }),
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
      renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '落笔' }).props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '此刻内容' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '收起' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '我' }).props.onPress();
  });

  for (const label of ['浅色', '深色', '跟随系统']) {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
    });
  }

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('opens every memory as a detail card with handwriting and location', async () => {
  const getDailyDataMock = getDailyData as jest.MockedFunction<
    typeof getDailyData
  >;
  const writtenAt = new Date(2026, 7, 2, 18, 30);
  getDailyDataMock.mockResolvedValueOnce({
    memories: [
      {
        id: 'detail-memory',
        type: 'text',
        content: '这一刻有手书，也有真实坐标。',
        customTags: '["平静","晚风"]',
        bodyTags: '[]',
        heartTags: '[]',
        inkImagePath: '/tmp/du-attachments/ink-detail.png',
        placeDetail: '31.23040, 121.47370',
        writtenAt,
        createdAt: writtenAt,
        updatedAt: writtenAt,
        isFutureLetter: false,
        deleted: false,
      } as never,
    ],
    arrivedLetter: null,
  });

  const renderer = await renderApp();
  await completeOnboarding(renderer);
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '手书缩略图' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({
        accessibilityLabel: '文字日迹，这一刻有手书，也有真实坐标。',
      })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '手书原图' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '此刻位置，31.23040, 121.47370',
    }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '收起日迹详情' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('opens an archived letter and returns through the mailbox header', async () => {
  const writtenAt = new Date(2025, 7, 2, 18, 30);
  const openedAt = new Date(2026, 7, 2, 9);
  const item = {
    letter: {
      id: 'opened-letter',
      memoryId: 'opened-memory',
      sentAt: writtenAt,
      arriveDate: openedAt,
      arriveType: 'one_year',
      toType: 'future_self',
      toName: '未来的自己',
      status: 'opened',
      openedAt,
    },
    memory: {
      id: 'opened-memory',
      content: '这是一封已经拆开的原信。',
      customTags: '[]',
      writtenAt,
      createdAt: writtenAt,
      updatedAt: writtenAt,
      isFutureLetter: true,
      deleted: false,
    },
  } as never;
  const getLettersDataMock = getLettersData as jest.MockedFunction<
    typeof getLettersData
  >;
  const getLetterDetailMock = getLetterDetail as jest.MockedFunction<
    typeof getLetterDetail
  >;
  getLettersDataMock.mockResolvedValue({
    arriving: [],
    traveling: [],
    opened: [item],
    tomorrowCount: 0,
  });
  getLetterDetailMock.mockResolvedValue(item);

  const renderer = await renderApp();
  await completeOnboarding(renderer);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '信' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({
        accessibilityLabel: '查看原信，写给未来的自己',
      })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '返回信箱' }),
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ children: '这是一封已经拆开的原信。' })
      .length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '返回信箱' })
      .props.onPress();
    await Promise.resolve();
  });
  expect(renderer.root.findByProps({ accessibilityLabel: '信' })).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
  getLettersDataMock.mockResolvedValue({
    arriving: [],
    traveling: [],
    opened: [],
    tomorrowCount: 0,
  });
  getLetterDetailMock.mockRejectedValue(new Error('没有可拆的信'));
});

test('writes real content and keeps future letters out of Memory storage', async () => {
  const createMemoryMock = createMemory as jest.MockedFunction<
    typeof createMemory
  >;
  createMemoryMock.mockClear();
  const renderer = await renderApp();
  await completeOnboarding(renderer);

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '落笔' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '落下此刻' })
      .props.onPress();
  });
  expect(createMemoryMock).not.toHaveBeenCalled();

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '此刻内容' })
      .props.onChangeText('今天终于把这一笔落下来了。');
    renderer.root
      .findByProps({ accessibilityLabel: '感觉分类心' })
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '平静' }).props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '自己写感觉' })
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '自定义感觉' })
      .props.onChangeText('今天有点软');
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '加入自定义感觉' })
      .props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '落下此刻' })
      .props.onPress();
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
      .findByProps({ accessibilityLabel: '落笔' })
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '未来信模式' })
      .props.onPress();
  });
  createMemoryMock.mockClear();
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '继续写未来信' })
      .props.onPress();
  });
  expect(
    futureRenderer.root.findByProps({ accessibilityLabel: '此刻内容' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '此刻内容' })
      .props.onChangeText('留给一年后的我。');
  });
  await ReactTestRenderer.act(async () => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '继续写未来信' })
      .props.onPress();
    await new Promise<void>(resolve => setTimeout(resolve, 250));
  });
  expect(createMemoryMock).not.toHaveBeenCalled();
  expect(
    futureRenderer.root.findByProps({ accessibilityLabel: '返回此刻' }),
  ).toBeTruthy();
  expect(
    futureRenderer.root.findByProps({ children: '留给一年后的我。' }),
  ).toBeTruthy();
  for (const label of ['一年后', '半年后', '三个月后', '自定义']) {
    expect(
      futureRenderer.root.findByProps({ accessibilityLabel: label }),
    ).toBeTruthy();
  }
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '返回此刻' })
      .props.onPress();
  });
  expect(
    futureRenderer.root.findByProps({ accessibilityLabel: '此刻内容' }).props
      .value,
  ).toBe('留给一年后的我。');

  await ReactTestRenderer.act(() => {
    futureRenderer.unmount();
  });
});

test('adds real Stage 4 attachments only after tool interaction', async () => {
  const appStateSpy = jest.spyOn(AppState, 'addEventListener');
  const createMemoryMock = createMemory as jest.MockedFunction<
    typeof createMemory
  >;
  const getCurrentPositionMock =
    Geolocation.getCurrentPosition as jest.MockedFunction<
      typeof Geolocation.getCurrentPosition
    >;
  const stopRecordingMock = AudioRecord.stop as jest.MockedFunction<
    typeof AudioRecord.stop
  >;
  const requestPermissionMock = request as jest.MockedFunction<typeof request>;
  const activateKeepAwakeMock = activateKeepAwake as jest.MockedFunction<
    typeof activateKeepAwake
  >;
  const deactivateKeepAwakeMock = deactivateKeepAwake as jest.MockedFunction<
    typeof deactivateKeepAwake
  >;
  createMemoryMock.mockClear();
  requestPermissionMock.mockClear();
  activateKeepAwakeMock.mockClear();
  deactivateKeepAwakeMock.mockClear();
  getCurrentPositionMock.mockImplementation(success =>
    success({
      coords: {
        latitude: 31.2304,
        longitude: 121.4737,
        accuracy: 10,
        altitude: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    }),
  );
  stopRecordingMock.mockResolvedValue('/tmp/du-recording.wav');

  const renderer = await renderApp();
  await completeOnboarding(renderer);
  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '落笔' }).props.onPress();
  });

  expect(getCurrentPositionMock).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '位置' }).props.onPress();
    await Promise.resolve();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '移除位置' }),
  ).toBeTruthy();

  expect(requestPermissionMock).not.toHaveBeenCalled();
  expect(activateKeepAwakeMock).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '录音' }).props.onPress();
    await Promise.resolve();
  });
  expect(requestPermissionMock).toHaveBeenCalledTimes(1);
  expect(activateKeepAwakeMock).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ accessibilityLabel: '完成录音' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    for (const [, listener] of appStateSpy.mock.calls) {
      listener('background');
    }
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(deactivateKeepAwakeMock).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({ accessibilityLabel: '删除录音' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: '手书' }).props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '取消手书' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '取消手书' })
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '此刻内容' })
      .props.onChangeText('带着声音和坐标的一笔。');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '落下此刻' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(createMemoryMock).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'audio',
      audioPath: expect.stringContaining('audio-'),
      audioDuration: 1,
      placeDetail: '31.23040, 121.47370',
    }),
  );

  await ReactTestRenderer.act(() => renderer.unmount());
  appStateSpy.mockRestore();
});
