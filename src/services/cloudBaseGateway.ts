import cloudbase from '@cloudbase/js-sdk';

import type {CloudBaseConfig} from '../config/cloudServiceConfig';

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

const initializeCloudBase: CloudBaseInitializer = input =>
  cloudbase.init(input) as unknown as CloudBaseRuntime;

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

export function createCloudBaseGateway(
  config: CloudBaseConfig,
  initialize: CloudBaseInitializer = initializeCloudBase,
) {
  const app = initialize({
    env: config.envId,
    region: config.region,
  });

  return {
    async requestMediaUploadTicket(
      input: MediaUploadTicketInput,
    ): Promise<MediaUploadTicket> {
      const response = await app.callFunction<MediaUploadTicket>({
        name: 'media-create-upload-ticket',
        data: input,
      });
      return assertUploadTicket(response.result);
    },
  };
}
