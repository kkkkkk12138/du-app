import RNFS from 'react-native-fs';

import {collectCheckoutMediaItems} from '../src/features/billing/mediaCheckoutInput';

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns no checkout items for a text-only entry', async () => {
  await expect(collectCheckoutMediaItems({})).resolves.toEqual([]);
  expect(RNFS.stat).not.toHaveBeenCalled();
});

test('collects actual byte sizes for every attached media file', async () => {
  (RNFS.stat as jest.Mock).mockImplementation(async path => {
    const sizes: Record<string, number> = {
      '/tmp/photo.jpg': 2_400_000,
      '/tmp/audio.m4a': 4_800_000,
      '/tmp/ink.png': 320_000,
    };
    return {size: sizes[path]};
  });

  await expect(
    collectCheckoutMediaItems({
      imagePath: 'file:///tmp/photo.jpg',
      audioPath: '/tmp/audio.m4a',
      audioDuration: 480,
      inkImagePath: '/tmp/ink.png',
    }),
  ).resolves.toEqual([
    {id: 'photo', kind: 'photo', bytes: 2_400_000},
    {
      id: 'audio',
      kind: 'audio',
      bytes: 4_800_000,
      durationSeconds: 480,
    },
    {id: 'ink', kind: 'ink', bytes: 320_000},
  ]);

  expect(RNFS.stat).toHaveBeenCalledWith('/tmp/photo.jpg');
});

test('rejects media whose file size cannot be read', async () => {
  (RNFS.stat as jest.Mock).mockRejectedValueOnce(new Error('missing'));

  await expect(
    collectCheckoutMediaItems({imagePath: '/tmp/missing.jpg'}),
  ).rejects.toThrow('无法读取媒体文件大小');
});

test('rejects an invalid native file size', async () => {
  (RNFS.stat as jest.Mock).mockResolvedValueOnce({size: -1});

  await expect(
    collectCheckoutMediaItems({imagePath: '/tmp/broken.jpg'}),
  ).rejects.toThrow('媒体文件大小无效');
});
