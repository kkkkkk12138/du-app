import type {CloudBaseConfig} from '../config/cloudServiceConfig';
import {getCloudBaseApp} from './cloudBaseApp';

type CloudBaseRuntime = {
  callFunction: <T>(input: {
    name: string;
    data?: Record<string, unknown>;
  }) => Promise<{requestId: string; result: T}>;
};

type CloudBaseInitializer = (input: {
  env: string;
  region: CloudBaseConfig['region'];
}) => CloudBaseRuntime;

export type MediaUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: number;
};

export type MediaUploadTicketInput = {
  reservationId: string;
  mediaId: string;
  bytes: number;
  sha256: string;
  contentType: string;
};

export type MediaKind = 'photo' | 'audio' | 'ink' | 'avatar' | 'cover';

export type MediaUploadReservationInput = {
  entryCommitId: string;
  entryType: 'memory' | 'future_letter';
  localEntryId: string;
  idempotencyKey: string;
  media: Array<{
    mediaId: string;
    mediaKind: MediaKind;
    encryptedBytes: number;
    sha256: string;
  }>;
};

export type ReservedMediaUpload = {
  id: string;
  mediaId: string;
  mediaKind: MediaKind;
  bytes: number;
  sha256: string;
  status:
    | 'reserved'
    | 'ticketed'
    | 'uploaded'
    | 'verified'
    | 'released'
    | 'expired';
};

export type MediaUploadReservation = {
  entryCommitId: string;
  status: string;
  reservedFreeBytes: number;
  expiresAt: number;
  media: ReservedMediaUpload[];
};

export type ConfirmedMediaUpload = {
  reservationId: string;
  status: 'verified';
  mediaObject: {
    id: string;
    objectKey: string;
    sha256: string;
    encryptedBytes: number;
    mediaKind: MediaKind;
    uploadStatus: 'verified';
  };
};

export type ReleaseMediaUploadInput = {
  entryCommitId: string;
  reason: 'cancelled' | 'expired';
};

export type AccountKeyInitialization = {
  status: 'claimed' | 'existing' | 'recovery_required';
  keyVersion: 1;
};

const initializeCloudBase: CloudBaseInitializer = input =>
  getCloudBaseApp<CloudBaseRuntime>({
    envId: input.env,
    region: input.region,
  });

function assertUploadTicket(
  ticket: MediaUploadTicket,
): MediaUploadTicket {
  if (
    !ticket?.objectKey ||
    !ticket.uploadUrl ||
    !Number.isFinite(ticket.expiresAt)
  ) {
    throw new Error('CloudBase 返回的媒体上传凭证无效');
  }
  return ticket;
}

function assertUploadReservation(
  reservation: MediaUploadReservation,
) {
  if (
    !reservation?.entryCommitId ||
    !Array.isArray(reservation.media) ||
    !Number.isFinite(reservation.expiresAt)
  ) {
    throw new Error('CloudBase 返回的媒体预留无效');
  }
  return reservation;
}

function assertConfirmedUpload(upload: ConfirmedMediaUpload) {
  if (
    upload?.status !== 'verified' ||
    !upload.reservationId ||
    !upload.mediaObject?.objectKey ||
    upload.mediaObject.uploadStatus !== 'verified'
  ) {
    throw new Error('CloudBase 返回的媒体确认结果无效');
  }
  return upload;
}

function assertAccountKeyInitialization(
  result: AccountKeyInitialization,
) {
  if (
    !['claimed', 'existing', 'recovery_required'].includes(
      result?.status,
    ) ||
    result.keyVersion !== 1
  ) {
    throw new Error('CloudBase 返回的账号加密身份无效');
  }
  return result;
}

export function createCloudBaseGateway(
  config: CloudBaseConfig,
  initialize: CloudBaseInitializer = initializeCloudBase,
) {
  const app = initialize({
    env: config.envId,
    region: config.region,
  });

  return {
    async initializeAccountKey(input: {
      keyVerifier: string;
    }): Promise<AccountKeyInitialization> {
      const response =
        await app.callFunction<AccountKeyInitialization>({
          name: 'account-initialize-key',
          data: input,
        });
      return assertAccountKeyInitialization(response.result);
    },

    async reserveMediaUpload(
      input: MediaUploadReservationInput,
    ): Promise<MediaUploadReservation> {
      const response = await app.callFunction<MediaUploadReservation>({
        name: 'media-reserve-upload',
        data: input,
      });
      return assertUploadReservation(response.result);
    },

    async requestMediaUploadTicket(
      input: MediaUploadTicketInput,
    ): Promise<MediaUploadTicket> {
      const response = await app.callFunction<MediaUploadTicket>({
        name: 'media-create-upload-ticket',
        data: input,
      });
      return assertUploadTicket(response.result);
    },

    async confirmMediaUpload(input: {
      reservationId: string;
    }): Promise<ConfirmedMediaUpload> {
      const response = await app.callFunction<ConfirmedMediaUpload>({
        name: 'media-confirm-upload',
        data: input,
      });
      return assertConfirmedUpload(response.result);
    },

    async releaseMediaUpload(
      input: ReleaseMediaUploadInput,
    ): Promise<void> {
      await app.callFunction({
        name: 'media-release-upload',
        data: input,
      });
    },
  };
}
