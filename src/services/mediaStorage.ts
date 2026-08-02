import RNFS from 'react-native-fs';

const attachmentDirectory = `${RNFS.DocumentDirectoryPath}/du-attachments`;

async function ensureAttachmentDirectory() {
  await RNFS.mkdir(attachmentDirectory, {
    NSURLIsExcludedFromBackupKey: false,
  });
}

function extensionFromPath(path: string, fallback: string) {
  const cleanPath = path.split('?')[0];
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1] ?? fallback;
}

export async function isUsableAudioFile(path: string) {
  const normalizedPath = path.replace(/^file:\/\//, '');
  try {
    if (!(await RNFS.exists(normalizedPath))) {
      return false;
    }
    const file = await RNFS.stat(normalizedPath);
    return file.size > 4096;
  } catch {
    return false;
  }
}

export async function archiveMediaFile(
  sourcePath: string,
  prefix: 'photo' | 'audio' | 'ink',
  fallbackExtension: string,
) {
  await ensureAttachmentDirectory();
  const normalizedSource = sourcePath.replace(/^file:\/\//, '');
  const extension = extensionFromPath(normalizedSource, fallbackExtension);
  const destination = `${attachmentDirectory}/${prefix}-${Date.now()}.${extension}`;

  if (normalizedSource !== destination) {
    await RNFS.copyFile(normalizedSource, destination);
    await removeMediaFile(normalizedSource);
  }
  return destination;
}

export async function removeMediaFile(path?: string) {
  if (!path) {
    return;
  }
  const normalizedPath = path.replace(/^file:\/\//, '');
  if (await RNFS.exists(normalizedPath)) {
    await RNFS.unlink(normalizedPath);
  }
}
