const RESERVATION_TTL_MS = 15 * 60 * 1000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function createCodedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseEvent(event) {
  if (!SAFE_ID.test(event?.entryCommitId ?? '')) {
    throw new Error('媒体续期参数无效');
  }
  return {entryCommitId: event.entryCommitId};
}

function createMediaRenewUploadHandler({
  getUser,
  findCommit,
  renewReservations,
  now = Date.now,
}) {
  return async function mediaRenewUploadHandler(event, context) {
    const user = await getUser(context);
    if (!user?.uid || user.isAnonymous) {
      throw new Error('请先注册或登录');
    }

    const input = parseEvent(event);
    const commit = await findCommit({
      accountId: user.uid,
      entryCommitId: input.entryCommitId,
    });
    if (!commit || commit.accountId !== user.uid) {
      throw createCodedError(
        'MEDIA_RESERVATION_NOT_FOUND',
        '媒体上传预留不存在',
      );
    }
    if (commit.status === 'released') {
      throw createCodedError(
        'MEDIA_RESERVATION_RELEASED',
        '媒体上传预留已释放',
      );
    }
    if (commit.hasExpiredMedia) {
      throw createCodedError(
        'MEDIA_RESERVATION_EXPIRED',
        '媒体上传预留已失效',
      );
    }
    if (!['reserved', 'uploading'].includes(commit.status)) {
      throw createCodedError(
        'MEDIA_RESERVATION_NOT_FOUND',
        '媒体上传预留不可续期',
      );
    }

    const currentTime = now();
    const expiresAt =
      Number.isFinite(commit.expiresAt) &&
      commit.expiresAt > currentTime
        ? commit.expiresAt
        : currentTime + RESERVATION_TTL_MS;
    const media = await renewReservations({
      accountId: user.uid,
      entryCommitId: input.entryCommitId,
      expiresAt,
    });
    if (media.length === 0) {
      throw createCodedError(
        'MEDIA_RESERVATION_NOT_FOUND',
        '媒体上传预留不存在',
      );
    }

    return {
      entryCommitId: input.entryCommitId,
      expiresAt,
      media,
    };
  };
}

module.exports = {
  createMediaRenewUploadHandler,
};
