function createRuntimeDependencies({app, createCosClient, env}) {
  return {
    async getUser() {
      return app.auth().getUserInfo();
    },

    async findReservation({accountId, reservationId}) {
      const {data, error} = await app
        .rdb()
        .from('media_upload_reservations')
        .select('id,account_id,media_id,bytes,sha256,status,expires_at')
        .eq('id', reservationId)
        .eq('account_id', accountId)
        .limit(1);

      if (error) {
        throw new Error('无法校验媒体上传预留');
      }
      const row = data?.[0];
      if (!row) {
        return undefined;
      }

      return {
        id: row.id,
        accountId: row.account_id,
        mediaId: row.media_id,
        bytes: Number(row.bytes),
        sha256: row.sha256,
        status: row.status,
        expiresAt: Date.parse(row.expires_at),
      };
    },

    async signPutUrl({
      bucket,
      region,
      objectKey,
      expiresSeconds,
      headers,
    }) {
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
        cos.getObjectUrl(
          {
            Bucket: bucket,
            Region: region,
            Key: objectKey,
            Method: 'PUT',
            Sign: true,
            Expires: expiresSeconds,
            Headers: headers,
          },
          (error, data) => {
            if (error || !data?.Url) {
              reject(new Error('无法创建 COS 上传地址'));
              return;
            }
            resolve(data.Url);
          },
        );
      });
    },

    env,
  };
}

module.exports = {
  createRuntimeDependencies,
};
