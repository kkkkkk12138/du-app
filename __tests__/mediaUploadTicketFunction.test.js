const {
  createMediaUploadTicketHandler,
} = require('../functions/media-create-upload-ticket/handler');
const {
  createRuntimeDependencies,
} = require('../functions/media-create-upload-ticket/runtime');
const {
  createMain,
} = require('../functions/media-create-upload-ticket');

const validEvent = {
  reservationId: 'reserve_01',
  mediaId: 'media_01',
  bytes: 2_400_000,
  sha256: 'a'.repeat(64),
  contentType: 'image/jpeg',
};

function createDependencies(overrides = {}) {
  return {
    getUser: jest.fn().mockResolvedValue({
      uid: 'user_01',
      isAnonymous: false,
    }),
    findReservation: jest.fn().mockResolvedValue({
      id: 'reserve_01',
      accountId: 'user_01',
      mediaId: 'media_01',
      bytes: 2_400_000,
      sha256: 'a'.repeat(64),
      status: 'reserved',
      expiresAt: 1_800_000,
    }),
    signPutUrl: jest
      .fn()
      .mockResolvedValue('https://du-media.cos.ap-shanghai.myqcloud.com/upload'),
    markTicketed: jest.fn().mockResolvedValue(true),
    env: {
      COS_BUCKET: 'du-media-1234567890',
      COS_REGION: 'ap-shanghai',
    },
    now: () => 1_200_000,
    ...overrides,
  };
}

describe('media-create-upload-ticket', () => {
  test.each([
    [{uid: '', isAnonymous: false}],
    [{uid: 'anonymous_01', isAnonymous: true}],
  ])('rejects users without a registered account', async user => {
    const dependencies = createDependencies({
      getUser: jest.fn().mockResolvedValue(user),
    });
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow('请先注册或登录');
    expect(dependencies.findReservation).not.toHaveBeenCalled();
  });

  test.each([
    [{...validEvent, reservationId: ''}],
    [{...validEvent, mediaId: '../outside'}],
    [{...validEvent, bytes: 0}],
    [{...validEvent, bytes: 101 * 1024 * 1024}],
    [{...validEvent, sha256: 'not-a-sha256'}],
  ])('rejects invalid media input', async event => {
    const dependencies = createDependencies();
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(event, {})).rejects.toThrow('媒体上传参数无效');
    expect(dependencies.findReservation).not.toHaveBeenCalled();
  });

  test('rejects a reservation that does not match the media request', async () => {
    const dependencies = createDependencies({
      findReservation: jest.fn().mockResolvedValue({
        id: 'reserve_01',
        accountId: 'another_user',
        mediaId: 'media_01',
        bytes: 2_400_000,
        sha256: 'a'.repeat(64),
        status: 'reserved',
        expiresAt: 1_800_000,
      }),
    });
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow('媒体上传预留无效');
    expect(dependencies.signPutUrl).not.toHaveBeenCalled();
  });

  test('returns MEDIA_RESERVATION_EXPIRED for an expired reservation', async () => {
    const dependencies = createDependencies({
      findReservation: jest.fn().mockResolvedValue({
        id: 'reserve_01',
        accountId: 'user_01',
        mediaId: 'media_01',
        bytes: 2_400_000,
        sha256: 'a'.repeat(64),
        status: 'reserved',
        expiresAt: 1_200_000,
      }),
    });
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toMatchObject({
      code: 'MEDIA_RESERVATION_EXPIRED',
    });
    expect(dependencies.signPutUrl).not.toHaveBeenCalled();
  });

  test('returns a short-lived HTTPS PUT ticket for a valid reservation', async () => {
    const dependencies = createDependencies();
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toEqual({
      objectKey:
        'users/user_01/media/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-media_01.enc',
      uploadUrl:
        'https://du-media.cos.ap-shanghai.myqcloud.com/upload',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-cos-meta-sha256':
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      expiresAt: 1_800_000,
    });
    expect(dependencies.findReservation).toHaveBeenCalledWith({
      accountId: 'user_01',
      reservationId: 'reserve_01',
    });
    expect(dependencies.signPutUrl).toHaveBeenCalledWith({
      bucket: 'du-media-1234567890',
      region: 'ap-shanghai',
      objectKey:
        'users/user_01/media/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-media_01.enc',
      expiresSeconds: 600,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-cos-meta-sha256':
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });
    expect(dependencies.markTicketed).toHaveBeenCalledWith({
      reservationId: 'reserve_01',
      objectKey:
        'users/user_01/media/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-media_01.enc',
      expectedStatus: 'reserved',
    });
  });

  test('reissues a ticketed reservation for the same object key', async () => {
    const objectKey =
      'users/user_01/media/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-media_01.enc';
    const dependencies = createDependencies({
      findReservation: jest.fn().mockResolvedValue({
        id: 'reserve_01',
        accountId: 'user_01',
        mediaId: 'media_01',
        bytes: 2_400_000,
        sha256: 'a'.repeat(64),
        status: 'ticketed',
        objectKey,
        expiresAt: 1_800_000,
      }),
    });
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toMatchObject({objectKey});
    expect(dependencies.signPutUrl).toHaveBeenCalledWith(
      expect.objectContaining({objectKey}),
    );
    expect(dependencies.markTicketed).not.toHaveBeenCalled();
  });

  test.each(['uploaded', 'verified', 'released', 'expired'])(
    'rejects a reservation in %s state',
    async status => {
      const dependencies = createDependencies({
        findReservation: jest.fn().mockResolvedValue({
          id: 'reserve_01',
          accountId: 'user_01',
          mediaId: 'media_01',
          bytes: 2_400_000,
          sha256: 'a'.repeat(64),
          status,
          expiresAt: 1_800_000,
        }),
      });
      const handler = createMediaUploadTicketHandler(dependencies);

      await expect(handler(validEvent, {})).rejects.toThrow(
        '媒体上传预留无效',
      );
      expect(dependencies.signPutUrl).not.toHaveBeenCalled();
    },
  );

  test('rejects a ticketed reservation with a different object key', async () => {
    const dependencies = createDependencies({
      findReservation: jest.fn().mockResolvedValue({
        id: 'reserve_01',
        accountId: 'user_01',
        mediaId: 'media_01',
        bytes: 2_400_000,
        sha256: 'a'.repeat(64),
        status: 'ticketed',
        objectKey: 'users/user_01/media/wrong.enc',
        expiresAt: 1_800_000,
      }),
    });
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow(
      '媒体上传预留无效',
    );
    expect(dependencies.signPutUrl).not.toHaveBeenCalled();
  });

  test('rejects non-HTTPS signed URLs', async () => {
    const dependencies = createDependencies({
      signPutUrl: jest.fn().mockResolvedValue('http://example.com/upload'),
    });
    const handler = createMediaUploadTicketHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow(
      'COS 上传地址必须使用 HTTPS',
    );
  });
});

describe('media-create-upload-ticket runtime', () => {
  test('reads the current user and reservation from CloudBase', async () => {
    const limit = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'reserve_01',
          account_id: 'user_01',
          media_id: 'media_01',
          bytes: 2_400_000,
          sha256: 'a'.repeat(64),
          status: 'reserved',
          object_key: null,
          expires_at: '1970-01-01T00:30:00.000Z',
        },
      ],
      error: null,
    });
    const eqAccount = jest.fn(() => ({limit}));
    const eqReservation = jest.fn(() => ({eq: eqAccount}));
    const select = jest.fn(() => ({eq: eqReservation}));
    const from = jest.fn(() => ({select}));
    const getUserInfo = jest.fn(() => ({
      uid: 'user_01',
      isAnonymous: false,
    }));
    const app = {
      auth: () => ({getUserInfo}),
      rdb: () => ({from}),
    };
    const runtime = createRuntimeDependencies({
      app,
      createCosClient: jest.fn(),
      env: {},
    });

    await expect(runtime.getUser({})).resolves.toEqual({
      uid: 'user_01',
      isAnonymous: false,
    });
    await expect(
      runtime.findReservation({
        accountId: 'user_01',
        reservationId: 'reserve_01',
      }),
    ).resolves.toEqual({
      id: 'reserve_01',
      accountId: 'user_01',
      mediaId: 'media_01',
      bytes: 2_400_000,
      sha256: 'a'.repeat(64),
      status: 'reserved',
      objectKey: null,
      expiresAt: 1_800_000,
    });
    expect(from).toHaveBeenCalledWith('media_upload_reservations');
    expect(eqReservation).toHaveBeenCalledWith('id', 'reserve_01');
    expect(eqAccount).toHaveBeenCalledWith('account_id', 'user_01');
  });

  test('marks a reservation ticketed with a conditional status update', async () => {
    const finalEq = jest.fn().mockResolvedValue({count: 1, error: null});
    const statusEq = jest.fn(() => ({eq: finalEq}));
    const update = jest.fn(() => ({eq: statusEq}));
    const from = jest.fn(() => ({update}));
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({from}),
      },
      createCosClient: jest.fn(),
      env: {},
    });

    await expect(
      runtime.markTicketed({
        reservationId: 'reserve_01',
        objectKey: 'users/user_01/media/file.enc',
        expectedStatus: 'reserved',
      }),
    ).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ticketed',
        object_key: 'users/user_01/media/file.enc',
      }),
      {count: 'exact'},
    );
    expect(statusEq).toHaveBeenCalledWith('id', 'reserve_01');
    expect(finalEq).toHaveBeenCalledWith('status', 'reserved');
  });

  test('signs PUT URLs with temporary SCF credentials', async () => {
    const getObjectUrl = jest.fn((options, callback) =>
      callback(null, {Url: 'https://example.com/upload'}),
    );
    const createCosClient = jest.fn(() => ({getObjectUrl}));
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: jest.fn(),
      },
      createCosClient,
      env: {
        TENCENTCLOUD_SECRETID: 'temporary-id',
        TENCENTCLOUD_SECRETKEY: 'temporary-key',
        TENCENTCLOUD_SESSIONTOKEN: 'temporary-token',
      },
    });

    await expect(
      runtime.signPutUrl({
        bucket: 'du-media-1234567890',
        region: 'ap-shanghai',
        objectKey: 'users/user_01/media/file.enc',
        expiresSeconds: 600,
        headers: {'Content-Type': 'application/octet-stream'},
      }),
    ).resolves.toBe('https://example.com/upload');
    expect(createCosClient).toHaveBeenCalledWith({
      SecretId: 'temporary-id',
      SecretKey: 'temporary-key',
      SecurityToken: 'temporary-token',
    });
    expect(getObjectUrl).toHaveBeenCalledWith(
      {
        Bucket: 'du-media-1234567890',
        Region: 'ap-shanghai',
        Key: 'users/user_01/media/file.enc',
        Method: 'PUT',
        Sign: true,
        Expires: 600,
        Headers: {'Content-Type': 'application/octet-stream'},
      },
      expect.any(Function),
    );
  });
});

test('wires the CloudBase function entry without static credentials', async () => {
  const query = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: async () => ({
              data: [
                {
                  id: 'reserve_01',
                  account_id: 'user_01',
                  media_id: 'media_01',
                  bytes: 2_400_000,
                  sha256: 'a'.repeat(64),
                  status: 'reserved',
                  object_key: null,
                  expires_at: '2099-01-01T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: async () => ({count: 1, error: null}),
        }),
      }),
    }),
  };
  const app = {
    auth: () => ({
      getUserInfo: () => ({uid: 'user_01', isAnonymous: false}),
    }),
    rdb: () => query,
  };
  const cloudbase = {
    SYMBOL_CURRENT_ENV: Symbol('current-env'),
    init: jest.fn(() => app),
  };
  class FakeCos {
    getObjectUrl(_options, callback) {
      callback(null, {Url: 'https://example.com/upload'});
    }
  }
  const main = createMain({
    cloudbase,
    COS: FakeCos,
    env: {
      COS_BUCKET: 'du-media-1234567890',
      COS_REGION: 'ap-shanghai',
      TENCENTCLOUD_SECRETID: 'temporary-id',
      TENCENTCLOUD_SECRETKEY: 'temporary-key',
      TENCENTCLOUD_SESSIONTOKEN: 'temporary-token',
    },
  });

  await expect(main(validEvent, {})).resolves.toMatchObject({
    uploadUrl: 'https://example.com/upload',
    objectKey: expect.stringMatching(/^users\/user_01\/media\//),
  });
  expect(cloudbase.init).toHaveBeenCalledWith({
    env: cloudbase.SYMBOL_CURRENT_ENV,
  });
});
