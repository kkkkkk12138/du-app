import {NativeModules} from 'react-native';
import RNFS from 'react-native-fs';

import {
  DUEM_ALGORITHM_AES_256_GCM_HKDF_SHA256,
  DUEM_DEFAULT_CHUNK_BYTES,
  DUEM_MAGIC,
  DUEM_NONCE_PREFIX_BYTES,
  DUEM_SALT_BYTES,
  DUEM_TAG_BYTES,
  DUEM_VERSION,
} from '../src/features/billing/duemFormat';
import {
  deleteEncryptedFile,
  encryptMediaFile,
  generateRandomKey,
  inspectEncryptedFile,
  keyVerifier,
} from '../src/services/mediaCrypto';

const validKey = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const validHash = 'a'.repeat(64);
const sourcePath = '/private/doc/du-attachments/photo.jpg';
const destinationPath = '/private/cache/du-upload-outbox/job/media.enc';

type NativeCryptoMock = {
  generateRandomKey: jest.Mock;
  keyVerifier: jest.Mock;
  encryptMediaFile: jest.Mock;
  inspectEncryptedFile: jest.Mock;
  deleteEncryptedFile: jest.Mock;
};

function nativeCryptoMock(
  overrides: Partial<NativeCryptoMock> = {},
): NativeCryptoMock {
  return {
    generateRandomKey: jest.fn().mockResolvedValue(validKey),
    keyVerifier: jest.fn().mockResolvedValue(validHash),
    encryptMediaFile: jest.fn().mockResolvedValue({
      encryptedPath: destinationPath,
      encryptedBytes: 2048,
      plaintextBytes: 1024,
      sha256: validHash,
      formatVersion: 1,
    }),
    inspectEncryptedFile: jest.fn().mockResolvedValue({
      encryptedPath: destinationPath,
      encryptedBytes: 2048,
      plaintextBytes: 1024,
      sha256: validHash,
      formatVersion: 1,
    }),
    deleteEncryptedFile: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setNativeCrypto(module: NativeCryptoMock | undefined) {
  (NativeModules as Record<string, unknown>).DuMediaCrypto = module;
}

describe('DUEM format constants', () => {
  test('locks the v1 binary format parameters', () => {
    expect(Array.from(DUEM_MAGIC)).toEqual([0x44, 0x55, 0x45, 0x4d]);
    expect(DUEM_VERSION).toBe(1);
    expect(DUEM_ALGORITHM_AES_256_GCM_HKDF_SHA256).toBe(1);
    expect(DUEM_SALT_BYTES).toBe(32);
    expect(DUEM_NONCE_PREFIX_BYTES).toBe(8);
    expect(DUEM_TAG_BYTES).toBe(16);
    expect(DUEM_DEFAULT_CHUNK_BYTES).toBe(1024 * 1024);
  });
});

describe('media crypto native bridge', () => {
  beforeEach(() => {
    (RNFS as unknown as Record<string, unknown>).DocumentDirectoryPath =
      '/private/doc';
    (RNFS as unknown as Record<string, unknown>).CachesDirectoryPath =
      '/private/cache';
    (RNFS as unknown as Record<string, unknown>).TemporaryDirectoryPath =
      '/private/tmp';
    setNativeCrypto(nativeCryptoMock());
  });

  afterEach(() => {
    setNativeCrypto(undefined);
  });

  test('rejects a missing native crypto module', async () => {
    setNativeCrypto(undefined);

    await expect(generateRandomKey()).rejects.toThrow(
      '媒体加密模块不可用',
    );
  });

  test('generates only a 32-byte account key', async () => {
    await expect(generateRandomKey()).resolves.toBe(validKey);

    setNativeCrypto(
      nativeCryptoMock({
        generateRandomKey: jest.fn().mockResolvedValue('c2hvcnQ='),
      }),
    );
    await expect(generateRandomKey()).rejects.toThrow(
      '账号主密钥格式无效',
    );
  });

  test('validates key and UID before requesting a verifier', async () => {
    const native = nativeCryptoMock();
    setNativeCrypto(native);

    await expect(keyVerifier('user_01', validKey)).resolves.toBe(
      validHash,
    );
    expect(native.keyVerifier).toHaveBeenCalledWith('user_01', validKey);

    await expect(keyVerifier('', validKey)).rejects.toThrow(
      '账号标识无效',
    );
    await expect(
      keyVerifier('user_01', 'c2hvcnQ='),
    ).rejects.toThrow('账号主密钥格式无效');
  });

  test('rejects an invalid verifier returned by native code', async () => {
    setNativeCrypto(
      nativeCryptoMock({
        keyVerifier: jest.fn().mockResolvedValue('INVALID'),
      }),
    );

    await expect(keyVerifier('user_01', validKey)).rejects.toThrow(
      '账号密钥校验值无效',
    );
  });

  test('normalizes private file URLs before encryption', async () => {
    const native = nativeCryptoMock();
    setNativeCrypto(native);

    await expect(
      encryptMediaFile({
        sourcePath: `file://${sourcePath}`,
        destinationPath: `file://${destinationPath}`,
        masterKeyBase64: validKey,
        uid: 'user_01',
        entryCommitId: 'commit_01',
        mediaId: 'media_01',
        mediaKind: 'photo',
        chunkSize: DUEM_DEFAULT_CHUNK_BYTES,
      }),
    ).resolves.toEqual({
      encryptedPath: destinationPath,
      encryptedBytes: 2048,
      plaintextBytes: 1024,
      sha256: validHash,
      formatVersion: 1,
    });
    expect(native.encryptMediaFile).toHaveBeenCalledWith({
      sourcePath,
      destinationPath,
      masterKeyBase64: validKey,
      uid: 'user_01',
      entryCommitId: 'commit_01',
      mediaId: 'media_01',
      mediaKind: 'photo',
      chunkSize: DUEM_DEFAULT_CHUNK_BYTES,
    });
  });

  test.each([
    ['/outside/source.jpg', destinationPath],
    [sourcePath, '/outside/media.enc'],
    ['/private/documents/source.jpg', destinationPath],
  ])(
    'rejects non-private paths',
    async (invalidSource, invalidDestination) => {
      await expect(
        encryptMediaFile({
          sourcePath: invalidSource,
          destinationPath: invalidDestination,
          masterKeyBase64: validKey,
          uid: 'user_01',
          entryCommitId: 'commit_01',
          mediaId: 'media_01',
          mediaKind: 'photo',
          chunkSize: DUEM_DEFAULT_CHUNK_BYTES,
        }),
      ).rejects.toThrow('媒体文件路径不安全');
    },
  );

  test('rejects invalid encryption metadata before native execution', async () => {
    const native = nativeCryptoMock();
    setNativeCrypto(native);

    await expect(
      encryptMediaFile({
        sourcePath,
        destinationPath,
        masterKeyBase64: validKey,
        uid: 'user_01',
        entryCommitId: '',
        mediaId: 'media_01',
        mediaKind: 'photo',
        chunkSize: 0,
      }),
    ).rejects.toThrow('媒体加密参数无效');
    expect(native.encryptMediaFile).not.toHaveBeenCalled();
  });

  test('rejects metadata beyond the unsigned 16-bit UTF-8 limit', async () => {
    await expect(
      encryptMediaFile({
        sourcePath,
        destinationPath,
        masterKeyBase64: validKey,
        uid: '界'.repeat(21_846),
        entryCommitId: 'commit_01',
        mediaId: 'media_01',
        mediaKind: 'photo',
        chunkSize: DUEM_DEFAULT_CHUNK_BYTES,
      }),
    ).rejects.toThrow('媒体加密参数过长');
  });

  test.each([
    [{encryptedBytes: 0}, '媒体密文字节数无效'],
    [{plaintextBytes: 0}, '媒体明文字节数无效'],
    [{sha256: 'INVALID'}, '媒体密文校验值无效'],
    [{formatVersion: 2}, '媒体密文格式版本无效'],
    [{encryptedPath: '/outside/media.enc'}, '媒体文件路径不安全'],
  ])('rejects an invalid native result %p', async (patch, message) => {
    setNativeCrypto(
      nativeCryptoMock({
        encryptMediaFile: jest.fn().mockResolvedValue({
          encryptedPath: destinationPath,
          encryptedBytes: 2048,
          plaintextBytes: 1024,
          sha256: validHash,
          formatVersion: 1,
          ...patch,
        }),
      }),
    );

    await expect(
      encryptMediaFile({
        sourcePath,
        destinationPath,
        masterKeyBase64: validKey,
        uid: 'user_01',
        entryCommitId: 'commit_01',
        mediaId: 'media_01',
        mediaKind: 'photo',
        chunkSize: DUEM_DEFAULT_CHUNK_BYTES,
      }),
    ).rejects.toThrow(message);
  });

  test('inspects and deletes only private encrypted files', async () => {
    const native = nativeCryptoMock();
    setNativeCrypto(native);

    await expect(
      inspectEncryptedFile(`file://${destinationPath}`),
    ).resolves.toMatchObject({
      encryptedPath: destinationPath,
      formatVersion: 1,
    });
    await expect(
      deleteEncryptedFile(`file://${destinationPath}`),
    ).resolves.toBeUndefined();
    expect(native.inspectEncryptedFile).toHaveBeenCalledWith(
      destinationPath,
    );
    expect(native.deleteEncryptedFile).toHaveBeenCalledWith(
      destinationPath,
    );

    await expect(
      inspectEncryptedFile('/outside/media.enc'),
    ).rejects.toThrow('媒体文件路径不安全');
    await expect(
      deleteEncryptedFile('/outside/media.enc'),
    ).rejects.toThrow('媒体文件路径不安全');
  });
});
