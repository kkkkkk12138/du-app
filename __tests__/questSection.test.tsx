import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

const mockGetQuestAggregates = jest.fn();
const mockCreateQuest = jest.fn().mockResolvedValue(undefined);
const mockCreateQuestNode = jest.fn().mockResolvedValue(undefined);
const mockAddQuestSticky = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/features/faraway/questRepository', () => ({
  addQuestSticky: (...args: unknown[]) => mockAddQuestSticky(...args),
  createQuest: (...args: unknown[]) => mockCreateQuest(...args),
  createQuestNode: (...args: unknown[]) => mockCreateQuestNode(...args),
  deleteQuest: jest.fn().mockResolvedValue(undefined),
  deleteQuestNode: jest.fn().mockResolvedValue(undefined),
  deleteQuestSticky: jest.fn().mockResolvedValue(undefined),
  getQuestAggregates: (...args: unknown[]) => mockGetQuestAggregates(...args),
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
      surface: '#FFFDF8',
      surfaceWarm: '#FBF6EC',
      text: '#3A332D',
      textSoft: '#6B5F55',
      textMuted: '#9B8E82',
      textFaint: '#C4B8AA',
      accent: '#B85C38',
      line: 'rgba(58,51,45,0.08)',
    },
  }),
}));

import { QuestSection } from '../src/features/faraway/QuestSection';
import { journalDetailPaperColor } from '../src/features/faraway/journalPaper';

const quest = {
  id: 'quest-1',
  title: '周末手帐',
  themeColor: '#B85C38',
  isTemplate: false,
};
const node = {
  id: 'node-1',
  questId: quest.id,
  title: '去看展',
  icon: '展',
  x: 480,
  y: 720,
};
const sticky = {
  id: 'sticky-1',
  questId: quest.id,
  nodeId: node.id,
  text: '记得提前预约',
  color: 'yellow',
};

test('renders a compact auto-arranged journal canvas and keeps node stickies', async () => {
  mockGetQuestAggregates.mockResolvedValue([
    { quest, nodes: [node], edges: [], stickies: [sticky] },
  ]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<QuestSection userId="user-1" />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '副本手帐画布' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '加入节点' }),
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '副本工具移动' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '副本工具画线' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '副本工具钉节点' }),
  ).toHaveLength(0);
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '副本节点去看展' })
      .props.onPress();
  });

  expect(renderer.root.findByProps({ children: '记得提前预约' })).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '模糊背景浮层' }),
  ).toBeTruthy();
  const nodePaper = renderer.root.findByProps({
    accessibilityLabel: '节点去看展便利贴',
  });
  const nodePaperStyle = StyleSheet.flatten(nodePaper.props.style);
  expect(nodePaperStyle.backgroundColor).toBe(journalDetailPaperColor);
  const stickyText = renderer.root.findByProps({ children: '记得提前预约' });
  const stickyPaper = stickyText.parent;
  const stickyPaperStyle = StyleSheet.flatten(stickyPaper?.props.style);
  expect(stickyPaperStyle.backgroundColor).toBe('#F7E7A9');
  expect(
    renderer.root.findByProps({ accessibilityLabel: '贴纸内容' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '贴上便利贴' }),
  ).toBeTruthy();

  const stickyInput = renderer.root.findByProps({
    accessibilityLabel: '贴纸内容',
  });
  expect(stickyInput.props.value).toBeUndefined();
  expect(stickyInput.props.onSubmitEditing).toBeUndefined();
  await ReactTestRenderer.act(async () => {
    stickyInput.props.onChangeText('雨停后再出发');
    renderer.root
      .findByProps({ accessibilityLabel: '贴上便利贴' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockAddQuestSticky).toHaveBeenCalledWith({
    questId: 'quest-1',
    nodeId: 'node-1',
    text: '雨停后再出发',
    color: 'yellow',
  });

  await ReactTestRenderer.act(() => renderer.unmount());
});

test('keeps an example quest deletable without a persistent example badge', async () => {
  const exampleQuest = {
    ...quest,
    id: 'example-quest-cairo',
    title: '走遍开罗',
  };
  mockGetQuestAggregates.mockResolvedValue([
    {
      quest: exampleQuest,
      nodes: [{ ...node, questId: exampleQuest.id }],
      edges: [],
      stickies: [],
    },
  ]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<QuestSection userId="user-1" />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '范例内容' }).length,
  ).toBe(0);

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '打开副本走遍开罗' })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '删除副本走遍开罗' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => renderer.unmount());
});

test('keeps Chinese composition explicit and offers an optional cover', async () => {
  mockGetQuestAggregates.mockResolvedValue([]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<QuestSection userId="user-1" />);
    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '新建副本' })
      .props.onPress();
  });

  const input = renderer.root.findByProps({ accessibilityLabel: '副本名称' });
  expect(input.props.onSubmitEditing).toBeUndefined();
  expect(input.props.returnKeyType).toBe('default');
  expect(input.props.value).toBeUndefined();
  expect(input.props.maxLength).toBeUndefined();
  expect(input.props.defaultValue).toBe('');
  expect(
    renderer.root.findByProps({ accessibilityLabel: '选择副本封面' }),
  ).toBeTruthy();
  expect(renderer.root.findByProps({ children: '默认纸页封面' })).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    input.props.onChangeText('沿河散步计划');
    renderer.root
      .findByProps({ accessibilityLabel: '确认创建' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockCreateQuest).toHaveBeenCalledWith(
    expect.objectContaining({
      title: '沿河散步计划',
      userId: 'user-1',
    }),
  );

  await ReactTestRenderer.act(() => renderer.unmount());
});

test('keeps Chinese node composition uncontrolled until explicit submit', async () => {
  mockGetQuestAggregates.mockResolvedValue([
    { quest, nodes: [node], edges: [], stickies: [] },
  ]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<QuestSection userId="user-1" />);
    await Promise.resolve();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '加入节点' })
      .props.onPress();
  });

  const input = renderer.root.findByProps({ accessibilityLabel: '节点名称' });
  expect(input.props.value).toBeUndefined();
  expect(input.props.maxLength).toBeUndefined();
  expect(input.props.onSubmitEditing).toBeUndefined();

  await ReactTestRenderer.act(async () => {
    input.props.onChangeText('雨后书店');
    renderer.root
      .findByProps({ accessibilityLabel: '确认创建' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockCreateQuestNode).toHaveBeenCalledWith(
    expect.objectContaining({
      icon: '雨',
      questId: 'quest-1',
      title: '雨后书店',
    }),
  );

  await ReactTestRenderer.act(() => renderer.unmount());
});
