const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const MAX_MEDIA_ITEMS = 20;
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,160}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ENTRY_TYPES = new Set(['memory', 'future_letter']);
const MEDIA_KINDS = new Set(['photo', 'audio', 'ink', 'avatar', 'cover']);

function createCodedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseMedia(value) {
  if (
    !value ||
    !SAFE_ID.test(value.mediaId ?? '') ||
    !MEDIA_KINDS.has(value.mediaKind) ||
    !Number.isSafeInteger(value.encryptedBytes) ||
    value.encryptedBytes <= 0 ||
    value.encryptedBytes > MAX_MEDIA_BYTES
  ) {
    throw new Error('媒体预留参数无效');
  }

  const sha256 =
    typeof value.sha256 === 'string' ? value.sha256.toLowerCase() : '';
  if (!SHA256.test(sha256)) {
    throw new Error('媒体预留参数无效');
  }

  return {
    mediaId: value.mediaId,
    mediaKind: value.mediaKind,
    encryptedBytes: value.encryptedBytes,
    sha256,
  };
}

function parseEvent(event) {
  if (
    !SAFE_ID.test(event?.entryCommitId ?? '') ||
    !ENTRY_TYPES.has(event?.entryType) ||
    !SAFE_ID.test(event?.localEntryId ?? '') ||
    !SAFE_IDEMPOTENCY_KEY.test(event?.idempotencyKey ?? '') ||
    !Array.isArray(event?.media) ||
    event.media.length === 0 ||
    event.media.length > MAX_MEDIA_ITEMS
  ) {
    throw new Error('媒体预留参数无效');
  }

  const media = event.media.map(parseMedia);
  if (new Set(media.map(item => item.mediaId)).size !== media.length) {
    throw new Error('媒体预留参数无效');
  }

  const reservedFreeBytes = media.reduce(
    (total, item) => total + item.encryptedBytes,
    0,
  );
  if (!Number.isSafeInteger(reservedFreeBytes)) {
    throw new Error('媒体预留参数无效');
  }

  return {
    entryCommitId: event.entryCommitId,
    entryType: event.entryType,
    localEntryId: event.localEntryId,
    idempotencyKey: event.idempotencyKey,
    media,
    reservedFreeBytes,
  };
}

function assertCapacity(creditAccount, requestedBytes) {
  const remainingBytes =
    creditAccount.freeMediaLimitBytes -
    creditAccount.freeMediaUsedBytes -
    creditAccount.reservedFreeBytes;
  if (remainingBytes < requestedBytes) {
    throw createCodedError(
      'MEDIA_SPACE_EXHAUSTED',
      '免费媒体空间已用完，仍可保存纯文字内容',
    );
  }
}

function createMediaReservationHandler({
  getUser,
  findCommitByIdempotencyKey,
  ensureCreditAccount,
  createAllocatingCommit,
  compareAndSwapReservedBytes,
  createReservations,
  markCommitReserved,
  markCommitFailed,
  releaseReservedBytes,
  now = Date.now,
}) {
  return async function mediaReservationHandler(event, context) {
    const user = await getUser(context);
    if (!user?.uid || user.isAnonymous) {
      throw new Error('请先注册或登录');
    }

    const input = parseEvent(event);
    const existing = await findCommitByIdempotencyKey({
      accountId: user.uid,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) {
      return existing;
    }

    let creditAccount = await ensureCreditAccount({
      accountId: user.uid,
    });
    assertCapacity(creditAccount, input.reservedFreeBytes);

    const expiresAt = now() + RESERVATION_TTL_MS;
    await createAllocatingCommit({
      accountId: user.uid,
      entryCommitId: input.entryCommitId,
      entryType: input.entryType,
      localEntryId: input.localEntryId,
      idempotencyKey: input.idempotencyKey,
      reservedFreeBytes: input.reservedFreeBytes,
      expiresAt,
    });

    let quotaReserved = false;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        assertCapacity(creditAccount, input.reservedFreeBytes);
        quotaReserved = await compareAndSwapReservedBytes({
          accountId: user.uid,
          entryCommitId: input.entryCommitId,
          expectedReservedBytes: creditAccount.reservedFreeBytes,
          nextReservedBytes:
            creditAccount.reservedFreeBytes + input.reservedFreeBytes,
        });
        if (quotaReserved) {
          break;
        }
        if (attempt < 2) {
          creditAccount = await ensureCreditAccount({
            accountId: user.uid,
          });
        }
      }

      if (!quotaReserved) {
        throw createCodedError(
          'MEDIA_RESERVATION_CONFLICT',
          '媒体空间正在被其他保存操作占用，请重试',
        );
      }

      const reservations = await createReservations({
        accountId: user.uid,
        entryCommitId: input.entryCommitId,
        expiresAt,
        media: input.media,
      });
      await markCommitReserved({
        accountId: user.uid,
        entryCommitId: input.entryCommitId,
      });

      return {
        entryCommitId: input.entryCommitId,
        status: 'reserved',
        reservedFreeBytes: input.reservedFreeBytes,
        expiresAt,
        media: reservations,
      };
    } catch (error) {
      if (quotaReserved) {
        await releaseReservedBytes({
          accountId: user.uid,
          reservedBytes: input.reservedFreeBytes,
        });
      }
      await markCommitFailed({
        accountId: user.uid,
        entryCommitId: input.entryCommitId,
      });
      throw error;
    }
  };
}

module.exports = {
  createMediaReservationHandler,
};
