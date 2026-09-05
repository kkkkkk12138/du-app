const KEY_VERIFIER = /^[a-f0-9]{64}$/;

function parseEvent(event) {
  if (!KEY_VERIFIER.test(event?.keyVerifier ?? '')) {
    throw new Error('账号加密身份参数无效');
  }
  return {keyVerifier: event.keyVerifier};
}

function createAccountInitializeKeyHandler({
  getUser,
  claimEncryptionIdentity,
}) {
  return async function accountInitializeKeyHandler(event, context) {
    const user = await getUser(context);
    if (!user?.uid || user.isAnonymous) {
      throw new Error('请先注册或登录');
    }

    const input = parseEvent(event);
    const result = await claimEncryptionIdentity({
      accountId: user.uid,
      keyVerifier: input.keyVerifier,
    });

    return {
      status: result.status,
      keyVersion: result.keyVersion,
    };
  };
}

module.exports = {
  createAccountInitializeKeyHandler,
};
