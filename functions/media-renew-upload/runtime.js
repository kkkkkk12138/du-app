const RENEWAL_ERROR_CODES = [
  'MEDIA_RESERVATION_EXPIRED',
  'MEDIA_RESERVATION_RELEASED',
  'MEDIA_RESERVATION_NOT_FOUND',
];
const RENEWABLE_STATUSES = new Set([
  'reserved',
  'ticketed',
  'verified',
]);

function createCodedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function throwRenewalError(error) {
  const message = String(error?.message ?? error ?? '');
  const code = RENEWAL_ERROR_CODES.find(candidate =>
    message.includes(candidate),
  );
  if (code) {
    throw createCodedError(code);
  }
  throw new Error('无法续期媒体上传预留');
}

function createRuntimeDependencies({app}) {
  return {
    async getUser() {
      return app.auth().getUserInfo();
    },

    async findCommit({accountId, entryCommitId}) {
      const commitResult = await app
        .rdb()
        .from('entry_commits')
        .select('id,account_id,status,expires_at')
        .eq('id', entryCommitId)
        .eq('account_id', accountId)
        .limit(1);
      if (commitResult?.error) {
        throw new Error('无法读取媒体上传提交');
      }
      const row = commitResult?.data?.[0];
      if (!row) {
        return undefined;
      }

      const reservationResult = await app
        .rdb()
        .from('media_upload_reservations')
        .select('status')
        .eq('entry_commit_id', entryCommitId)
        .eq('account_id', accountId);
      if (reservationResult?.error) {
        throw new Error('无法读取媒体上传预留');
      }

      return {
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        expiresAt: Date.parse(row.expires_at),
        hasExpiredMedia: (reservationResult?.data ?? []).some(
          item => item.status === 'expired',
        ),
      };
    },

    async renewReservations({
      accountId,
      entryCommitId,
      expiresAt,
    }) {
      const result = await app
        .rdb()
        .rpc('renew_media_upload_reservations', {
          p_account_id: accountId,
          p_entry_commit_id: entryCommitId,
          p_expires_at: new Date(expiresAt).toISOString(),
        });
      if (result?.error) {
        throwRenewalError(result.error);
      }

      const rows = result?.data ?? [];
      return rows.map(row => {
        const mappedExpiry = Date.parse(row.expires_at);
        if (
          !row.reservation_id ||
          !RENEWABLE_STATUSES.has(row.status) ||
          !Number.isFinite(mappedExpiry)
        ) {
          throw new Error('媒体上传续期结果无效');
        }
        return {
          id: row.reservation_id,
          status: row.status,
          expiresAt: mappedExpiry,
        };
      });
    },
  };
}

module.exports = {
  createRuntimeDependencies,
};
