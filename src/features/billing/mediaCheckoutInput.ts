import RNFS from 'react-native-fs';

import type {CheckoutMediaItem} from './mediaCheckout';

export type EntryMediaPaths = {
  imagePath?: string;
  audioPath?: string;
  audioDuration?: number;
  inkImagePath?: string;
};

function normalizeFilePath(path: string) {
  return path.replace(/^file:\/\//, '');
}

async function readMediaBytes(path: string) {
  let size: unknown;
  try {
    const file = await RNFS.stat(normalizeFilePath(path));
    size = file.size;
  } catch {
    throw new Error('无法读取媒体文件大小');
  }

  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error('媒体文件大小无效');
  }
  return Math.floor(bytes);
}

export async function collectCheckoutMediaItems({
  imagePath,
  audioPath,
  audioDuration,
  inkImagePath,
}: EntryMediaPaths): Promise<CheckoutMediaItem[]> {
  const items: Array<Promise<CheckoutMediaItem>> = [];

  if (imagePath) {
    items.push(
      readMediaBytes(imagePath).then(bytes => ({
        id: 'photo',
        kind: 'photo',
        bytes,
      })),
    );
  }
  if (audioPath) {
    items.push(
      readMediaBytes(audioPath).then(bytes => ({
        id: 'audio',
        kind: 'audio',
        bytes,
        durationSeconds: audioDuration,
      })),
    );
  }
  if (inkImagePath) {
    items.push(
      readMediaBytes(inkImagePath).then(bytes => ({
        id: 'ink',
        kind: 'ink',
        bytes,
      })),
    );
  }

  return Promise.all(items);
}
