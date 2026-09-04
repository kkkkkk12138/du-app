import type {AccountState} from '../account/useAccountStore';
import type {
  ConfirmedMediaUpload,
  MediaKind,
  MediaUploadReservationInput,
  MediaUploadTicket,
  createCloudBaseGateway,
} from '../../services/cloudBaseGateway';

export type EncryptedMediaUpload = {
  mediaId: string;
  mediaKind: MediaKind;
  encryptedPath: string;
  encryptedBytes: number;
  sha256: string;
};

export type PrepareReservedUploadInput = Omit<
  MediaUploadReservationInput,
  'media'
> & {
  media: EncryptedMediaUpload[];
};

type MediaUploadGateway = Pick<
  ReturnType<typeof createCloudBaseGateway>,
  | 'reserveMediaUpload'
  | 'requestMediaUploadTicket'
  | 'confirmMediaUpload'
  | 'releaseMediaUpload'
>;

export type PrepareReservedUploadDependencies = {
  gateway: MediaUploadGateway;
  uploadEncryptedMedia: (input: {
    encryptedPath: string;
    ticket: MediaUploadTicket;
  }) => Promise<{objectKey: string}>;
  getAccountState: () => AccountState;
};

const SHA256 = /^[a-f0-9]{64}$/;

function assertUnlockedAccount(account: AccountState) {
  if (account.status === 'signed_in_locked') {
    throw new Error('请先解锁本机加密密钥');
  }
  if (account.status !== 'signed_in_unlocked') {
    throw new Error('请先注册或登录');
  }
}

function assertEncryptedMedia(media: EncryptedMediaUpload[]) {
  if (
    media.length === 0 ||
    media.some(
      item =>
        !item.mediaId ||
        !item.encryptedPath ||
        !Number.isSafeInteger(item.encryptedBytes) ||
        item.encryptedBytes <= 0 ||
        !SHA256.test(item.sha256.toLowerCase()),
    )
  ) {
    throw new Error('加密媒体参数无效');
  }
}

async function confirmWithRetry(
  gateway: MediaUploadGateway,
  reservationId: string,
) {
  try {
    return await gateway.confirmMediaUpload({reservationId});
  } catch {
    return gateway.confirmMediaUpload({reservationId});
  }
}

export async function prepareReservedUpload(
  input: PrepareReservedUploadInput,
  dependencies: PrepareReservedUploadDependencies,
) {
  assertUnlockedAccount(dependencies.getAccountState());
  assertEncryptedMedia(input.media);

  let hasReservation = false;
  let confirmationStarted = false;
  try {
    const reservation = await dependencies.gateway.reserveMediaUpload({
      entryCommitId: input.entryCommitId,
      entryType: input.entryType,
      localEntryId: input.localEntryId,
      idempotencyKey: input.idempotencyKey,
      media: input.media.map(item => ({
        mediaId: item.mediaId,
        mediaKind: item.mediaKind,
        encryptedBytes: item.encryptedBytes,
        sha256: item.sha256.toLowerCase(),
      })),
    });
    hasReservation = true;

    if (
      reservation.entryCommitId !== input.entryCommitId ||
      reservation.media.length !== input.media.length
    ) {
      throw new Error('服务端媒体预留与本地密文不一致');
    }

    const matchedMedia = reservation.media.map(reserved => {
      const local = input.media.find(
        item => item.mediaId === reserved.mediaId,
      );
      if (
        !local ||
        local.mediaKind !== reserved.mediaKind ||
        local.encryptedBytes !== reserved.bytes ||
        local.sha256.toLowerCase() !== reserved.sha256.toLowerCase()
      ) {
        throw new Error('服务端媒体预留与本地密文不一致');
      }
      return {local, reserved};
    });

    for (const {local, reserved} of matchedMedia) {
      if (reserved.status !== 'verified') {
        if (!['reserved', 'ticketed'].includes(reserved.status)) {
          throw new Error('媒体上传预留状态无效');
        }
        const ticket =
          await dependencies.gateway.requestMediaUploadTicket({
            reservationId: reserved.id,
            mediaId: reserved.mediaId,
            bytes: reserved.bytes,
            sha256: reserved.sha256,
            contentType: 'application/octet-stream',
          });
        await dependencies.uploadEncryptedMedia({
          encryptedPath: local.encryptedPath,
          ticket,
        });
      }
    }

    confirmationStarted = true;
    const confirmedMedia: ConfirmedMediaUpload[] = [];
    for (const {reserved} of matchedMedia) {
      confirmedMedia.push(
        await confirmWithRetry(dependencies.gateway, reserved.id),
      );
    }

    return {
      entryCommitId: reservation.entryCommitId,
      status: 'verified' as const,
      media: confirmedMedia,
    };
  } catch (error) {
    if (hasReservation && !confirmationStarted) {
      await dependencies.gateway
        .releaseMediaUpload({
          entryCommitId: input.entryCommitId,
          reason: 'cancelled',
        })
        .catch(() => undefined);
    }
    throw error;
  }
}
