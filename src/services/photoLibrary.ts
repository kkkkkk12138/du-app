import { launchImageLibrary } from 'react-native-image-picker';

import { archiveDraftMediaFile } from './mediaStorage';

const maximumPhotoBytes = 25 * 1024 * 1024;

export type PhotoLibraryResult =
  | { status: 'selected'; path: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function fallbackExtension(mimeType?: string) {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return 'heic';
  }
  return 'jpg';
}

export async function pickPhotoFromLibrary(): Promise<PhotoLibraryResult> {
  const response = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: false,
    includeExtra: false,
    maxWidth: 4096,
    maxHeight: 4096,
    quality: 0.9,
    assetRepresentationMode: 'compatible',
  });

  if (response.didCancel) {
    return { status: 'cancelled' };
  }
  if (response.errorCode) {
    return {
      status: 'error',
      message:
        response.errorCode === 'permission'
          ? '系统没有允许读取这张照片'
          : '照片没有导入，请再试一次',
    };
  }

  const asset = response.assets?.[0];
  if (!asset?.uri) {
    return { status: 'error', message: '没有读取到可用照片' };
  }
  if (asset.fileSize && asset.fileSize > maximumPhotoBytes) {
    return { status: 'error', message: '照片超过 25 MB，请选择较小的图片' };
  }

  try {
    const path = await archiveDraftMediaFile(
      asset.uri,
      'photo',
      fallbackExtension(asset.type),
      false,
    );
    return { status: 'selected', path };
  } catch {
    return { status: 'error', message: '照片没有保存到应用，请再试一次' };
  }
}
