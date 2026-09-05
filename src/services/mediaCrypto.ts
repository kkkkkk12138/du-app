import {NativeModules} from 'react-native';
import RNFS from 'react-native-fs';

import {
  DuemMediaKind,
  DUEM_VERSION,
  isLengthPrefixedText,
} from '../features/billing/duemFormat';

export type EncryptMediaInput = {
  sourcePath: string;
  destinationPath: string;
  masterKeyBase64: string;
  uid: string;
  entryCommitId: string;
  mediaId: string;
  mediaKind: DuemMediaKind;
  chunkSize: number;
};

export type EncryptedMediaResult = {
  encryptedPath: string;
  encryptedBytes: number;
  plaintextBytes: number;
  sha256: string;
  formatVersion: typeof DUEM_VERSION;
};

type NativeEncryptedMediaResult = {
  encryptedPath?: unknown;
  encryptedBytes?: unknown;
  plaintextBytes?: unknown;
  sha256?: unknown;
  formatVersion?: unknown;
};

type NativeMediaCrypto = {
  generateRandomKey(): Promise<unknown>;
  keyVerifier(uid: string, masterKeyBase64: string): Promise<unknown>;
  encryptMediaFile(
    input: EncryptMediaInput,
  ): Promise<NativeEncryptedMediaResult>;
  inspectEncryptedFile(path: string): Promise<NativeEncryptedMediaResult>;
  deleteEncryptedFile(path: string): Promise<void>;
};

const SHA256 = /^[a-f0-9]{64}$/;
const BASE64_32_BYTES = /^[A-Za-z0-9+/]{43}=$/;
const MEDIA_KINDS = new Set<DuemMediaKind>([
  'photo',
  'audio',
  'ink',
]);

function nativeCrypto() {
  const module = NativeModules.DuMediaCrypto as
    | Partial<NativeMediaCrypto>
    | undefined;
  if (
    !module?.generateRandomKey ||
    !module.keyVerifier ||
    !module.encryptMediaFile ||
    !module.inspectEncryptedFile ||
    !module.deleteEncryptedFile
  ) {
    throw new Error('媒体加密模块不可用');
  }
  return module as NativeMediaCrypto;
}

function canonicalPath(path: string) {
  const withoutScheme = path.replace(/^file:\/\//, '');
  const segments: string[] = [];
  for (const segment of withoutScheme.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

function privateRoots() {
  return [
    RNFS.DocumentDirectoryPath,
    RNFS.CachesDirectoryPath,
    RNFS.TemporaryDirectoryPath,
  ]
    .filter((path): path is string => Boolean(path))
    .map(canonicalPath);
}

function requirePrivatePath(path: string) {
  if (!path) {
    throw new Error('媒体文件路径不安全');
  }
  const normalized = canonicalPath(path);
  const isPrivate = privateRoots().some(
    root => normalized === root || normalized.startsWith(`${root}/`),
  );
  if (!isPrivate) {
    throw new Error('媒体文件路径不安全');
  }
  return normalized;
}

function requireAccountKey(value: string) {
  if (!BASE64_32_BYTES.test(value)) {
    throw new Error('账号主密钥格式无效');
  }
  return value;
}

function requireMetadataText(value: string) {
  if (!value) {
    throw new Error('媒体加密参数无效');
  }
  if (!isLengthPrefixedText(value)) {
    throw new Error('媒体加密参数过长');
  }
  return value;
}

function validateResult(
  raw: NativeEncryptedMediaResult,
): EncryptedMediaResult {
  const encryptedPath =
    typeof raw.encryptedPath === 'string'
      ? requirePrivatePath(raw.encryptedPath)
      : undefined;
  if (!encryptedPath) {
    throw new Error('媒体文件路径不安全');
  }
  if (
    typeof raw.encryptedBytes !== 'number' ||
    !Number.isSafeInteger(raw.encryptedBytes) ||
    raw.encryptedBytes <= 0
  ) {
    throw new Error('媒体密文字节数无效');
  }
  if (
    typeof raw.plaintextBytes !== 'number' ||
    !Number.isSafeInteger(raw.plaintextBytes) ||
    raw.plaintextBytes <= 0
  ) {
    throw new Error('媒体明文字节数无效');
  }
  if (typeof raw.sha256 !== 'string' || !SHA256.test(raw.sha256)) {
    throw new Error('媒体密文校验值无效');
  }
  if (raw.formatVersion !== DUEM_VERSION) {
    throw new Error('媒体密文格式版本无效');
  }
  return {
    encryptedPath,
    encryptedBytes: raw.encryptedBytes,
    plaintextBytes: raw.plaintextBytes,
    sha256: raw.sha256,
    formatVersion: DUEM_VERSION,
  };
}

export async function generateRandomKey() {
  const key = await nativeCrypto().generateRandomKey();
  if (typeof key !== 'string') {
    throw new Error('账号主密钥格式无效');
  }
  return requireAccountKey(key);
}

export async function keyVerifier(
  uid: string,
  masterKeyBase64: string,
) {
  if (!uid) {
    throw new Error('账号标识无效');
  }
  const normalizedUid = requireMetadataText(uid);
  const verifier = await nativeCrypto().keyVerifier(
    normalizedUid,
    requireAccountKey(masterKeyBase64),
  );
  if (typeof verifier !== 'string' || !SHA256.test(verifier)) {
    throw new Error('账号密钥校验值无效');
  }
  return verifier;
}

export async function encryptMediaFile(input: EncryptMediaInput) {
  const sourcePath = requirePrivatePath(input.sourcePath);
  const destinationPath = requirePrivatePath(input.destinationPath);
  const masterKeyBase64 = requireAccountKey(input.masterKeyBase64);
  const uid = requireMetadataText(input.uid);
  const entryCommitId = requireMetadataText(input.entryCommitId);
  const mediaId = requireMetadataText(input.mediaId);
  if (
    !MEDIA_KINDS.has(input.mediaKind) ||
    !Number.isSafeInteger(input.chunkSize) ||
    input.chunkSize <= 0
  ) {
    throw new Error('媒体加密参数无效');
  }

  return validateResult(
    await nativeCrypto().encryptMediaFile({
      sourcePath,
      destinationPath,
      masterKeyBase64,
      uid,
      entryCommitId,
      mediaId,
      mediaKind: input.mediaKind,
      chunkSize: input.chunkSize,
    }),
  );
}

export async function inspectEncryptedFile(path: string) {
  const normalizedPath = requirePrivatePath(path);
  return validateResult(
    await nativeCrypto().inspectEncryptedFile(normalizedPath),
  );
}

export async function deleteEncryptedFile(path: string) {
  const normalizedPath = requirePrivatePath(path);
  await nativeCrypto().deleteEncryptedFile(normalizedPath);
}
