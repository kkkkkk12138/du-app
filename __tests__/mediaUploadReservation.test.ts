import {
  prepareReservedUpload,
  type PrepareReservedUploadDependencies,
  type PrepareReservedUploadInput,
} from '../src/features/billing/mediaUploadReservation';
import type {AccountState} from '../src/features/account/useAccountStore';

const sha256 = 'a'.repeat(64);
const input: PrepareReservedUploadInput = {
  entryCommitId: 'commit-1',
  entryType: 'memory',
  localEntryId: 'memory-1',
  idempotencyKey: 'memory-1-revision-1',
  media: [
    {
      mediaId: 'media-1',
      mediaKind: 'photo',
      encryptedPath: 'file:///tmp/media-1.enc',
      encryptedBytes: 2048,
      sha256,
    },
  ],
};
const reservation = {
  entryCommitId: 'commit-1',
  status: 'reserved' as const,
  reservedFreeBytes: 2048,
  expiresAt: 1_900_000,
  media: [
    {
      id: 'reservation-1',
      mediaId: 'media-1',
      mediaKind: 'photo' as const,
      bytes: 2048,
      sha256,
      status: 'reserved' as const,
    },
  ],
};
const ticket = {
  objectKey: 'users/user-1/media/media-1.enc',
  uploadUrl: 'https://example.com/signed',
  headers: {
    'Content-Type': 'application/octet-stream',
    'x-cos-meta-sha256': sha256,
  },
  expiresAt: 1_800_000,
};
const confirmed = {
  reservationId: 'reservation-1',
  status: 'verified' as const,
  mediaObject: {
    id: 'media-1',
    objectKey: ticket.objectKey,
    sha256,
    encryptedBytes: 2048,
    mediaKind: 'photo' as const,
    uploadStatus: 'verified' as const,
  },
};

function createDependencies(
  overrides: Partial<PrepareReservedUploadDependencies> = {},
): PrepareReservedUploadDependencies {
  return {
    gateway: {
      reserveMediaUpload: jest.fn().mockResolvedValue(reservation),
      requestMediaUploadTicket: jest.fn().mockResolvedValue(ticket),
      confirmMediaUpload: jest.fn().mockResolvedValue(confirmed),
      releaseMediaUpload: jest.fn().mockResolvedValue(undefined),
    },
    uploadEncryptedMedia: jest
      .fn()
      .mockResolvedValue({objectKey: ticket.objectKey}),
    getAccountState: () => ({
      status: 'signed_in_unlocked',
      session: {
        uid: 'user-1',
        providers: ['email'],
      },
    }),
    ...overrides,
  };
}

test.each<{state: AccountState; message: string}>([
  {
    state: {status: 'signed_out'},
    message: '请先注册或登录',
  },
  {
    state: {
      status: 'signed_in_locked',
      session: {uid: 'user-1', providers: ['email']},
    },
    message: '请先解锁本机加密密钥',
  },
])('blocks uploads while account is $state.status', async ({state, message}) => {
  const dependencies = createDependencies({
    getAccountState: () => state,
  });

  await expect(
    prepareReservedUpload(input, dependencies),
  ).rejects.toThrow(message);
  expect(dependencies.gateway.reserveMediaUpload).not.toHaveBeenCalled();
});

test('uploads only the encrypted file through the full lifecycle', async () => {
  const dependencies = createDependencies();

  await expect(
    prepareReservedUpload(input, dependencies),
  ).resolves.toEqual({
    entryCommitId: 'commit-1',
    status: 'verified',
    media: [confirmed],
  });
  expect(dependencies.gateway.reserveMediaUpload).toHaveBeenCalledWith({
    entryCommitId: 'commit-1',
    entryType: 'memory',
    localEntryId: 'memory-1',
    idempotencyKey: 'memory-1-revision-1',
    media: [
      {
        mediaId: 'media-1',
        mediaKind: 'photo',
        encryptedBytes: 2048,
        sha256,
      },
    ],
  });
  expect(
    dependencies.gateway.requestMediaUploadTicket,
  ).toHaveBeenCalledWith({
    reservationId: 'reservation-1',
    mediaId: 'media-1',
    bytes: 2048,
    sha256,
    contentType: 'application/octet-stream',
  });
  expect(dependencies.uploadEncryptedMedia).toHaveBeenCalledWith({
    encryptedPath: 'file:///tmp/media-1.enc',
    ticket,
  });
  expect(dependencies.gateway.confirmMediaUpload).toHaveBeenCalledWith({
    reservationId: 'reservation-1',
  });
  expect(dependencies.gateway.releaseMediaUpload).not.toHaveBeenCalled();
});

test('resumes an already verified reservation without another PUT', async () => {
  const dependencies = createDependencies({
    gateway: {
      reserveMediaUpload: jest.fn().mockResolvedValue({
        ...reservation,
        status: 'reserved',
        media: [{...reservation.media[0], status: 'verified'}],
      }),
      requestMediaUploadTicket: jest.fn(),
      confirmMediaUpload: jest.fn().mockResolvedValue(confirmed),
      releaseMediaUpload: jest.fn(),
    },
  });

  await expect(
    prepareReservedUpload(input, dependencies),
  ).resolves.toMatchObject({status: 'verified'});
  expect(
    dependencies.gateway.requestMediaUploadTicket,
  ).not.toHaveBeenCalled();
  expect(dependencies.uploadEncryptedMedia).not.toHaveBeenCalled();
  expect(dependencies.gateway.confirmMediaUpload).toHaveBeenCalledWith({
    reservationId: 'reservation-1',
  });
});

test('retries an uncertain confirmation before releasing quota', async () => {
  const confirmMediaUpload = jest
    .fn()
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce(confirmed);
  const dependencies = createDependencies({
    gateway: {
      reserveMediaUpload: jest.fn().mockResolvedValue(reservation),
      requestMediaUploadTicket: jest.fn().mockResolvedValue(ticket),
      confirmMediaUpload,
      releaseMediaUpload: jest.fn(),
    },
  });

  await expect(
    prepareReservedUpload(input, dependencies),
  ).resolves.toMatchObject({status: 'verified'});
  expect(confirmMediaUpload).toHaveBeenCalledTimes(2);
  expect(dependencies.gateway.releaseMediaUpload).not.toHaveBeenCalled();
});

test('keeps reservation state when confirmation remains uncertain', async () => {
  const confirmError = new Error('confirmation response lost');
  const dependencies = createDependencies({
    gateway: {
      reserveMediaUpload: jest.fn().mockResolvedValue(reservation),
      requestMediaUploadTicket: jest.fn().mockResolvedValue(ticket),
      confirmMediaUpload: jest.fn().mockRejectedValue(confirmError),
      releaseMediaUpload: jest.fn(),
    },
  });

  await expect(
    prepareReservedUpload(input, dependencies),
  ).rejects.toBe(confirmError);
  expect(dependencies.gateway.confirmMediaUpload).toHaveBeenCalledTimes(2);
  expect(dependencies.gateway.releaseMediaUpload).not.toHaveBeenCalled();
});

test('releases the commit after a ticket or upload failure', async () => {
  const uploadError = new Error('upload failed');
  const dependencies = createDependencies({
    uploadEncryptedMedia: jest.fn().mockRejectedValue(uploadError),
  });

  await expect(
    prepareReservedUpload(input, dependencies),
  ).rejects.toBe(uploadError);
  expect(dependencies.gateway.releaseMediaUpload).toHaveBeenCalledWith({
    entryCommitId: 'commit-1',
    reason: 'cancelled',
  });
  expect(dependencies.gateway.confirmMediaUpload).not.toHaveBeenCalled();
});

test('rejects altered reservation metadata and releases quota', async () => {
  const dependencies = createDependencies({
    gateway: {
      reserveMediaUpload: jest.fn().mockResolvedValue({
        ...reservation,
        media: [{...reservation.media[0], bytes: 1024}],
      }),
      requestMediaUploadTicket: jest.fn(),
      confirmMediaUpload: jest.fn(),
      releaseMediaUpload: jest.fn().mockResolvedValue(undefined),
    },
  });

  await expect(
    prepareReservedUpload(input, dependencies),
  ).rejects.toThrow('服务端媒体预留与本地密文不一致');
  expect(dependencies.gateway.releaseMediaUpload).toHaveBeenCalledWith({
    entryCommitId: 'commit-1',
    reason: 'cancelled',
  });
});
