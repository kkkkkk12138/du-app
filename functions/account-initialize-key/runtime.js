const CLAIM_STATUSES = new Set([
  'claimed',
  'existing',
  'recovery_required',
]);

function createRuntimeDependencies({app}) {
  return {
    async getUser() {
      return app.auth().getUserInfo();
    },

    async claimEncryptionIdentity({accountId, keyVerifier}) {
      const result = await app
        .rdb()
        .rpc('claim_account_encryption_identity', {
          p_account_id: accountId,
          p_key_verifier: keyVerifier,
        });
      const row = result?.data?.[0];
      const keyVersion = Number(row?.key_version);
      if (
        result?.error ||
        !row ||
        !CLAIM_STATUSES.has(row.status) ||
        keyVersion !== 1
      ) {
        throw new Error('无法初始化账号加密身份');
      }
      return {
        status: row.status,
        keyVersion,
      };
    },
  };
}

module.exports = {
  createRuntimeDependencies,
};
