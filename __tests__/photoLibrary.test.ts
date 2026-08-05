import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';

import { pickPhotoFromLibrary } from '../src/services/photoLibrary';

const launchImageLibraryMock = launchImageLibrary as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('leaves the draft unchanged when system picker is cancelled', async () => {
  launchImageLibraryMock.mockResolvedValueOnce({ didCancel: true });

  await expect(pickPhotoFromLibrary()).resolves.toEqual({
    status: 'cancelled',
  });
  expect(RNFS.copyFile).not.toHaveBeenCalled();
});

test('copies one selected photo into the private draft directory', async () => {
  launchImageLibraryMock.mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///tmp/image-picker/photo.jpg',
        fileSize: 2_048,
        type: 'image/jpeg',
      },
    ],
  });

  const result = await pickPhotoFromLibrary();

  expect(result).toEqual({
    status: 'selected',
    path: expect.stringContaining('/du-drafts/photo-'),
  });
  expect(RNFS.copyFile).toHaveBeenCalledWith(
    '/tmp/image-picker/photo.jpg',
    expect.stringContaining('/du-drafts/photo-'),
  );
  expect(RNFS.unlink).not.toHaveBeenCalledWith('/tmp/image-picker/photo.jpg');
});

test('rejects an oversized selected photo before copying', async () => {
  launchImageLibraryMock.mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///tmp/image-picker/large.jpg',
        fileSize: 26 * 1024 * 1024,
        type: 'image/jpeg',
      },
    ],
  });

  await expect(pickPhotoFromLibrary()).resolves.toEqual({
    status: 'error',
    message: '照片超过 25 MB，请选择较小的图片',
  });
  expect(RNFS.copyFile).not.toHaveBeenCalled();
});
