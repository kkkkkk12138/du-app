const {
  createMediaReleaseUploadHandler,
} = require('../functions/media-release-upload/handler');
const {
  createRuntimeDependencies,
} = require('../functions/media-release-upload/runtime');
const {createMain} = require('../functions/media-release-upload');

const cancelEvent = {
  entryCommitId: 'commit_01',
  reason: 'cancelled',
};
const activeCommit = {
  id: 'commit_01',
  accountId: 'user_01',
  status: 'reserved',
  expiresAt: 1_800_000,
  hasVerifiedMedia: false,
};
const releasedResult = {
  entryCommitId: 'commit_01',
  status: 'released',
  releasedFreeBytes: 6144,
};

function createDependencies(overrides = {}) {
  return {
    getUser: jest.fn().mockResolvedValue({
      uid: 'user_01',
      isAnonymous: false,
    }),
    findCommit: jest.fn().mockResolvedValue(activeCommit),
    releaseReservation: jest.fn().mockResolvedValue(releasedResult),
    now: () => 1_200_000,
    ...overrides,
  };
}

describe('media-release-upload', () => {
  test.each([
    [{uid: '', isAnonymous: false}],
    [{uid: 'anonymous_01', isAnonymous: true}],
  ])('rejects users without a registered account', async user => {
    const dependencies = createDependencies({
      getUser: jest.fn().mockResolvedValue(user),
    });
    const handler = createMediaReleaseUploadHandler(dependencies);

    await expect(handler(cancelEvent, {})).rejects.toThrow(
      '请先注册或登录',
    );
    expect(dependencies.findCommit).not.toHaveBeenCalled();
  });

  test.each([
    [{...cancelEvent, entryCommitId: '../commit'}],
    [{...cancelEvent, reason: 'unknown'}],
  ])('rejects invalid release input', async event => {
    const dependencies = createDependencies();
    const handler = createMediaReleaseUploadHandler(dependencies);

    await expect(handler(event, {})).rejects.toThrow(
      '媒体释放参数无效',
    );
    expect(dependencies.findCommit).not.toHaveBeenCalled();
  });

  test('releases an active reservation after explicit cancellation', async () => {
    const dependencies = createDependencies();
    const handler = createMediaReleaseUploadHandler(dependencies);

    await expect(handler(cancelEvent, {})).resolves.toEqual(releasedResult);
    expect(dependencies.releaseReservation).toHaveBeenCalledWith({
      accountId: 'user_01',
      entryCommitId: 'commit_01',
      requireExpired: false,
    });
  });

  test('releases a reservation only after its server expiry time', async () => {
    const dependencies = createDependencies({
      findCommit: jest.fn().mockResolvedValue({
        ...activeCommit,
        expiresAt: 1_100_000,
      }),
    });
    const handler = createMediaReleaseUploadHandler(dependencies);

    await expect(
      handler({...cancelEvent, reason: 'expired'}, {}),
    ).resolves.toEqual(releasedResult);
    expect(dependencies.releaseReservation).toHaveBeenCalledWith({
      accountId: 'user_01',
      entryCommitId: 'commit_01',
      requireExpired: true,
    });
  });

  test('rejects an expiry release before the server expiry time', async () => {
    const dependencies = createDependencies();
    const handler = createMediaReleaseUploadHandler(dependencies);

    await expect(
      handler({...cancelEvent, reason: 'expired'}, {}),
    ).rejects.toThrow('媒体上传预留尚未过期');
    expect(dependencies.releaseReservation).not.toHaveBeenCalled();
  });

  test('returns an already released commit idempotently', async () => {
    const dependencies = createDependencies({
      findCommit: jest.fn().mockResolvedValue({
        ...activeCommit,
        status: 'released',
      }),
    });
    const handler = createMediaReleaseUploadHandler(dependencies);

    await expect(handler(cancelEvent, {})).resolves.toEqual({
      entryCommitId: 'commit_01',
      status: 'released',
      releasedFreeBytes: 0,
    });
    expect(dependencies.releaseReservation).not.toHaveBeenCalled();
  });

  test('rejects another account or an already verified upload', async () => {
    const missingDependencies = createDependencies({
      findCommit: jest.fn().mockResolvedValue(undefined),
    });
    await expect(
      createMediaReleaseUploadHandler(missingDependencies)(cancelEvent, {}),
    ).rejects.toThrow('媒体上传预留不可释放');

    const verifiedDependencies = createDependencies({
      findCommit: jest.fn().mockResolvedValue({
        ...activeCommit,
        hasVerifiedMedia: true,
      }),
    });
    await expect(
      createMediaReleaseUploadHandler(verifiedDependencies)(
        cancelEvent,
        {},
      ),
    ).rejects.toThrow('已确认的媒体不能释放');
    expect(verifiedDependencies.releaseReservation).not.toHaveBeenCalled();
  });
});

describe('media-release-upload runtime', () => {
  test('calls the atomic release database function', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          entry_commit_id: 'commit_01',
          status: 'released',
          released_free_bytes: 6144,
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
      runtime.releaseReservation({
        accountId: 'user_01',
        entryCommitId: 'commit_01',
        requireExpired: true,
      }),
    ).resolves.toEqual(releasedResult);
    expect(rpc).toHaveBeenCalledWith('release_media_reservation', {
      p_account_id: 'user_01',
      p_entry_commit_id: 'commit_01',
      p_require_expired: true,
    });
  });
});

test('wires the release function to the current CloudBase environment', async () => {
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

  await expect(main(cancelEvent, {})).rejects.toThrow('请先注册或登录');
  expect(cloudbase.init).toHaveBeenCalledWith({
    env: cloudbase.SYMBOL_CURRENT_ENV,
  });
  expect(app.rdb).not.toHaveBeenCalled();
});
