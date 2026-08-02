/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('switches all tabs and theme modes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  for (const label of ['信', '落笔', '远方', '我', '日迹']) {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({accessibilityLabel: label}).props.onPress();
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
