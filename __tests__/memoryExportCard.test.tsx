import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { Memory } from '../src/db/models';
import { MemoryExportCard } from '../src/features/daily/MemoryExportCard';

function memory(overrides: Partial<Memory> = {}) {
  return {
    id: 'memory-1',
    content: '风从江面吹过来。',
    customTags: '["晚风"]',
    writtenAt: new Date(2026, 7, 3, 19, 24),
    ...overrides,
  } as Memory;
}

test('exports only the memory when no reply exists', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MemoryExportCard memory={memory()} replies={[]} />,
    );
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: '导出内容画布' }),
  ).toBeTruthy();
  expect(
    renderer.root.findAllByProps({
      children: '这里还没有回声。以后再读到时，也许会想说点什么。',
    }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ children: '后来，你这样回信' }),
  ).toHaveLength(0);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('keeps the full reply content in the exported card', async () => {
  const reply = memory({
    id: 'reply-1',
    content: '后来我终于明白，那阵风把我送到了更远的地方。',
    writtenAt: new Date(2027, 7, 3, 8, 30),
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MemoryExportCard memory={memory()} replies={[reply]} />,
    );
  });

  expect(
    renderer.root.findByProps({ children: reply.content }).props.numberOfLines,
  ).toBeUndefined();
  expect(
    renderer.root.findByProps({ children: '后来，你这样回信' }),
  ).toBeTruthy();
  ReactTestRenderer.act(() => renderer.unmount());
});
