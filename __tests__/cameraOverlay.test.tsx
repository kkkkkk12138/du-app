import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockArchiveDraftMediaFile = jest
  .fn()
  .mockResolvedValue('/tmp/du-drafts/photo-preview.jpg');
const mockRemoveMediaFile = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native-vision-camera', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return {
    Camera: ReactModule.forwardRef(
      (
        props: Record<string, unknown>,
        ref: React.MutableRefObject<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          takePhoto: jest.fn().mockResolvedValue({
            path: '/tmp/camera/photo.jpg',
          }),
        }));
        return ReactModule.createElement(View, {
          ...props,
          accessibilityLabel: '测试相机',
        });
      },
    ),
    useCameraDevice: () => ({id: 'back-camera'}),
  };
});

jest.mock('../src/services/mediaStorage', () => ({
  archiveDraftMediaFile: (...args: unknown[]) =>
    mockArchiveDraftMediaFile(...args),
  removeMediaFile: (...args: unknown[]) => mockRemoveMediaFile(...args),
}));

import {CameraOverlay} from '../src/features/write/CameraOverlay';

test('shows a confirmation preview before accepting a captured photo', async () => {
  const onCapture = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CameraOverlay onCancel={jest.fn()} onCapture={onCapture} />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '拍下此刻'})
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '拍摄照片预览'}),
  ).toBeTruthy();
  expect(onCapture).not.toHaveBeenCalled();

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({accessibilityLabel: '使用照片'})
      .props.onPress();
  });
  expect(onCapture).toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-preview.jpg',
  );

  await ReactTestRenderer.act(() => renderer.unmount());
});

test('removes the captured draft when the user retakes', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CameraOverlay onCancel={jest.fn()} onCapture={jest.fn()} />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '拍下此刻'})
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '重拍'}).props.onPress();
    await Promise.resolve();
  });

  expect(mockRemoveMediaFile).toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-preview.jpg',
  );
  expect(
    renderer.root.findByProps({accessibilityLabel: '拍下此刻'}),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => renderer.unmount());
});
