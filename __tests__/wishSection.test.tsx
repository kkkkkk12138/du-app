import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

const mockCreateWish = jest.fn().mockResolvedValue(undefined);
const mockCreateWishTape = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useReducedMotion: () => false,
  };
});

jest.mock('../src/features/faraway/wishRepository', () => ({
  createWishTape: (...args: unknown[]) => mockCreateWishTape(...args),
  createWish: (...args: unknown[]) => mockCreateWish(...args),
  deleteWishTape: jest.fn(),
  deleteWish: jest.fn(),
  getWishTapes: jest.fn().mockResolvedValue([]),
  getWishes: jest.fn().mockResolvedValue([
    {
      id: 'wish-1',
      title: '沿河走到入夜',
      note: '等风不那么急的时候出发。',
      color: 'yellow',
      category: 'place',
      status: 'active',
      pinned: false,
      createdAt: new Date(2026, 7, 5, 9),
      updatedAt: new Date(2026, 7, 5, 9),
    },
  ]),
  setWishFulfilled: jest.fn(),
  setWishPinned: jest.fn(),
  updateWish: jest.fn(),
  wishCategories: ['place', 'do', 'self', 'friend', 'time', 'habit'],
  wishTapeStyles: [
    'plain',
    'stripes',
    'blue',
    'green',
    'yellow',
    'vintage',
    'washi',
    'dots',
  ],
}));

jest.mock('../src/features/faraway/questRepository', () => ({
  addQuestSticky: jest.fn(),
  getQuestAggregates: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/components/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

jest.mock('../src/components/OverlayHost', () => ({
  OverlayPortal: ({
    blurBackground,
    children,
    visible,
  }: {
    blurBackground?: boolean;
    children: React.ReactNode;
    visible: boolean;
  }) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return visible
      ? ReactModule.createElement(
          View,
          {
            accessibilityLabel: blurBackground
              ? '模糊背景浮层'
              : '普通背景浮层',
          },
          children,
        )
      : null;
  },
}));

jest.mock('../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#B85C38',
      line: 'rgba(58,51,45,0.08)',
      surface: '#FFFDF8',
      surfaceWarm: '#FBF6EC',
      text: '#3A332D',
      textSoft: '#6B5F55',
      textMuted: '#9B8E82',
      textFaint: '#C4B8AA',
    },
  }),
}));

import { WishSection } from '../src/features/faraway/WishSection';
import { journalDetailPaperColor } from '../src/features/faraway/journalPaper';

test('opens a wish as a foreground sticky note over a blurred background', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<WishSection userId="user-1" />);
    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '查看念想沿河走到入夜' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '模糊背景浮层' }),
  ).toBeTruthy();
  const detailPaper = renderer.root.findByProps({
    accessibilityLabel: '念想纸页详情',
  });
  const detailPaperStyle = StyleSheet.flatten(detailPaper.props.style);
  expect(detailPaperStyle.backgroundColor).toBe(journalDetailPaperColor);
  expect(
    renderer.root.findAllByProps({ children: '沿河走到入夜' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findByProps({ accessibilityLabel: '关闭念想详情' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => renderer.unmount());
});

test('keeps wish and tape composition uncontrolled for Chinese and English', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<WishSection userId="user-1" />);
    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '记一笔念想' })
      .props.onPress();
  });
  const titleInput = renderer.root.findByProps({
    accessibilityLabel: '念想标题',
  });
  const noteInput = renderer.root.findByProps({
    accessibilityLabel: '念想备注',
  });
  for (const input of [titleInput, noteInput]) {
    expect(input.props.value).toBeUndefined();
    expect(input.props.maxLength).toBeUndefined();
  }
  await ReactTestRenderer.act(() => {
    titleInput.props.onChangeText('去 Kyoto 看晚樱');
    noteInput.props.onChangeText('从鸭川出发 walk slowly');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '保存念想' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockCreateWish).toHaveBeenCalledWith(
    expect.objectContaining({
      title: '去 Kyoto 看晚樱',
      note: '从鸭川出发 walk slowly',
    }),
  );

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '查看念想沿河走到入夜' })
      .props.onPress();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '给念想贴胶带' })
      .props.onPress();
  });
  const tapeInput = renderer.root.findByProps({
    accessibilityLabel: '胶带批注',
  });
  expect(tapeInput.props.value).toBeUndefined();
  expect(tapeInput.props.maxLength).toBeUndefined();
  await ReactTestRenderer.act(() => {
    tapeInput.props.onChangeText('记住 old bridge 的风');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '贴上胶带' })
      .props.onPress();
    await Promise.resolve();
  });
  expect(mockCreateWishTape).toHaveBeenCalledWith(
    expect.objectContaining({ text: '记住 old bridge 的风' }),
  );

  await ReactTestRenderer.act(() => renderer.unmount());
});
