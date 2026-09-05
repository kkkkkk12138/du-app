const {
  createAccountInitializeKeyHandler,
} = require('../functions/account-initialize-key/handler');
const {
  createRuntimeDependencies,
} = require('../functions/account-initialize-key/runtime');
const {createMain} = require('../functions/account-initialize-key');

const keyVerifier = 'a'.repeat(64);

function createDependencies(overrides = {}) {
  return {
    getUser: jest.fn().mockResolvedValue({
      uid: 'user_01',
      isAnonymous: false,
    }),
    claimEncryptionIdentity: jest.fn().mockResolvedValue({
      status: 'claimed',
      keyVersion: 1,
    }),
    ...overrides,
  };
}

describe('account-initialize-key', () => {
  test.each([
    [{uid: '', isAnonymous: false}],
    [{uid: 'anonymous_01', isAnonymous: true}],
  ])('rejects users without a registered account', async user => {
    const dependencies = createDependencies({
      getUser: jest.fn().mockResolvedValue(user),
    });
    const handler = createAccountInitializeKeyHandler(dependencies);

    await expect(handler({keyVerifier}, {})).rejects.toThrow(
      '请先注册或登录',
    );
    expect(dependencies.claimEncryptionIdentity).not.toHaveBeenCalled();
  });

  test.each([
    [undefined],
    ['A'.repeat(64)],
    ['a'.repeat(63)],
    ['g'.repeat(64)],
  ])('rejects invalid key verifier %p', async invalidVerifier => {
    const dependencies = createDependencies();
    const handler = createAccountInitializeKeyHandler(dependencies);

    await expect(
      handler({keyVerifier: invalidVerifier}, {}),
    ).rejects.toThrow('账号加密身份参数无效');
    expect(dependencies.claimEncryptionIdentity).not.toHaveBeenCalled();
  });

  test('claims the first encryption identity', async () => {
    const dependencies = createDependencies();
    const handler = createAccountInitializeKeyHandler(dependencies);

    await expect(handler({keyVerifier}, {})).resolves.toEqual({
      status: 'claimed',
      keyVersion: 1,
    });
    expect(dependencies.claimEncryptionIdentity).toHaveBeenCalledWith({
      accountId: 'user_01',
      keyVerifier,
    });
  });

  test('returns existing for the same account key', async () => {
    const dependencies = createDependencies({
      claimEncryptionIdentity: jest.fn().mockResolvedValue({
        status: 'existing',
        keyVersion: 1,
      }),
    });
    const handler = createAccountInitializeKeyHandler(dependencies);

    await expect(handler({keyVerifier}, {})).resolves.toEqual({
      status: 'existing',
      keyVersion: 1,
    });
  });

  test.each([
    'different_verifier',
    'existing_encrypted_records',
  ])('requires recovery for %s', async reason => {
    const dependencies = createDependencies({
      claimEncryptionIdentity: jest.fn().mockResolvedValue({
        status: 'recovery_required',
        keyVersion: 1,
        reason,
      }),
    });
    const handler = createAccountInitializeKeyHandler(dependencies);

    await expect(handler({keyVerifier}, {})).resolves.toEqual({
      status: 'recovery_required',
      keyVersion: 1,
    });
  });
});

describe('account-initialize-key runtime', () => {
  test('calls the atomic encryption identity claim function', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{status: 'claimed', key_version: 1}],
      error: null,
    });
    const getUserInfo = jest.fn();
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo}),
        rdb: () => ({rpc}),
      },
    });

    await expect(
      runtime.claimEncryptionIdentity({
        accountId: 'user_01',
        keyVerifier,
      }),
    ).resolves.toEqual({
      status: 'claimed',
      keyVersion: 1,
    });
    expect(rpc).toHaveBeenCalledWith(
      'claim_account_encryption_identity',
      {
        p_account_id: 'user_01',
        p_key_verifier: keyVerifier,
      },
    );
    await runtime.getUser();
    expect(getUserInfo).toHaveBeenCalledTimes(1);
  });

  test('rejects an invalid database claim result', async () => {
    const runtime = createRuntimeDependencies({
      app: {
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({
          rpc: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      },
    });

    await expect(
      runtime.claimEncryptionIdentity({
        accountId: 'user_01',
        keyVerifier,
      }),
    ).rejects.toThrow('无法初始化账号加密身份');
  });

  test('wires the CloudBase runtime into the exported entry point', async () => {
    const handler = jest.fn().mockResolvedValue({
      status: 'claimed',
      keyVersion: 1,
    });
    const cloudbase = {
      SYMBOL_CURRENT_ENV: Symbol('current-env'),
      init: jest.fn().mockReturnValue({
        auth: () => ({getUserInfo: jest.fn()}),
        rdb: () => ({rpc: jest.fn()}),
      }),
    };

    const main = createMain({cloudbase, createHandler: () => handler});
    await expect(main({keyVerifier}, {})).resolves.toEqual({
      status: 'claimed',
      keyVersion: 1,
    });
    expect(cloudbase.init).toHaveBeenCalledWith({
      env: cloudbase.SYMBOL_CURRENT_ENV,
    });
    expect(handler).toHaveBeenCalledWith({keyVerifier}, {});
  });
});
