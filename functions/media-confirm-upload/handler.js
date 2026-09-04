const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function parseEvent(event) {
  if (!SAFE_ID.test(event?.reservationId ?? '')) {
    throw new Error('媒体确认参数无效');
  }
  return {reservationId: event.reservationId};
}

function createMediaConfirmUploadHandler({
  getUser,
  findReservation,
  findConfirmedUpload,
  headObject,
  commitConfirmedUpload,
  env,
  now = Date.now,
}) {
  return async function mediaConfirmUploadHandler(event, context) {
    const user = await getUser(context);
    if (!user?.uid || user.isAnonymous) {
      throw new Error('请先注册或登录');
    }

    const input = parseEvent(event);
    const reservation = await findReservation({
      accountId: user.uid,
      reservationId: input.reservationId,
    });
    if (!reservation || reservation.accountId !== user.uid) {
      throw new Error('媒体上传预留不可确认');
    }
    if (reservation.status === 'verified') {
      return findConfirmedUpload({
        accountId: user.uid,
        reservation,
      });
    }
    if (
      reservation.status !== 'ticketed' ||
      !reservation.objectKey ||
      reservation.expiresAt <= now()
    ) {
      throw new Error('媒体上传预留不可确认');
    }

    const bucket = env.COS_BUCKET?.trim();
    const region = env.COS_REGION?.trim();
    if (!bucket || !region) {
      throw new Error('COS 尚未配置');
    }
    const object = await headObject({
      bucket,
      region,
      objectKey: reservation.objectKey,
    });
    if (
      object.bytes !== reservation.bytes ||
      object.sha256 !== reservation.sha256
    ) {
      throw new Error('COS 媒体对象校验失败');
    }

    return commitConfirmedUpload({
      accountId: user.uid,
      reservation,
    });
  };
}

module.exports = {
  createMediaConfirmUploadHandler,
};
