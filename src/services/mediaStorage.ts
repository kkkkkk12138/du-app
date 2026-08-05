import RNFS from 'react-native-fs';

const attachmentDirectory = `${RNFS.DocumentDirectoryPath}/du-attachments`;
const draftDirectory = `${RNFS.DocumentDirectoryPath}/du-drafts`;

async function ensureAttachmentDirectory() {
  await RNFS.mkdir(attachmentDirectory, {
    NSURLIsExcludedFromBackupKey: false,
  });
}

async function ensureDraftDirectory() {
  await RNFS.mkdir(draftDirectory, {
    NSURLIsExcludedFromBackupKey: true,
  });
}

function extensionFromPath(path: string, fallback: string) {
  const cleanPath = path.split('?')[0];
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1] ?? fallback;
}

function mediaPath(
  directory: string,
  prefix: 'photo' | 'audio' | 'ink',
  extension: string,
) {
  return `${directory}/${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;
}

function normalizePath(path: string) {
  return path.replace(/^file:\/\//, '');
}

function isDraftPath(path: string) {
  return normalizePath(path).startsWith(`${draftDirectory}/`);
}

export async function isUsableAudioFile(path: string) {
  const normalizedPath = normalizePath(path);
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
  const normalizedSource = normalizePath(sourcePath);
  const extension = extensionFromPath(normalizedSource, fallbackExtension);
  const destination = mediaPath(attachmentDirectory, prefix, extension);

  if (normalizedSource !== destination) {
    await RNFS.copyFile(normalizedSource, destination);
    await removeMediaFile(normalizedSource);
  }
  return destination;
}

export async function archiveDraftMediaFile(
  sourcePath: string,
  prefix: 'photo' | 'audio' | 'ink',
  fallbackExtension: string,
  removeSource = true,
) {
  await ensureDraftDirectory();
  const normalizedSource = normalizePath(sourcePath);
  const extension = extensionFromPath(normalizedSource, fallbackExtension);
  const destination = mediaPath(draftDirectory, prefix, extension);

  await RNFS.copyFile(normalizedSource, destination);
  if (removeSource) {
    await removeMediaFile(normalizedSource);
  }
  return destination;
}

export type PreparedMediaFile = {
  path?: string;
  draftPath?: string;
  createdPath?: string;
};

export async function prepareMediaForPersistence(
  path: string | undefined,
  prefix: 'photo' | 'audio' | 'ink',
  fallbackExtension: string,
): Promise<PreparedMediaFile> {
  if (!path || !isDraftPath(path)) {
    return { path };
  }

  await ensureAttachmentDirectory();
  const normalizedSource = normalizePath(path);
  const extension = extensionFromPath(normalizedSource, fallbackExtension);
  const destination = mediaPath(attachmentDirectory, prefix, extension);
  await RNFS.copyFile(normalizedSource, destination);
  return {
    path: destination,
    draftPath: normalizedSource,
    createdPath: destination,
  };
}

export async function finalizePreparedMedia(files: PreparedMediaFile[]) {
  await Promise.allSettled(files.map(file => removeMediaFile(file.draftPath)));
}

export async function rollbackPreparedMedia(files: PreparedMediaFile[]) {
  await Promise.allSettled(
    files.map(file => removeMediaFile(file.createdPath)),
  );
}

export async function writeRestoredMediaFile({
  dataBase64,
  filename,
  sha256,
}: {
  dataBase64: string;
  filename: string;
  sha256: string;
}) {
  await ensureAttachmentDirectory();
  const extension = extensionFromPath(filename, 'bin');
  const destination = mediaPath(
    attachmentDirectory,
    filename.includes('audio')
      ? 'audio'
      : filename.includes('handwriting') || filename.includes('ink')
      ? 'ink'
      : 'photo',
    extension,
  );
  await RNFS.writeFile(destination, dataBase64, 'base64');
  const actualHash = await RNFS.hash(destination, 'sha256');
  if (actualHash.toLowerCase() !== sha256.toLowerCase()) {
    await removeMediaFile(destination);
    throw new Error('备份附件校验失败，文件可能已损坏');
  }
  return destination;
}

export async function clearAbandonedDraftMedia(referencedPaths: string[] = []) {
  await ensureDraftDirectory();
  const referenced = new Set(referencedPaths.map(normalizePath));
  const entries = await RNFS.readDir(draftDirectory);
  await Promise.allSettled(
    entries
      .filter(entry => entry.isFile() && !referenced.has(entry.path))
      .map(entry => RNFS.unlink(entry.path)),
  );
}

export function isDraftMediaPath(path?: string) {
  if (!path) {
    return false;
  }
  return isDraftPath(path);
}

export async function removeMediaFile(path?: string) {
  if (!path) {
    return;
  }
  const normalizedPath = normalizePath(path);
  if (await RNFS.exists(normalizedPath)) {
    await RNFS.unlink(normalizedPath);
  }
}
