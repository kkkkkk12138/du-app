import React from 'react';
import { Share } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../src/components/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

jest.mock('../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#B85C38',
      background: '#F7F1E5',
      surface: '#FFFDF8',
      text: '#3A332D',
      textSoft: '#6B5F55',
      textFaint: '#C4B8AA',
    },
  }),
}));

import { ReplySheet } from '../src/features/daily/MemoryDetailSheets';
import { FeedbackScreen } from '../src/features/profile/FeedbackScreen';

function expectImeSafe(input: ReactTestRenderer.ReactTestInstance) {
  expect(input.props.value).toBeUndefined();
  expect(input.props.maxLength).toBeUndefined();
  expect(input.props.onSubmitEditing).toBeUndefined();
}

test('submits mixed Chinese and English feedback without controlled input', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<FeedbackScreen />);
  });
  const input = renderer.root.findByProps({ accessibilityLabel: '反馈内容' });
  expectImeSafe(input);

  await ReactTestRenderer.act(() => {
    input.props.onChangeText('定位输入 mixed text 可以正常保留。');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '发送反馈' })
      .props.onPress();
    await Promise.resolve();
  });
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('定位输入 mixed text 可以正常保留。'),
    }),
  );

  share.mockRestore();
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('submits mixed Chinese and English reply without controlled input', async () => {
  const onSend = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ReplySheet onClose={jest.fn()} onSend={onSend} submitting={false} />,
    );
  });
  const input = renderer.root.findByProps({ accessibilityLabel: '回信内容' });
  expectImeSafe(input);

  await ReactTestRenderer.act(() => {
    input.props.onChangeText('后来在 London 又想起那场雨。');
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: '夹进这页' })
      .props.onPress();
  });
  expect(onSend).toHaveBeenCalledWith('后来在 London 又想起那场雨。');

  await ReactTestRenderer.act(() => renderer.unmount());
});
