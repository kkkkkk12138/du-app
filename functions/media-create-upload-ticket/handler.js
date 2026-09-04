const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const TICKET_TTL_SECONDS = 10 * 60;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function parseEvent(event) {
  const reservationId = event?.reservationId;
  const mediaId = event?.mediaId;
  const bytes = event?.bytes;
  const sha256 = event?.sha256?.toLowerCase();
  const contentType = event?.contentType;

  if (
    !SAFE_ID.test(reservationId ?? '') ||
    !SAFE_ID.test(mediaId ?? '') ||
    !Number.isSafeInteger(bytes) ||
    bytes <= 0 ||
    bytes > MAX_MEDIA_BYTES ||
    !SHA256.test(sha256 ?? '') ||
    typeof contentType !== 'string' ||
    contentType.length === 0 ||
    contentType.length > 128
  ) {
    throw new Error('媒体上传参数无效');
  }

  return {reservationId, mediaId, bytes, sha256, contentType};
}

function assertReservation(reservation, input, accountId, now) {
  if (
    !reservation ||
    reservation.id !== input.reservationId ||
    reservation.accountId !== accountId ||
    reservation.mediaId !== input.mediaId ||
    reservation.bytes !== input.bytes ||
    reservation.sha256 !== input.sha256 ||
    !['reserved', 'ticketed'].includes(reservation.status) ||
    reservation.expiresAt <= now
  ) {
    throw new Error('媒体上传预留无效');
  }
}

function createMediaUploadTicketHandler({
  getUser,
  findReservation,
  signPutUrl,
  markTicketed,
  env,
  now = Date.now,
}) {
  return async function mediaUploadTicketHandler(event, context) {
    const user = await getUser(context);
    if (!user?.uid || user.isAnonymous) {
      throw new Error('请先注册或登录');
    }

    const input = parseEvent(event);
    const bucket = env.COS_BUCKET?.trim();
    const region = env.COS_REGION?.trim();
    if (!bucket || !region) {
      throw new Error('COS 尚未配置');
    }

    const currentTime = now();
    const reservation = await findReservation({
      accountId: user.uid,
      reservationId: input.reservationId,
    });
    assertReservation(reservation, input, user.uid, currentTime);

    const objectKey = [
      'users',
      user.uid,
      'media',
      input.sha256.slice(0, 2),
      `${input.sha256}-${input.mediaId}.enc`,
    ].join('/');
    if (
      reservation.status === 'ticketed' &&
      reservation.objectKey !== objectKey
    ) {
      throw new Error('媒体上传预留无效');
    }
    const headers = {
      'Content-Type': 'application/octet-stream',
      'x-cos-meta-sha256': input.sha256,
    };
    const uploadUrl = await signPutUrl({
      bucket,
      region,
      objectKey,
      expiresSeconds: TICKET_TTL_SECONDS,
      headers,
    });

    if (!uploadUrl.startsWith('https://')) {
      throw new Error('COS 上传地址必须使用 HTTPS');
    }
    if (
      reservation.status === 'reserved' &&
      !(await markTicketed({
        reservationId: reservation.id,
        objectKey,
        expectedStatus: 'reserved',
      }))
    ) {
      throw new Error('媒体上传预留状态已变化，请重试');
    }

    return {
      objectKey,
      uploadUrl,
      headers,
      expiresAt: currentTime + TICKET_TTL_SECONDS * 1000,
    };
  };
}

module.exports = {
  createMediaUploadTicketHandler,
};
