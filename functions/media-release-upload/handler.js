const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const RELEASE_REASONS = new Set(['cancelled', 'expired']);

function parseEvent(event) {
  if (
    !SAFE_ID.test(event?.entryCommitId ?? '') ||
    !RELEASE_REASONS.has(event?.reason)
  ) {
    throw new Error('媒体释放参数无效');
  }
  return {
    entryCommitId: event.entryCommitId,
    reason: event.reason,
  };
}

function createMediaReleaseUploadHandler({
  getUser,
  findCommit,
  releaseReservation,
  now = Date.now,
}) {
  return async function mediaReleaseUploadHandler(event, context) {
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
      throw new Error('媒体上传预留不可释放');
    }
    if (commit.status === 'released') {
      return {
        entryCommitId: commit.id,
        status: 'released',
        releasedFreeBytes: 0,
      };
    }
    if (!['allocating', 'reserved'].includes(commit.status)) {
      throw new Error('媒体上传预留不可释放');
    }
    if (commit.hasVerifiedMedia) {
      throw new Error('已确认的媒体不能释放');
    }

    const requireExpired = input.reason === 'expired';
    if (requireExpired && commit.expiresAt > now()) {
      throw new Error('媒体上传预留尚未过期');
    }

    return releaseReservation({
      accountId: user.uid,
      entryCommitId: input.entryCommitId,
      requireExpired,
    });
  };
}

module.exports = {
  createMediaReleaseUploadHandler,
};
