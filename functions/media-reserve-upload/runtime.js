const {randomUUID: createRandomUUID} = require('crypto');

const CREDIT_COLUMNS =
  'account_id,free_media_limit_bytes,free_media_used_bytes,reserved_free_bytes';
const COMMIT_COLUMNS =
  'id,status,reserved_free_bytes,expires_at,idempotency_key';
const RESERVATION_COLUMNS =
  'id,media_id,media_kind,bytes,sha256,status';

function assertResult(result, message) {
  if (result?.error) {
    throw new Error(message);
  }
  return result?.data ?? [];
}

function mapCreditAccount(row) {
  return {
    accountId: row.account_id,
    freeMediaLimitBytes: Number(row.free_media_limit_bytes),
    freeMediaUsedBytes: Number(row.free_media_used_bytes),
    reservedFreeBytes: Number(row.reserved_free_bytes),
  };
}

function mapReservation(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    mediaKind: row.media_kind,
    bytes: Number(row.bytes),
    sha256: row.sha256,
    status: row.status,
  };
}

function createRuntimeDependencies({
  app,
  randomUUID = createRandomUUID,
}) {
  const rdb = () => app.rdb();
  const compareAndSwapAccountReservedBytes = async ({
    accountId,
    expectedReservedBytes,
    nextReservedBytes,
  }) => {
    const result = await rdb()
      .from('credit_accounts')
      .update(
        {
          reserved_free_bytes: nextReservedBytes,
          updated_at: new Date().toISOString(),
        },
        {count: 'exact'},
      )
      .eq('account_id', accountId)
      .eq('reserved_free_bytes', expectedReservedBytes);
    if (result?.error) {
      throw new Error('无法更新媒体空间预留');
    }
    return result?.count === 1;
  };

  const runtime = {
    async getUser() {
      return app.auth().getUserInfo();
    },

    async findCommitByIdempotencyKey({accountId, idempotencyKey}) {
      const commitResult = await rdb()
        .from('entry_commits')
        .select(COMMIT_COLUMNS)
        .eq('account_id', accountId)
        .eq('idempotency_key', idempotencyKey)
        .limit(1);
      const commit = assertResult(
        commitResult,
        '无法读取媒体上传预留',
      )[0];
      if (!commit) {
        return undefined;
      }

      const reservationResult = await rdb()
        .from('media_upload_reservations')
        .select(RESERVATION_COLUMNS)
        .eq('account_id', accountId)
        .eq('entry_commit_id', commit.id);
      const reservations = assertResult(
        reservationResult,
        '无法读取媒体上传预留',
      );

      return {
        entryCommitId: commit.id,
        status: commit.status,
        reservedFreeBytes: Number(commit.reserved_free_bytes),
        expiresAt: Date.parse(commit.expires_at),
        media: reservations.map(mapReservation),
      };
    },

    async ensureCreditAccount({accountId}) {
      const read = async () => {
        const result = await rdb()
          .from('credit_accounts')
          .select(CREDIT_COLUMNS)
          .eq('account_id', accountId)
          .limit(1);
        return assertResult(result, '无法读取媒体空间账户')[0];
      };

      let row = await read();
      if (!row) {
        const insertResult = await rdb()
          .from('credit_accounts')
          .insert({account_id: accountId})
          .select(CREDIT_COLUMNS);
        if (!insertResult?.error) {
          row = insertResult.data?.[0];
        } else {
          row = await read();
        }
      }
      if (!row) {
        throw new Error('无法创建媒体空间账户');
      }
      return mapCreditAccount(row);
    },

    async createAllocatingCommit({
      accountId,
      entryCommitId,
      entryType,
      localEntryId,
      idempotencyKey,
      reservedFreeBytes,
      expiresAt,
    }) {
      const result = await rdb().from('entry_commits').insert({
        id: entryCommitId,
        account_id: accountId,
        entry_type: entryType,
        local_entry_id: localEntryId,
        status: 'allocating',
        reserved_free_bytes: reservedFreeBytes,
        idempotency_key: idempotencyKey,
        expires_at: new Date(expiresAt).toISOString(),
      });
      assertResult(result, '无法创建媒体上传提交');
    },

    async compareAndSwapReservedBytes({
      accountId,
      entryCommitId,
      expectedReservedBytes,
      nextReservedBytes,
    }) {
      const result = await rdb().rpc('reserve_media_capacity', {
        p_account_id: accountId,
        p_entry_commit_id: entryCommitId,
        p_expected_reserved_bytes: expectedReservedBytes,
        p_next_reserved_bytes: nextReservedBytes,
      });
      if (result?.error) {
        throw new Error('无法更新媒体空间预留');
      }
      return result?.data === true;
    },

    async createReservations({
      accountId,
      entryCommitId,
      expiresAt,
      media,
    }) {
      const rows = media.map(item => ({
        id: randomUUID(),
        account_id: accountId,
        entry_commit_id: entryCommitId,
        media_id: item.mediaId,
        media_kind: item.mediaKind,
        bytes: item.encryptedBytes,
        sha256: item.sha256,
        reserved_free_bytes: item.encryptedBytes,
        status: 'reserved',
        expires_at: new Date(expiresAt).toISOString(),
      }));
      const result = await rdb()
        .from('media_upload_reservations')
        .insert(rows)
        .select(RESERVATION_COLUMNS);
      return assertResult(
        result,
        '无法创建媒体上传预留',
      ).map(mapReservation);
    },

    async markCommitReserved({accountId, entryCommitId}) {
      const result = await rdb()
        .from('entry_commits')
        .update({
          status: 'reserved',
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId)
        .eq('id', entryCommitId);
      assertResult(result, '无法确认媒体上传预留');
    },

    async markCommitFailed({accountId, entryCommitId}) {
      const result = await rdb()
        .from('entry_commits')
        .update({
          status: 'failed',
          quota_reserved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId)
        .eq('id', entryCommitId);
      assertResult(result, '无法记录媒体预留失败');
    },

    async releaseReservedBytes({accountId, reservedBytes}) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const account = await runtime.ensureCreditAccount({accountId});
        if (account.reservedFreeBytes < reservedBytes) {
          throw new Error('媒体空间预留账本不一致');
        }
        const released = await compareAndSwapAccountReservedBytes({
          accountId,
          expectedReservedBytes: account.reservedFreeBytes,
          nextReservedBytes: account.reservedFreeBytes - reservedBytes,
        });
        if (released) {
          return;
        }
      }
      throw new Error('无法释放媒体空间预留');
    },
  };

  return runtime;
}

module.exports = {
  createRuntimeDependencies,
};
