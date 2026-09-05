#!/usr/bin/env node

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  timingSafeEqual,
} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const MAGIC = Buffer.from('DUEM', 'ascii');
const VERSION = 1;
const ALGORITHM = 1;
const HEADER_BYTES = 58;
const TAG_BYTES = 16;
const DOMAIN = 'du-media-v1';
const VERIFIER_DOMAIN = 'du-account-key-verifier-v1';

function lp(value) {
  const encoded = Buffer.from(value, 'utf8');
  if (!encoded.length || encoded.length > 65_535) {
    throw new Error('DUEM length-prefixed field is invalid');
  }
  const prefix = Buffer.alloc(2);
  prefix.writeUInt16BE(encoded.length);
  return Buffer.concat([prefix, encoded]);
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function u64(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

function buildHeader({chunkSize, plaintextBytes, salt, noncePrefix}) {
  return Buffer.concat([
    MAGIC,
    Buffer.from([VERSION, ALGORITHM]),
    u32(chunkSize),
    u64(plaintextBytes),
    salt,
    noncePrefix,
  ]);
}

function deriveFileKey({masterKey, salt, uid, mediaId, mediaKind}) {
  const info = Buffer.concat([
    lp(DOMAIN),
    lp(uid),
    lp(mediaId),
    lp(mediaKind),
  ]);
  return Buffer.from(hkdfSync('sha256', masterKey, salt, info, 32));
}

function keyVerifier({masterKey, uid}) {
  return createHash('sha256')
    .update(Buffer.concat([lp(VERIFIER_DOMAIN), lp(uid), masterKey]))
    .digest('hex');
}

function chunkNonce(noncePrefix, index) {
  return Buffer.concat([noncePrefix, u32(index)]);
}

function chunkAad({
  header,
  entryCommitId,
  mediaId,
  mediaKind,
  index,
  plaintextLength,
}) {
  return Buffer.concat([
    header,
    lp(entryCommitId),
    lp(mediaId),
    lp(mediaKind),
    u32(index),
    u32(plaintextLength),
  ]);
}

function encryptVector(vector) {
  const masterKey = Buffer.from(vector.keyBase64, 'base64');
  const plaintext = Buffer.from(vector.plaintextBase64, 'base64');
  const salt = Buffer.from(vector.saltHex, 'hex');
  const noncePrefix = Buffer.from(vector.noncePrefixHex, 'hex');
  if (masterKey.length !== 32 || salt.length !== 32) {
    throw new Error('DUEM vector key or salt length is invalid');
  }
  if (noncePrefix.length !== 8 || vector.chunkSize <= 0) {
    throw new Error('DUEM vector nonce or chunk size is invalid');
  }

  const header = buildHeader({
    chunkSize: vector.chunkSize,
    plaintextBytes: plaintext.length,
    salt,
    noncePrefix,
  });
  const fileKey = deriveFileKey({
    masterKey,
    salt,
    uid: vector.uid,
    mediaId: vector.mediaId,
    mediaKind: vector.mediaKind,
  });
  const records = [];

  for (
    let offset = 0, index = 0;
    offset < plaintext.length;
    offset += vector.chunkSize, index += 1
  ) {
    const chunk = plaintext.subarray(
      offset,
      Math.min(offset + vector.chunkSize, plaintext.length),
    );
    const cipher = createCipheriv(
      'aes-256-gcm',
      fileKey,
      chunkNonce(noncePrefix, index),
    );
    cipher.setAAD(
      chunkAad({
        header,
        entryCommitId: vector.entryCommitId,
        mediaId: vector.mediaId,
        mediaKind: vector.mediaKind,
        index,
        plaintextLength: chunk.length,
      }),
    );
    const ciphertext = Buffer.concat([cipher.update(chunk), cipher.final()]);
    records.push(u32(chunk.length), ciphertext, cipher.getAuthTag());
  }

  return Buffer.concat([header, ...records]);
}

function decryptVector(vector, encrypted) {
  if (encrypted.length < HEADER_BYTES) {
    throw new Error('DUEM file is truncated');
  }
  if (!timingSafeEqual(encrypted.subarray(0, 4), MAGIC)) {
    throw new Error('DUEM magic is invalid');
  }
  if (encrypted[4] !== VERSION || encrypted[5] !== ALGORITHM) {
    throw new Error('DUEM version or algorithm is unsupported');
  }

  const chunkSize = encrypted.readUInt32BE(6);
  const plaintextBytes = Number(encrypted.readBigUInt64BE(10));
  const salt = encrypted.subarray(18, 50);
  const noncePrefix = encrypted.subarray(50, 58);
  const header = encrypted.subarray(0, HEADER_BYTES);
  const fileKey = deriveFileKey({
    masterKey: Buffer.from(vector.keyBase64, 'base64'),
    salt,
    uid: vector.uid,
    mediaId: vector.mediaId,
    mediaKind: vector.mediaKind,
  });
  const plaintextChunks = [];

  let cursor = HEADER_BYTES;
  let index = 0;
  while (cursor < encrypted.length) {
    if (cursor + 4 > encrypted.length) {
      throw new Error('DUEM chunk length is truncated');
    }
    const plaintextLength = encrypted.readUInt32BE(cursor);
    cursor += 4;
    const recordEnd = cursor + plaintextLength + TAG_BYTES;
    if (
      plaintextLength <= 0 ||
      plaintextLength > chunkSize ||
      recordEnd > encrypted.length
    ) {
      throw new Error('DUEM chunk record is invalid');
    }
    const ciphertext = encrypted.subarray(
      cursor,
      cursor + plaintextLength,
    );
    const tag = encrypted.subarray(cursor + plaintextLength, recordEnd);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      fileKey,
      chunkNonce(noncePrefix, index),
    );
    decipher.setAAD(
      chunkAad({
        header,
        entryCommitId: vector.entryCommitId,
        mediaId: vector.mediaId,
        mediaKind: vector.mediaKind,
        index,
        plaintextLength,
      }),
    );
    decipher.setAuthTag(tag);
    plaintextChunks.push(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]),
    );
    cursor = recordEnd;
    index += 1;
  }

  const plaintext = Buffer.concat(plaintextChunks);
  if (plaintext.length !== plaintextBytes) {
    throw new Error('DUEM plaintext length does not match the header');
  }
  return plaintext;
}

function fixedVector() {
  return {
    version: 1,
    keyBase64: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
    uid: 'test-user',
    entryCommitId: 'test-commit',
    mediaId: 'test-media',
    mediaKind: 'photo',
    chunkSize: 16,
    plaintextBase64: Buffer.from(
      'DUEM v1 fixed vector crosses several authenticated chunks.',
      'utf8',
    ).toString('base64'),
    saltHex:
      '000102030405060708090a0b0c0d0e0f' +
      '101112131415161718191a1b1c1d1e1f',
    noncePrefixHex: 'a0a1a2a3a4a5a6a7',
  };
}

function writeVector(path) {
  const vector = fixedVector();
  const encrypted = encryptVector(vector);
  const complete = {
    ...vector,
    encryptedBase64: encrypted.toString('base64'),
    sha256: createHash('sha256').update(encrypted).digest('hex'),
    keyVerifier: keyVerifier({
      masterKey: Buffer.from(vector.keyBase64, 'base64'),
      uid: vector.uid,
    }),
  };
  writeFileSync(path, `${JSON.stringify(complete, null, 2)}\n`);
  console.log(`DUEM v1 vector written: ${path}`);
}

function verifyVector(path) {
  const vector = JSON.parse(readFileSync(path, 'utf8'));
  const encrypted = Buffer.from(vector.encryptedBase64, 'base64');
  const regenerated = encryptVector(vector);
  if (
    encrypted.length !== regenerated.length ||
    !timingSafeEqual(encrypted, regenerated)
  ) {
    throw new Error('DUEM encrypted bytes do not match the fixed vector');
  }
  const hash = createHash('sha256').update(encrypted).digest('hex');
  if (hash !== vector.sha256) {
    throw new Error('DUEM encrypted SHA-256 does not match');
  }
  const verifier = keyVerifier({
    masterKey: Buffer.from(vector.keyBase64, 'base64'),
    uid: vector.uid,
  });
  if (verifier !== vector.keyVerifier) {
    throw new Error('DUEM account key verifier does not match');
  }
  const plaintext = decryptVector(vector, encrypted);
  if (
    plaintext.toString('base64') !== vector.plaintextBase64
  ) {
    throw new Error('DUEM decrypted plaintext does not match');
  }
  console.log('DUEM v1 verified');
}

const [operation, path] = process.argv.slice(2);
if (!path || !['--write-vector', '--vector'].includes(operation)) {
  throw new Error(
    'Usage: verify-duem-v1.mjs --write-vector <path> | --vector <path>',
  );
}

if (operation === '--write-vector') {
  writeVector(path);
} else {
  verifyVector(path);
}
