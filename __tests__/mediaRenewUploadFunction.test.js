const fs = require('fs');
const path = require('path');

const renewModulePath = '../functions/media-renew-upload';
const migrationPath = path.join(
  __dirname,
  '..',
  'cloudbase',
  'migrations',
  '20260904075000_renew_media_reservations.sql',
);
const validEvent = {entryCommitId: 'commit_01'};
const renewedExpiry = 1_900_000;

function loadRenewFunction() {
  return require(renewModulePath);
}

function createDependencies(overrides = {}) {
  return {
    getUser: jest.fn().mockResolvedValue({
      uid: 'user_01',
      isAnonymous: false,
    }),
    findCommit: jest.fn().mockResolvedValue({
      id: 'commit_01',
      accountId: 'user_01',
      status: 'reserved',
      hasExpiredMedia: false,
    }),
    renewReservations: jest.fn().mockResolvedValue([
      {
        id: 'reservation_01',
        status: 'reserved',
        expiresAt: renewedExpiry,
      },
      {
        id: 'reservation_02',
        status: 'ticketed',
        expiresAt: renewedExpiry,
      },
    ]),
    now: () => 1_000_000,
    ...overrides,
  };
}

describe('media-renew-upload', () => {
  test.each([
    [{uid: '', isAnonymous: false}],
    [{uid: 'anonymous_01', isAnonymous: true}],
  ])('rejects users without a registered account', async user => {
    const {createMediaRenewUploadHandler} = loadRenewFunction();
    const dependencies = createDependencies({
      getUser: jest.fn().mockResolvedValue(user),
    });
    const handler = createMediaRenewUploadHandler(dependencies);

    await expect(handler(validEvent, {})).rejects.toThrow(
      '请先注册或登录',
    );
    expect(dependencies.findCommit).not.toHaveBeenCalled();
  });

  test('renews reserved and ticketed items owned by the caller', async () => {
    const {createMediaRenewUploadHandler} = loadRenewFunction();
    const dependencies = createDependencies();
    const handler = createMediaRenewUploadHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toEqual({
      entryCommitId: 'commit_01',
      expiresAt: renewedExpiry,
      media: [
        {
          id: 'reservation_01',
          status: 'reserved',
          expiresAt: renewedExpiry,
        },
        {
          id: 'reservation_02',
          status: 'ticketed',
          expiresAt: renewedExpiry,
        },
      ],
    });
    expect(dependencies.renewReservations).toHaveBeenCalledWith({
      accountId: 'user_01',
      entryCommitId: 'commit_01',
      expiresAt: renewedExpiry,
    });
  });

  test('keeps verified items unchanged during renewal', async () => {
    const {createMediaRenewUploadHandler} = loadRenewFunction();
    const dependencies = createDependencies({
      renewReservations: jest.fn().mockResolvedValue([
        {
          id: 'reservation_01',
          status: 'verified',
          expiresAt: 1_100_000,
        },
      ]),
    });
    const handler = createMediaRenewUploadHandler(dependencies);

    await expect(handler(validEvent, {})).resolves.toMatchObject({
      expiresAt: renewedExpiry,
      media: [
        {
          id: 'reservation_01',
          status: 'verified',
          expiresAt: 1_100_000,
        },
      ],
    });
  });

  test('rejects released commits and cross-account renewal', async () => {
    const {createMediaRenewUploadHandler} = loadRenewFunction();
    const released = createDependencies({
      findCommit: jest.fn().mockResolvedValue({
        id: 'commit_01',
        accountId: 'user_01',
        status: 'released',
        hasExpiredMedia: false,
      }),
    });
    const crossAccount = createDependencies({
      findCommit: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      createMediaRenewUploadHandler(released)(validEvent, {}),
    ).rejects.toMatchObject({code: 'MEDIA_RESERVATION_RELEASED'});
    await expect(
      createMediaRenewUploadHandler(crossAccount)(validEvent, {}),
    ).rejects.toMatchObject({code: 'MEDIA_RESERVATION_NOT_FOUND'});
    expect(released.renewReservations).not.toHaveBeenCalled();
    expect(crossAccount.renewReservations).not.toHaveBeenCalled();
  });

  test('rejects reservations already marked expired', async () => {
    const {createMediaRenewUploadHandler} = loadRenewFunction();
    const dependencies = createDependencies({
      findCommit: jest.fn().mockResolvedValue({
        id: 'commit_01',
        accountId: 'user_01',
        status: 'reserved',
        hasExpiredMedia: true,
      }),
    });

    await expect(
      createMediaRenewUploadHandler(dependencies)(validEvent, {}),
    ).rejects.toMatchObject({code: 'MEDIA_RESERVATION_EXPIRED'});
    expect(dependencies.renewReservations).not.toHaveBeenCalled();
  });

  test('returns the same renewed expiry when called twice', async () => {
    const {createMediaRenewUploadHandler} = loadRenewFunction();
    let currentTime = 1_000_000;
    let commitExpiry = 900_000;
    const renewReservations = jest.fn(
      async ({expiresAt}) => {
        commitExpiry = expiresAt;
        return [
          {
            id: 'reservation_01',
            status: 'reserved',
            expiresAt,
          },
        ];
      },
    );
    const dependencies = createDependencies({
      findCommit: jest.fn(async () => ({
        id: 'commit_01',
        accountId: 'user_01',
        status: 'reserved',
        expiresAt: commitExpiry,
        hasExpiredMedia: false,
      })),
      renewReservations,
      now: () => currentTime,
    });
    const handler = createMediaRenewUploadHandler(dependencies);

    const first = await handler(validEvent, {});
    currentTime += 1_000;
    const second = await handler(validEvent, {});

    expect(first.expiresAt).toBe(renewedExpiry);
    expect(second.expiresAt).toBe(renewedExpiry);
    expect(renewReservations).toHaveBeenNthCalledWith(2, {
      accountId: 'user_01',
      entryCommitId: 'commit_01',
      expiresAt: renewedExpiry,
    });
  });
});

describe('media-renew-upload runtime and migration', () => {
  test('calls the atomic renewal function and maps its rows', async () => {
    const {createRuntimeDependencies} = loadRenewFunction();
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          reservation_id: 'reservation_01',
          status: 'ticketed',
          expires_at: '1970-01-01T00:31:40.000Z',
        },
      ],
      error: null,
    });
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({rpc}),
      },
    });

    await expect(
      runtime.renewReservations({
        accountId: 'user_01',
        entryCommitId: 'commit_01',
        expiresAt: renewedExpiry,
      }),
    ).resolves.toEqual([
      {
        id: 'reservation_01',
        status: 'ticketed',
        expiresAt: renewedExpiry,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith(
      'renew_media_upload_reservations',
      {
        p_account_id: 'user_01',
        p_entry_commit_id: 'commit_01',
        p_expires_at: new Date(renewedExpiry).toISOString(),
      },
    );
  });

  test('does not change reserved_free_bytes during renewal', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).not.toContain('credit_accounts');
    expect(sql).not.toMatch(/SET\s+reserved_free_bytes/i);
  });

  test('locks commits and reservations and limits RPC execution', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql.match(/FOR UPDATE/gi)).toHaveLength(2);
    expect(sql).toContain(
      "reservation.status IN ('reserved', 'ticketed')",
    );
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.renew_media_upload_reservations',
    );
    expect(sql).toContain('TO service_role');
  });
});

test('wires renewal to the current CloudBase environment', async () => {
  const {createMain} = loadRenewFunction();
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
  const main = createMain({cloudbase});

  await expect(main(validEvent, {})).rejects.toThrow('请先注册或登录');
  expect(cloudbase.init).toHaveBeenCalledWith({
    env: cloudbase.SYMBOL_CURRENT_ENV,
  });
  expect(app.rdb).not.toHaveBeenCalled();
});
