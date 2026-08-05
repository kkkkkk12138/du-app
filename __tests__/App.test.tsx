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
import notifee from '@notifee/react-native';
import App from '../App';
import { createMemory } from '../src/db/memoryRepository';
import { getDailyData } from '../src/features/daily/dailyRepository';
import {
  getLetterDetail,
  getLettersData,
} from '../src/features/letters/lettersRepository';
import { createFutureLetter } from '../src/features/newLetter/futureLetterRepository';
import { updateProfile } from '../src/features/profile/profileRepository';
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

jest.mock('../src/navigation/linking', () => ({
  linking: undefined,
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

jest.mock('../src/db/productExamples', () => ({
  seedProductExamples: jest.fn().mockResolvedValue(false),
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

jest.mock('../src/features/faraway/farawayRepository', () => ({
  getFarawayData: jest.fn().mockResolvedValue({
    current: {
      id: 'shanghai',
      name: '上海',
      chChar: '沪',
      pinyin: 'Shanghai',
      colorHex: '#C0392B',
      type: 'current',
      visitCount: 1,
      sortOrder: 100,
      dateRange: '2025.2 — 至今',
      stayedDays: 530,
      tags: ['晚风'],
      latestMemory: {
        id: 'shanghai-memory',
        content: '风从江面吹过来。',
        placeId: 'shanghai',
        customTags: '["晚风"]',
        writtenAt: new Date(2026, 7, 2),
      },
      memories: [
        {
          id: 'shanghai-memory',
          content: '风从江面吹过来。',
          placeId: 'shanghai',
          customTags: '["晚风"]',
          writtenAt: new Date(2026, 7, 2),
        },
      ],
    },
    hometown: undefined,
    visited: [],
    cityCount: 1,
    locatedMemoryCount: 1,
    yearsLabel: '1年',
  }),
}));

jest.mock('../src/features/profile/profileRepository', () => ({
  getProfileData: jest.fn().mockResolvedValue({
    nickname: '渡河人',
    avatarChar: '渡',
    daysSinceJoining: 327,
    memoryCount: 8,
    placeCount: 3,
    letterCount: 2,
    questCount: 1,
    wishCount: 2,
  }),
  updateProfile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/features/newLetter/futureLetterRepository', () => ({
  createFutureLetter: jest.fn().mockResolvedValue({
    letter: {
      id: 'future-letter-id',
      arriveDate: new Date(2027, 7, 2),
    },
  }),
}));

jest.mock('../src/services/anonymousIdentity', () => ({
  initializeAnonymousIdentity: jest.fn().mockResolvedValue({
    anonymousId: 'test-anonymous-id',
    duNumber: '100327',
  }),
}));

beforeEach(async () => {
  await ReactTestRenderer.act(async () => {
    useSettingsStore.setState({
      hasHydrated: true,
      anonymousId: null,
      duNumber: null,
      themeMode: 'system',
      onboardingCompleted: false,
      privacyAcceptedAt: null,
    });
    await Promise.resolve();
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
  for (let index = 0; index < 3; index += 1) {
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

test('explains seeded reference content once during onboarding', async () => {
  const renderer = await renderApp();

  for (let index = 0; index < 2; index += 1) {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({ accessibilityLabel: '继续' }).props.onPress();
    });
  }

  expect(
    renderer.root.findByProps({
      children: '初见的内容，只作示范',
    }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => renderer.unmount());
});

test('opens the privacy policy before onboarding consent', async () => {
  const renderer = await renderApp();

  for (let index = 0; index < 3; index += 1) {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({ accessibilityLabel: '继续' }).props.onPress();
    });
  }
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '阅读隐私政策' })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '关闭隐私政策' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '关闭隐私政策' })
      .props.onPress();
    renderer.unmount();
  });
});

test('switches all tabs and exposes the prototype profile settings', async () => {
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
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '收起' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '我' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '艺术皮肤' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '深色外观' }),
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'iCloud 备份' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '导出我的数据' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '我的拼贴本' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '我的地图' }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '关于渡' }).props.onPress();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '数据与隐私' })
      .props.onPress();
    await Promise.resolve();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '完整备份' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '可读文稿' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '恢复完整备份' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('opens and closes the current place detail from Faraway', async () => {
  const renderer = await renderApp();
  await completeOnboarding(renderer);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '远方' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '查看当前停驻城市上海' })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '关闭地点详情' }),
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ children: '风从江面吹过来。' }).length,
  ).toBeGreaterThan(0);
  expect(renderer.root.findByProps({ nestedScrollEnabled: true })).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '关闭地点详情' })
      .props.onPress();
  });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '关闭地点详情' }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('opens every memory as a detail card with handwriting and location', async () => {
  const getDailyDataMock = getDailyData as jest.MockedFunction<
    typeof getDailyData
  >;
  const writtenAt = new Date(2026, 7, 2, 18, 30);
  getDailyDataMock.mockResolvedValue({
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

  const contentNode = renderer.root.findByProps({
    children: '这一刻有手书，也有真实坐标。',
  });
  let pressable = contentNode.parent;
  while (pressable && typeof pressable.props.onPress !== 'function') {
    pressable = pressable.parent;
  }
  expect(pressable).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    pressable?.props.onPress();
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
  getDailyDataMock.mockResolvedValue({
    memories: [],
    arrivedLetter: null,
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
  } as any;
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
    renderer.root.findAllByProps({ accessibilityLabel: '合上信件' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findByProps({ accessibilityLabel: '已拆信详情' }),
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ children: '这是一封已经拆开的原信。' })
      .length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({ children: 'AUG 2025' }).length,
  ).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ children: 'AUG 2026' })).toHaveLength(
    0,
  );

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findAllByProps({ accessibilityLabel: '合上信件' })[0]
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

test('renders distinct prototype sheets for traveling and arriving letters', async () => {
  const getLettersDataMock = getLettersData as jest.MockedFunction<
    typeof getLettersData
  >;
  const memory = {
    id: 'future-memory',
    type: 'text',
    content: '留给未来的这一封信。',
    placeDetail: '上海',
    createdAt: new Date(2026, 7, 4),
    updatedAt: new Date(2026, 7, 4),
    writtenAt: new Date(2026, 7, 4),
  } as any;
  const travelingItem = {
    letter: {
      id: 'traveling-letter',
      memoryId: 'future-memory',
      sentAt: new Date(2026, 7, 4),
      arriveDate: new Date(2027, 7, 4),
      toName: '未来的自己',
      status: 'traveling',
    },
    memory,
  } as any;

  getLettersDataMock.mockResolvedValue({
    arriving: [],
    traveling: [travelingItem],
    opened: [],
    tomorrowCount: 0,
  });
  const travelingRenderer = await renderApp();
  await completeOnboarding(travelingRenderer);
  await ReactTestRenderer.act(async () => {
    travelingRenderer.root
      .findByProps({ accessibilityLabel: '信' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  const travelingCard = travelingRenderer.root.find(
    node =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.includes('还有') &&
      node.props.accessibilityLabel.includes('天到达'),
  );
  await ReactTestRenderer.act(() => travelingCard.props.onPress());
  expect(
    travelingRenderer.root.findByProps({
      accessibilityLabel: '在途信详情',
    }),
  ).toBeTruthy();
  expect(
    travelingRenderer.root.find(
      node =>
        Array.isArray(node.props.children) &&
        node.props.children.join('') === '「写给未来的自己」尚在山水间跋涉',
    ),
  ).toBeTruthy();
  expect(
    travelingRenderer.root.findAllByProps({
      accessibilityLabel: '这封信到达时提醒',
    }),
  ).toHaveLength(0);
  expect(
    travelingRenderer.root.findAllByProps({
      accessibilityLabel: '删除这封在途信',
    }),
  ).toHaveLength(0);
  await ReactTestRenderer.act(() => travelingRenderer.unmount());

  const arrivingItem = {
    ...travelingItem,
    letter: {
      ...travelingItem.letter,
      id: 'arriving-letter',
      arriveDate: new Date(2026, 7, 4),
      status: 'arrived',
    },
  } as any;
  getLettersDataMock.mockResolvedValue({
    arriving: [arrivingItem],
    traveling: [],
    opened: [],
    tomorrowCount: 0,
  });
  const arrivingRenderer = await renderApp();
  await ReactTestRenderer.act(async () => {
    arrivingRenderer.root
      .findByProps({ accessibilityLabel: '信' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(() => {
    arrivingRenderer.root
      .findByProps({ accessibilityLabel: '拆开写给未来的自己' })
      .props.onPress();
  });
  expect(
    arrivingRenderer.root.findByProps({
      accessibilityLabel: '将至信详情',
    }),
  ).toBeTruthy();
  expect(
    arrivingRenderer.root.findByProps({ children: '有信将至' }),
  ).toBeTruthy();
  expect(
    arrivingRenderer.root.findByProps({ children: '火漆尚温，宜静候' }),
  ).toBeTruthy();
  await ReactTestRenderer.act(() => arrivingRenderer.unmount());

  getLettersDataMock.mockResolvedValue({
    arriving: [],
    traveling: [],
    opened: [],
    tomorrowCount: 0,
  });
});

test('enables the daily reminder with the prototype inline time picker', async () => {
  const requestNotificationMock =
    notifee.requestPermission as jest.MockedFunction<
      typeof notifee.requestPermission
    >;
  requestNotificationMock.mockResolvedValueOnce({
    authorizationStatus: 1,
  } as never);
  await ReactTestRenderer.act(async () => {
    useSettingsStore.setState({
      dailyReminderOn: false,
      dailyReminderTime: '22:30',
    });
    await Promise.resolve();
  });

  const renderer = await renderApp();
  await completeOnboarding(renderer);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '我' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '每日提醒' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  const picker = renderer.root.findByProps({
    accessibilityLabel: '每天几点提醒落笔',
  });
  expect(picker.props.open).toBe(true);
  await ReactTestRenderer.act(async () => {
    picker.props.onConfirm(new Date(2026, 7, 3, 18, 45));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(useSettingsStore.getState().dailyReminderTime).toBe('18:45');
  expect(useSettingsStore.getState().dailyReminderOn).toBe(true);
  expect(requestNotificationMock).toHaveBeenCalled();

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('keeps daily reminders off when notification access is denied', async () => {
  const requestNotificationMock =
    notifee.requestPermission as jest.MockedFunction<
      typeof notifee.requestPermission
    >;
  requestNotificationMock.mockResolvedValueOnce({
    authorizationStatus: 0,
  } as never);
  await ReactTestRenderer.act(async () => {
    useSettingsStore.setState({ dailyReminderOn: false });
    await Promise.resolve();
  });

  const renderer = await renderApp();
  await completeOnboarding(renderer);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '我' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '每日提醒' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(useSettingsStore.getState().dailyReminderOn).toBe(false);
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('edits and persists the local profile', async () => {
  const updateProfileMock = updateProfile as jest.MockedFunction<
    typeof updateProfile
  >;
  updateProfileMock.mockClear();
  const renderer = await renderApp();
  await completeOnboarding(renderer);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '我' }).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '编辑个人资料' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '昵称' })
      .props.onChangeText('写字的人');
    renderer.root
      .findByProps({ accessibilityLabel: '头像 舟' })
      .props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '保存个人资料' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(updateProfileMock).toHaveBeenCalledWith(
    expect.objectContaining({ nickname: '写字的人', avatarChar: '舟' }),
  );
  await ReactTestRenderer.act(() => renderer.unmount());
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

  await ReactTestRenderer.act(async () => {
    useSettingsStore.setState({
      onboardingCompleted: false,
      privacyAcceptedAt: null,
    });
    await Promise.resolve();
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
  for (const label of ['一年后', '半年后', '三个月后', '自选']) {
    expect(
      futureRenderer.root.findByProps({ accessibilityLabel: label }),
    ).toBeTruthy();
  }
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '一年后' })
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    futureRenderer.root
      .findByProps({ accessibilityLabel: '盖上邮戳' })
      .props.onPress();
  });
  createMemoryMock.mockClear();
  const createFutureLetterMock = createFutureLetter as jest.MockedFunction<
    typeof createFutureLetter
  >;
  createFutureLetterMock.mockClear();
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
    await new Promise<void>(resolve => setTimeout(resolve, 1300));
  });
  expect(createMemoryMock).not.toHaveBeenCalled();
  expect(createFutureLetterMock).toHaveBeenCalledWith(
    expect.objectContaining({
      draft: expect.objectContaining({ content: '留给一年后的我。' }),
      arriveType: 'one_year',
    }),
  );
  expect(
    futureRenderer.root.findAllByProps({ accessibilityLabel: '返回此刻' }),
  ).toHaveLength(0);
  expect(
    futureRenderer.root.findByProps({ accessibilityLabel: '信' }),
  ).toBeTruthy();

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
