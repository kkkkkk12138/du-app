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
        hasVerifiedMedia: (reservationResult?.data ?? []).some(item =>
          ['uploaded', 'verified'].includes(item.status),
        ),
      };
    },

    async releaseReservation({
      accountId,
      entryCommitId,
      requireExpired,
    }) {
      const result = await app.rdb().rpc('release_media_reservation', {
        p_account_id: accountId,
        p_entry_commit_id: entryCommitId,
        p_require_expired: requireExpired,
      });
      const row = result?.data?.[0];
      if (result?.error || !row) {
        throw new Error('无法释放媒体上传预留');
      }
      return {
        entryCommitId: row.entry_commit_id,
        status: row.status,
        releasedFreeBytes: Number(row.released_free_bytes),
      };
    },
  };
}

module.exports = {
  createRuntimeDependencies,
};
