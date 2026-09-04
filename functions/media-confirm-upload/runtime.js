function mapMediaObject(row, reservationId) {
  return {
    reservationId,
    status: 'verified',
    mediaObject: {
      id: row.media_object_id ?? row.id,
      objectKey: row.object_key,
      sha256: row.sha256,
      encryptedBytes: Number(row.encrypted_bytes),
      mediaKind: row.media_kind,
      uploadStatus: row.upload_status,
    },
  };
}

function createRuntimeDependencies({app, createCosClient, env}) {
  return {
    async getUser() {
      return app.auth().getUserInfo();
    },

    async findReservation({accountId, reservationId}) {
      const {data, error} = await app
        .rdb()
        .from('media_upload_reservations')
        .select(
          [
            'id',
            'account_id',
            'entry_commit_id',
            'media_id',
            'media_kind',
            'bytes',
            'reserved_free_bytes',
            'sha256',
            'status',
            'object_key',
            'expires_at',
          ].join(','),
        )
        .eq('id', reservationId)
        .eq('account_id', accountId)
        .limit(1);
      if (error) {
        throw new Error('无法读取媒体上传预留');
      }
      const row = data?.[0];
      if (!row) {
        return undefined;
      }
      return {
        id: row.id,
        accountId: row.account_id,
        entryCommitId: row.entry_commit_id,
        mediaId: row.media_id,
        mediaKind: row.media_kind,
        bytes: Number(row.bytes),
        reservedFreeBytes: Number(row.reserved_free_bytes),
        sha256: row.sha256,
        status: row.status,
        objectKey: row.object_key,
        expiresAt: Date.parse(row.expires_at),
      };
    },

    async findConfirmedUpload({accountId, reservation}) {
      const {data, error} = await app
        .rdb()
        .from('media_objects')
        .select(
          'id,object_key,sha256,encrypted_bytes,media_kind,upload_status',
        )
        .eq('account_id', accountId)
        .eq('sha256', reservation.sha256)
        .eq('upload_status', 'verified')
        .limit(1);
      if (error || !data?.[0]) {
        throw new Error('无法读取已确认媒体');
      }
      return mapMediaObject(data[0], reservation.id);
    },

    async headObject({bucket, region, objectKey}) {
      const credentials = {
        SecretId: env.TENCENTCLOUD_SECRETID,
        SecretKey: env.TENCENTCLOUD_SECRETKEY,
        SecurityToken: env.TENCENTCLOUD_SESSIONTOKEN,
      };
      if (
        !credentials.SecretId ||
        !credentials.SecretKey ||
        !credentials.SecurityToken
      ) {
        throw new Error('云函数临时凭证不可用');
      }
      const cos = createCosClient(credentials);
      return new Promise((resolve, reject) => {
        cos.headObject(
          {Bucket: bucket, Region: region, Key: objectKey},
          (error, data) => {
            if (error) {
              reject(new Error('无法读取 COS 媒体对象'));
              return;
            }
            const headers = data?.headers ?? data?.Headers ?? {};
            const shaHeader = Object.keys(headers).find(
              key => key.toLowerCase() === 'x-cos-meta-sha256',
            );
            const lengthHeader = Object.keys(headers).find(
              key => key.toLowerCase() === 'content-length',
            );
            const bytes = Number(
              data?.ContentLength ?? headers[lengthHeader],
            );
            const sha256 = String(headers[shaHeader] ?? '').toLowerCase();
            resolve({bytes, sha256});
          },
        );
      });
    },

    async commitConfirmedUpload({accountId, reservation}) {
      const result = await app.rdb().rpc('confirm_media_upload', {
        p_account_id: accountId,
        p_reservation_id: reservation.id,
        p_object_key: reservation.objectKey,
      });
      if (result?.error || !result?.data?.[0]) {
        throw new Error('无法确认媒体上传');
      }
      return mapMediaObject(result.data[0], reservation.id);
    },
  };
}

module.exports = {
  createRuntimeDependencies,
};
