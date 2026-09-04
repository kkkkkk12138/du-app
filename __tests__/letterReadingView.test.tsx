import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {startsWithLetterSalutation} from '../src/features/letters/letterTextStyle';
import { LetterReadingView } from '../src/features/unseal/LetterReadingView';

test('recognizes an existing handwritten salutation', () => {
  expect(startsWithLetterSalutation('展信安。\n窗外刚下过雨。')).toBe(true);
  expect(startsWithLetterSalutation('这是一封普通正文。')).toBe(false);
});

test('uses the full screen as letter paper and keeps controls in the footer', async () => {
  const writtenAt = new Date(2025, 7, 2, 18, 30);
  const item = {
    letter: {
      id: 'opened-letter',
      memoryId: 'opened-memory',
      sentAt: writtenAt,
      arriveDate: new Date(2026, 7, 2, 9),
      arriveType: 'one_year',
      toType: 'future_self',
      toName: '未来的自己',
      status: 'opened',
      openedAt: new Date(2026, 7, 2, 9),
    },
    memory: {
      id: 'opened-memory',
      content: '这是一封占满屏幕的信。',
      customTags: '[]',
      writtenAt,
      createdAt: writtenAt,
      updatedAt: writtenAt,
      isFutureLetter: true,
      deleted: false,
    },
  } as never;
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <LetterReadingView
        item={item}
        sourceLabel="信箱"
        onArchive={jest.fn()}
        onBack={jest.fn()}
        onDelete={jest.fn()}
        onError={jest.fn()}
        onReply={jest.fn()}
      />,
    );
  });

  const scroll = renderer.root.findByType(ScrollView);
  const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
  expect(contentStyle.flexGrow).toBe(1);
  expect(contentStyle.paddingHorizontal).toBeUndefined();
  expect(renderer.root.findByProps({ children: '收起' })).toBeTruthy();
  const collapseControl = renderer.root.findByProps({
    testID: 'letter-reading-collapse',
  });
  const collapseStyle = StyleSheet.flatten(
    collapseControl.props.style({ pressed: false }),
  );
  expect(collapseControl.props.accessibilityLabel).toBe('返回信箱');
  expect(collapseStyle.minWidth).toBe(44);
  expect(collapseStyle.minHeight).toBe(44);
  expect(collapseStyle.alignItems).toBe('flex-start');
  expect(collapseStyle.justifyContent).toBe('center');
  expect(collapseStyle.paddingHorizontal).toBeGreaterThan(0);
  expect(
    renderer.root.findByProps({ accessibilityLabel: '写封回信' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ accessibilityLabel: '删除这封信' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ testID: 'full-letter-rules' }),
  ).toBeTruthy();
  const rules = renderer.root.findByProps({ testID: 'full-letter-rules' });
  const rulesStyle = StyleSheet.flatten(rules.props.style);
  expect(rulesStyle.top).toBe(9);
  const paragraph = renderer.root.findByProps({
    children: '这是一封占满屏幕的信。',
  });
  const paragraphStyle = StyleSheet.flatten(paragraph.props.style);
  expect(paragraphStyle.lineHeight).toBe(32);
  expect(paragraphStyle.fontSize).toBe(15);
  expect(paragraphStyle.fontStyle).toBe('italic');
  expect(paragraphStyle.letterSpacing).toBe(0.32);
  expect(paragraphStyle.includeFontPadding).toBe(false);
  expect(paragraphStyle.color).toBe('#3B322A');
  expect(paragraphStyle.textShadowColor).toBe('rgba(110,78,52,0.12)');

  await ReactTestRenderer.act(() => renderer.unmount());
});
