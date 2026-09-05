export const DUEM_MAGIC = Uint8Array.from([0x44, 0x55, 0x45, 0x4d]);
export const DUEM_VERSION = 1 as const;
export const DUEM_ALGORITHM_AES_256_GCM_HKDF_SHA256 = 1 as const;
export const DUEM_SALT_BYTES = 32;
export const DUEM_NONCE_PREFIX_BYTES = 8;
export const DUEM_TAG_BYTES = 16;
export const DUEM_DEFAULT_CHUNK_BYTES = 1024 * 1024;
export const DUEM_LENGTH_PREFIX_MAX_BYTES = 65_535;
export const DUEM_KEY_DERIVATION_DOMAIN = 'du-media-v1';
export const DUEM_KEY_VERIFIER_DOMAIN =
  'du-account-key-verifier-v1';

export type DuemMediaKind = 'photo' | 'audio' | 'ink';

export function utf8ByteLength(value: string) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

export function isLengthPrefixedText(value: string) {
  return (
    value.length > 0 &&
    utf8ByteLength(value) <= DUEM_LENGTH_PREFIX_MAX_BYTES
  );
}
