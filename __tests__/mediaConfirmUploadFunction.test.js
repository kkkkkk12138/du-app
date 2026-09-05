const {
  createMediaConfirmUploadHandler,
} = require('../functions/media-confirm-upload/handler');
const {
  createRuntimeDependencies,
} = require('../functions/media-confirm-upload/runtime');
const {createMain} = require('../functions/media-confirm-upload');

const validEvent = {reservationId: 'reserve_01'};
const reservation = {
  id: 'reserve_01',
  accountId: 'user_01',
  entryCommitId: 'commit_01',
  mediaId: 'media_01',
  mediaKind: 'photo',
  bytes: 32,
  reservedFreeBytes: 32,
  sha256: 'a'.repeat(64),
  status: 'ticketed',
  objectKey:
    'users/user_01/media/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-media_01.enc',
  expiresAt: 1_800_000,
};
const confirmed = {
  reservationId: 'reserve_01',
  status: 'verified',
  mediaObject: {
    id: 'media_01',
    objectKey: reservation.objectKey,
    sha256: reservation.sha256,
    encryptedBytes: 32,
    mediaKind: 'photo',
    uploadStatus: 'verified',
  },
};

function createDependencies(overrides = {}) {
  return {
    getUser: jest.fn().mockResolvedValue({
      uid: 'user_01',
      isAnonymous: false,
    }),
    findReservation: jest.fn().mockResolvedValue(reservation),
    findConfirmedUpload: jest.fn().mockResolvedValue(confirmed),
    headObject: jest.fn().mockResolvedValue({
      bytes: 32,
      sha256: 'a'.repeat(64),
    }),
    commitConfirmedUpload: jest.fn().mockResolvedValue(confirmed),
    env: {
      COS_BUCKET: 'du-media-dev-1480992132',
      COS_REGION: 'ap-shanghai',
    },
    now: () => 1_200_000,
    ...overrides,
  };
}

describe('media-confirm-upload', () => {
  test.each([
    [{uid: '', isAnonymous: false}],
    [{uid: 'anonymous_01', isAnonymous: true}],
  ])('rejects users without a registered account', async user => {
    const dependencies = createDependencies({
      getUser: jest.fn().mockResolvedValue(user),
    });
    const handler = createMediaConfirmUploadHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow('请先注册或登录');
    expect(dependencies.findReservation).not.toHaveBeenCalled();
  });

  test('returns an already verified upload without reading COS again', async () => {
    const verifiedReservation = {
      ...reservation,
      status: 'verified',
    };
    const dependencies = createDependencies({
      findReservation: jest.fn().mockResolvedValue(verifiedReservation),
    });
    const handler = createMediaConfirmUploadHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toEqual(confirmed);
    expect(dependencies.findConfirmedUpload).toHaveBeenCalledWith({
      accountId: 'user_01',
      reservation: verifiedReservation,
    });
    expect(dependencies.headObject).not.toHaveBeenCalled();
    expect(dependencies.commitConfirmedUpload).not.toHaveBeenCalled();
  });

  test('heads the server-stored object and confirms matching ciphertext', async () => {
    const dependencies = createDependencies();
    const handler = createMediaConfirmUploadHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toEqual(confirmed);
    expect(dependencies.headObject).toHaveBeenCalledWith({
      bucket: 'du-media-dev-1480992132',
      region: 'ap-shanghai',
      objectKey: reservation.objectKey,
    });
    expect(dependencies.commitConfirmedUpload).toHaveBeenCalledWith({
      accountId: 'user_01',
      reservation,
    });
  });

  test('returns MEDIA_RESERVATION_EXPIRED for an expired reservation', async () => {
    const dependencies = createDependencies({
      findReservation: jest.fn().mockResolvedValue({
        ...reservation,
        expiresAt: 1_200_000,
      }),
    });
    const handler = createMediaConfirmUploadHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toMatchObject({
      code: 'MEDIA_RESERVATION_EXPIRED',
    });
    expect(dependencies.headObject).not.toHaveBeenCalled();
  });

  test.each([
    [{bytes: 31, sha256: 'a'.repeat(64)}],
    [{bytes: 32, sha256: 'b'.repeat(64)}],
  ])('rejects ciphertext with mismatched COS metadata', async object => {
    const dependencies = createDependencies({
      headObject: jest.fn().mockResolvedValue(object),
    });
    const handler = createMediaConfirmUploadHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow(
      'COS 媒体对象校验失败',
    );
    expect(dependencies.commitConfirmedUpload).not.toHaveBeenCalled();
  });

  test.each(['reserved', 'uploaded', 'released', 'expired'])(
    'rejects confirmation from %s state',
    async status => {
      const dependencies = createDependencies({
        findReservation: jest.fn().mockResolvedValue({
          ...reservation,
          status,
        }),
      });
      const handler = createMediaConfirmUploadHandler(dependencies);

      await expect(handler(validEvent, {})).rejects.toThrow(
        '媒体上传预留不可确认',
      );
      expect(dependencies.headObject).not.toHaveBeenCalled();
    },
  );
});

describe('media-confirm-upload runtime', () => {
  test('reads COS object length and sha256 metadata', async () => {
    const headObject = jest.fn((_input, callback) =>
      callback(null, {
        headers: {
          'content-length': '32',
          'x-cos-meta-sha256': 'A'.repeat(64),
        },
      }),
    );
    const runtime = createRuntimeDependencies({
      app: {auth: () => ({getUserInfo: jest.fn()}), rdb: jest.fn()},
      createCosClient: jest.fn(() => ({headObject})),
      env: {
        TENCENTCLOUD_SECRETID: 'temporary-id',
        TENCENTCLOUD_SECRETKEY: 'temporary-key',
        TENCENTCLOUD_SESSIONTOKEN: 'temporary-token',
      },
    });

    await expect(
      runtime.headObject({
        bucket: 'du-media-dev-1480992132',
        region: 'ap-shanghai',
        objectKey: reservation.objectKey,
      }),
    ).resolves.toEqual({bytes: 32, sha256: 'a'.repeat(64)});
  });

  test('calls the atomic confirmation database function', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          media_object_id: 'media_01',
          object_key: reservation.objectKey,
          sha256: reservation.sha256,
          encrypted_bytes: 32,
          media_kind: 'photo',
          upload_status: 'verified',
        },
      ],
      error: null,
    });
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({rpc}),
      },
      createCosClient: jest.fn(),
      env: {},
    });

    await expect(
      runtime.commitConfirmedUpload({
        accountId: 'user_01',
        reservation,
      }),
    ).resolves.toEqual(confirmed);
    expect(rpc).toHaveBeenCalledWith('confirm_media_upload', {
      p_account_id: 'user_01',
      p_reservation_id: 'reserve_01',
      p_object_key: reservation.objectKey,
    });
  });
});

test('wires the confirmation function to the current CloudBase environment', async () => {
  const app = {
    auth: () => ({
      getUserInfo: () => ({uid: 'anonymous_01', isAnonymous: true}),
    }),
    rdb: jest.fn(),
  };
  const cloudbase = {
    SYMBOL_CURRENT_ENV: Symbol('current-env'),
    init: jest.fn(() => app),
  };
  const main = createMain({
    cloudbase,
    COS: jest.fn(),
    env: {},
  });

  await expect(main(validEvent, {})).rejects.toThrow('请先注册或登录');
  expect(cloudbase.init).toHaveBeenCalledWith({
    env: cloudbase.SYMBOL_CURRENT_ENV,
  });
  expect(app.rdb).not.toHaveBeenCalled();
});
