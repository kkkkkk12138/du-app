import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';

import {useAudioPlayback} from '../src/hooks/useAudioPlayback';

type Playback = ReturnType<typeof useAudioPlayback>;
type MockPlayer = {
  path: string;
  play: jest.Mock;
  pause: jest.Mock;
  release: jest.Mock;
};
type MockSoundClass = typeof Sound & {
  instances: MockPlayer[];
  setActive: jest.Mock;
  setCategory: jest.Mock;
};

test('plays the persisted recording and restores the playback audio session', async () => {
  const SoundMock = Sound as MockSoundClass;
  SoundMock.instances.length = 0;
  SoundMock.setActive.mockClear();
  SoundMock.setCategory.mockClear();
  const onError = jest.fn();
  let playback: Playback;

  function Harness() {
    playback = useAudioPlayback({
      path: '/tmp/du-attachments/audio-real.wav',
      fallbackDuration: 12,
      onError,
    });
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });

  await ReactTestRenderer.act(async () => {
    await playback!.toggle();
    await Promise.resolve();
    await Promise.resolve();
  });

  const player = SoundMock.instances[0];
  expect(player.path).toBe('/tmp/du-attachments/audio-real.wav');
  expect(SoundMock.setCategory).toHaveBeenCalledWith('Playback');
  expect(SoundMock.setActive).toHaveBeenCalledWith(true);
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(playback!.playing).toBe(true);
  expect(onError).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    await playback!.toggle();
  });
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(SoundMock.setActive).toHaveBeenCalledWith(false);

  await ReactTestRenderer.act(() => renderer!.unmount());
  expect(player.release).toHaveBeenCalledTimes(1);
});

test('rejects an empty recording instead of pretending to play it', async () => {
  const SoundMock = Sound as MockSoundClass;
  SoundMock.instances.length = 0;
  (RNFS.stat as jest.Mock).mockResolvedValueOnce({size: 4096});
  const onError = jest.fn();
  let playback: Playback;

  function Harness() {
    playback = useAudioPlayback({
      path: '/tmp/du-attachments/audio-empty.wav',
      fallbackDuration: 12,
      onError,
    });
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    await playback!.toggle();
  });

  expect(SoundMock.instances).toHaveLength(0);
  expect(onError).toHaveBeenCalledWith(
    '这段录音文件是空的，请重新录制',
  );
  await ReactTestRenderer.act(() => renderer!.unmount());
});
