const {
  createMediaReservationHandler,
} = require('../functions/media-reserve-upload/handler');
const {
  createRuntimeDependencies,
} = require('../functions/media-reserve-upload/runtime');
const {
  createMain,
} = require('../functions/media-reserve-upload');

const validEvent = {
  entryCommitId: 'commit_01',
  entryType: 'memory',
  localEntryId: 'memory_01',
  idempotencyKey: 'save-memory-01-revision-3',
  media: [
    {
      mediaId: 'media_01',
      mediaKind: 'photo',
      encryptedBytes: 2048,
      sha256: 'a'.repeat(64),
    },
    {
      mediaId: 'media_02',
      mediaKind: 'audio',
      encryptedBytes: 4096,
      sha256: 'b'.repeat(64),
    },
  ],
};

function createDependencies(overrides = {}) {
  return {
    getUser: jest.fn().mockResolvedValue({
      uid: 'user_01',
      isAnonymous: false,
    }),
    findCommitByIdempotencyKey: jest.fn().mockResolvedValue(undefined),
    ensureCreditAccount: jest.fn().mockResolvedValue({
      accountId: 'user_01',
      freeMediaLimitBytes: 524_288_000,
      freeMediaUsedBytes: 1000,
      reservedFreeBytes: 2000,
    }),
    createAllocatingCommit: jest.fn().mockResolvedValue(undefined),
    compareAndSwapReservedBytes: jest.fn().mockResolvedValue(true),
    createReservations: jest.fn().mockResolvedValue([
      {
        id: 'reservation_01',
        mediaId: 'media_01',
        mediaKind: 'photo',
        bytes: 2048,
        sha256: 'a'.repeat(64),
        status: 'reserved',
      },
      {
        id: 'reservation_02',
        mediaId: 'media_02',
        mediaKind: 'audio',
        bytes: 4096,
        sha256: 'b'.repeat(64),
        status: 'reserved',
      },
    ]),
    markCommitReserved: jest.fn().mockResolvedValue(undefined),
    markCommitFailed: jest.fn().mockResolvedValue(undefined),
    releaseReservedBytes: jest.fn().mockResolvedValue(undefined),
    now: () => 1_000_000,
    ...overrides,
  };
}

describe('media-reserve-upload', () => {
  test.each([
    [{uid: '', isAnonymous: false}],
    [{uid: 'anonymous_01', isAnonymous: true}],
  ])('rejects users without a registered account', async user => {
    const dependencies = createDependencies({
      getUser: jest.fn().mockResolvedValue(user),
    });
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow('请先注册或登录');
    expect(dependencies.ensureCreditAccount).not.toHaveBeenCalled();
  });

  test.each([
    [{...validEvent, entryCommitId: '../commit'}],
    [{...validEvent, entryType: 'note'}],
    [{...validEvent, localEntryId: ''}],
    [{...validEvent, idempotencyKey: ''}],
    [{...validEvent, media: []}],
    [
      {
        ...validEvent,
        media: [{...validEvent.media[0], mediaKind: 'video'}],
      },
    ],
    [
      {
        ...validEvent,
        media: [{...validEvent.media[0], encryptedBytes: 0}],
      },
    ],
    [
      {
        ...validEvent,
        media: [{...validEvent.media[0], sha256: 'invalid'}],
      },
    ],
  ])('rejects invalid reservation input', async event => {
    const dependencies = createDependencies();
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(event, {})).rejects.toThrow('媒体预留参数无效');
    expect(
      dependencies.findCommitByIdempotencyKey,
    ).not.toHaveBeenCalled();
  });

  test('returns the existing reservation for a duplicate idempotency key', async () => {
    const existing = {
      entryCommitId: 'commit_existing',
      status: 'reserved',
      reservedFreeBytes: 6144,
      expiresAt: 1_900_000,
      media: [{id: 'reservation_existing'}],
    };
    const dependencies = createDependencies({
      findCommitByIdempotencyKey: jest
        .fn()
        .mockResolvedValue(existing),
    });
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toEqual(existing);
    expect(dependencies.ensureCreditAccount).not.toHaveBeenCalled();
    expect(dependencies.createAllocatingCommit).not.toHaveBeenCalled();
  });

  test('rejects an aggregate request over the remaining free allowance', async () => {
    const dependencies = createDependencies({
      ensureCreditAccount: jest.fn().mockResolvedValue({
        accountId: 'user_01',
        freeMediaLimitBytes: 7000,
        freeMediaUsedBytes: 1000,
        reservedFreeBytes: 1000,
      }),
    });
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toMatchObject({
      code: 'MEDIA_SPACE_EXHAUSTED',
      message: '免费媒体空间已用完，仍可保存纯文字内容',
    });
    expect(dependencies.compareAndSwapReservedBytes).not.toHaveBeenCalled();
  });

  test('retries compare-and-swap conflicts at most three times', async () => {
    const ensureCreditAccount = jest
      .fn()
      .mockResolvedValueOnce({
        accountId: 'user_01',
        freeMediaLimitBytes: 524_288_000,
        freeMediaUsedBytes: 1000,
        reservedFreeBytes: 2000,
      })
      .mockResolvedValueOnce({
        accountId: 'user_01',
        freeMediaLimitBytes: 524_288_000,
        freeMediaUsedBytes: 1000,
        reservedFreeBytes: 3000,
      })
      .mockResolvedValueOnce({
        accountId: 'user_01',
        freeMediaLimitBytes: 524_288_000,
        freeMediaUsedBytes: 1000,
        reservedFreeBytes: 4000,
      });
    const compareAndSwapReservedBytes = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const dependencies = createDependencies({
      ensureCreditAccount,
      compareAndSwapReservedBytes,
    });
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toMatchObject({
      entryCommitId: 'commit_01',
      status: 'reserved',
      reservedFreeBytes: 6144,
    });
    expect(compareAndSwapReservedBytes).toHaveBeenCalledTimes(3);
    expect(ensureCreditAccount).toHaveBeenCalledTimes(3);
  });

  test('releases the exact reserved bytes after a partial failure', async () => {
    const dependencies = createDependencies({
      createReservations: jest
        .fn()
        .mockRejectedValue(new Error('reservation insert failed')),
    });
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow(
      'reservation insert failed',
    );
    expect(dependencies.releaseReservedBytes).toHaveBeenCalledWith({
      accountId: 'user_01',
      reservedBytes: 6144,
    });
    expect(dependencies.markCommitFailed).toHaveBeenCalledWith({
      accountId: 'user_01',
      entryCommitId: 'commit_01',
    });
  });

  test('creates one server-controlled reservation per encrypted attachment', async () => {
    const dependencies = createDependencies();
    const handler = createMediaReservationHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toEqual({
      entryCommitId: 'commit_01',
      status: 'reserved',
      reservedFreeBytes: 6144,
      expiresAt: 1_900_000,
      media: expect.arrayContaining([
        expect.objectContaining({
          id: 'reservation_01',
          mediaId: 'media_01',
          bytes: 2048,
        }),
      ]),
    });
    expect(dependencies.createAllocatingCommit).toHaveBeenCalledWith({
      accountId: 'user_01',
      entryCommitId: 'commit_01',
      entryType: 'memory',
      localEntryId: 'memory_01',
      idempotencyKey: 'save-memory-01-revision-3',
      reservedFreeBytes: 6144,
      expiresAt: 1_900_000,
    });
    expect(dependencies.markCommitReserved).toHaveBeenCalledWith({
      accountId: 'user_01',
      entryCommitId: 'commit_01',
    });
  });
});

describe('media-reserve-upload runtime', () => {
  test('uses an account-scoped compare-and-swap for reserved bytes', async () => {
    const finalEq = jest.fn().mockResolvedValue({
      count: 1,
      error: null,
    });
    const accountEq = jest.fn(() => ({eq: finalEq}));
    const update = jest.fn(() => ({eq: accountEq}));
    const from = jest.fn(() => ({update}));
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({from}),
      },
      randomUUID: jest.fn(),
    });

    await expect(
      runtime.compareAndSwapReservedBytes({
        accountId: 'user_01',
        expectedReservedBytes: 2000,
        nextReservedBytes: 8144,
      }),
    ).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('credit_accounts');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        reserved_free_bytes: 8144,
      }),
      {count: 'exact'},
    );
    expect(accountEq).toHaveBeenCalledWith('account_id', 'user_01');
    expect(finalEq).toHaveBeenCalledWith('reserved_free_bytes', 2000);
  });

  test('creates reservation IDs on the server', async () => {
    const select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'server-reservation-01',
          media_id: 'media_01',
          media_kind: 'photo',
          bytes: 2048,
          sha256: 'a'.repeat(64),
          status: 'reserved',
        },
      ],
      error: null,
    });
    const insert = jest.fn(() => ({select}));
    const from = jest.fn(() => ({insert}));
    const randomUUID = jest.fn().mockReturnValue('server-reservation-01');
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({from}),
      },
      randomUUID,
    });

    await expect(
      runtime.createReservations({
        accountId: 'user_01',
        entryCommitId: 'commit_01',
        expiresAt: 1_900_000,
        media: [validEvent.media[0]],
      }),
    ).resolves.toEqual([
      {
        id: 'server-reservation-01',
        mediaId: 'media_01',
        mediaKind: 'photo',
        bytes: 2048,
        sha256: 'a'.repeat(64),
        status: 'reserved',
      },
    ]);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'server-reservation-01',
        account_id: 'user_01',
        reserved_free_bytes: 2048,
      }),
    ]);
  });

  test('refuses to release more bytes than the account has reserved', async () => {
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: jest.fn(),
      },
      randomUUID: jest.fn(),
    });
    runtime.ensureCreditAccount = jest.fn().mockResolvedValue({
      accountId: 'user_01',
      freeMediaLimitBytes: 524_288_000,
      freeMediaUsedBytes: 1000,
      reservedFreeBytes: 1024,
    });
    runtime.compareAndSwapReservedBytes = jest.fn();

    await expect(
      runtime.releaseReservedBytes({
        accountId: 'user_01',
        reservedBytes: 2048,
      }),
    ).rejects.toThrow('媒体空间预留账本不一致');
    expect(runtime.compareAndSwapReservedBytes).not.toHaveBeenCalled();
  });
});

test('wires the reservation function to the current CloudBase environment', async () => {
  const getUserInfo = jest.fn().mockReturnValue({
    uid: 'anonymous_01',
    isAnonymous: true,
  });
  const app = {
    auth: () => ({getUserInfo}),
    rdb: jest.fn(),
  };
  const cloudbase = {
    SYMBOL_CURRENT_ENV: Symbol('current-env'),
    init: jest.fn(() => app),
  };
  const main = createMain({
    cloudbase,
    randomUUID: jest.fn(),
  });

  await expect(main(validEvent, {})).rejects.toThrow('请先注册或登录');
  expect(cloudbase.init).toHaveBeenCalledWith({
    env: cloudbase.SYMBOL_CURRENT_ENV,
  });
  expect(app.rdb).not.toHaveBeenCalled();
});
