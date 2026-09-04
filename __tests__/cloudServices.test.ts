import {
  createCloudBaseConfig,
  createCosStorageConfig,
  developmentCloudBaseConfig,
  type CloudBaseConfig,
} from '../src/config/cloudServiceConfig';
import {createCloudBaseGateway} from '../src/services/cloudBaseGateway';
import {uploadEncryptedMedia} from '../src/services/cosObjectStorage';

const configuredCloud: CloudBaseConfig = {
  envId: 'du-test-123',
  region: 'ap-shanghai',
  databaseMode: 'postgresql',
};

test('rejects an incomplete cloud service configuration', () => {
  expect(() =>
    createCloudBaseConfig({
      envId: '',
      region: 'ap-shanghai',
      databaseMode: 'postgresql',
    }),
  ).toThrow('CloudBase 尚未配置');
});

test('normalizes a complete cloud service configuration', () => {
  expect(
    createCloudBaseConfig({
      envId: ' du-test-123 ',
      region: 'ap-shanghai',
      databaseMode: 'postgresql',
    }),
  ).toEqual(configuredCloud);
});

test('uses the declared CloudBase development environment', () => {
  expect(developmentCloudBaseConfig).toEqual({
    envId: 'du-1-d0gfhmkfe81e2d8e8',
    region: 'ap-shanghai',
    databaseMode: 'postgresql',
  });
});

test('keeps COS configuration separate from CloudBase', () => {
  expect(() => createCosStorageConfig({bucket: ''})).toThrow(
    'COS 尚未配置',
  );
  expect(
    createCosStorageConfig({
      bucket: ' du-media-test-1234567890 ',
    }),
  ).toEqual({bucket: 'du-media-test-1234567890'});
});

test('requests a short-lived COS upload ticket through CloudBase', async () => {
  const callFunction = jest.fn().mockResolvedValue({
    requestId: 'request-1',
    result: {
      objectKey: 'accounts/user-1/media/media-1.enc',
      uploadUrl: 'https://example.cos.ap-shanghai.myqcloud.com/signed',
      headers: {'x-cos-security-token': 'temporary-token'},
      expiresAt: 1_788_425_000_000,
    },
  });
  const initialize = jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    callFunction,
  }));
  const gateway = createCloudBaseGateway(configuredCloud, initialize);

  await expect(
    gateway.requestMediaUploadTicket({
      reservationId: 'reservation-1',
      mediaId: 'media-1',
      bytes: 2048,
      sha256: 'abc123',
      contentType: 'application/octet-stream',
    }),
  ).resolves.toMatchObject({
    objectKey: 'accounts/user-1/media/media-1.enc',
    uploadUrl: expect.stringMatching(/^https:\/\//),
  });
  expect(initialize).toHaveBeenCalledWith({
    env: 'du-test-123',
    region: 'ap-shanghai',
  });
  expect(callFunction).toHaveBeenCalledWith({
    name: 'media-create-upload-ticket',
    data: {
      reservationId: 'reservation-1',
      mediaId: 'media-1',
      bytes: 2048,
      sha256: 'abc123',
      contentType: 'application/octet-stream',
    },
  });
});

test('exposes the complete media reservation lifecycle', async () => {
  const callFunction = jest.fn(
    async <T>({name}: {name: string}): Promise<{
      requestId: string;
      result: T;
    }> => {
      let response: {requestId: string; result: unknown};
    if (name === 'media-reserve-upload') {
        response = {
        requestId: 'reserve-request',
        result: {
          entryCommitId: 'commit-1',
          status: 'reserved',
          reservedFreeBytes: 2048,
          expiresAt: 1_788_425_000_000,
          media: [
            {
              id: 'reservation-1',
              mediaId: 'media-1',
              mediaKind: 'photo',
              bytes: 2048,
              sha256: 'a'.repeat(64),
              status: 'reserved',
            },
          ],
        },
      };
      } else if (name === 'media-confirm-upload') {
        response = {
        requestId: 'confirm-request',
        result: {
          reservationId: 'reservation-1',
          status: 'verified',
          mediaObject: {
            id: 'media-1',
            objectKey: 'users/user-1/media/media-1.enc',
            sha256: 'a'.repeat(64),
            encryptedBytes: 2048,
            mediaKind: 'photo',
            uploadStatus: 'verified',
          },
        },
      };
      } else {
        response = {
          requestId: 'release-request',
          result: {
            entryCommitId: 'commit-1',
            status: 'released',
            releasedFreeBytes: 2048,
          },
        };
      }
      return response as {requestId: string; result: T};
    }
  );
  const gateway = createCloudBaseGateway(
    configuredCloud,
    () => ({
      callFunction: async <T>(request: {
        name: string;
        data?: Record<string, unknown>;
      }) =>
        (await callFunction(request)) as {
          requestId: string;
          result: T;
        },
    }),
  );
  const reservationInput = {
    entryCommitId: 'commit-1',
    entryType: 'memory' as const,
    localEntryId: 'memory-1',
    idempotencyKey: 'memory-1-revision-1',
    media: [
      {
        mediaId: 'media-1',
        mediaKind: 'photo' as const,
        encryptedBytes: 2048,
        sha256: 'a'.repeat(64),
      },
    ],
  };

  await expect(
    gateway.reserveMediaUpload(reservationInput),
  ).resolves.toMatchObject({
    entryCommitId: 'commit-1',
    status: 'reserved',
  });
  await expect(
    gateway.confirmMediaUpload({reservationId: 'reservation-1'}),
  ).resolves.toMatchObject({status: 'verified'});
  await expect(
    gateway.releaseMediaUpload({
      entryCommitId: 'commit-1',
      reason: 'cancelled',
    }),
  ).resolves.toBeUndefined();

  expect(callFunction).toHaveBeenNthCalledWith(1, {
    name: 'media-reserve-upload',
    data: reservationInput,
  });
  expect(callFunction).toHaveBeenNthCalledWith(2, {
    name: 'media-confirm-upload',
    data: {reservationId: 'reservation-1'},
  });
  expect(callFunction).toHaveBeenNthCalledWith(3, {
    name: 'media-release-upload',
    data: {entryCommitId: 'commit-1', reason: 'cancelled'},
  });
});

test('uploads only encrypted media through a signed HTTPS URL', async () => {
  const uploader = jest.fn().mockResolvedValue({statusCode: 200});

  await expect(
    uploadEncryptedMedia(
      {
        encryptedPath: 'file:///tmp/media-1.enc',
        ticket: {
          objectKey: 'accounts/user-1/media/media-1.enc',
          uploadUrl:
            'https://example.cos.ap-shanghai.myqcloud.com/signed',
          headers: {'x-cos-security-token': 'temporary-token'},
          expiresAt: 1_788_425_000_000,
        },
      },
      uploader,
    ),
  ).resolves.toEqual({
    objectKey: 'accounts/user-1/media/media-1.enc',
  });
  expect(uploader).toHaveBeenCalledWith({
    toUrl: 'https://example.cos.ap-shanghai.myqcloud.com/signed',
    files: [
      {
        name: 'file',
        filename: 'media-1.enc',
        filepath: '/tmp/media-1.enc',
        filetype: 'application/octet-stream',
      },
    ],
    method: 'PUT',
    headers: {'x-cos-security-token': 'temporary-token'},
    binaryStreamOnly: true,
  });
});

test('rejects an insecure COS upload URL', async () => {
  await expect(
    uploadEncryptedMedia({
      encryptedPath: '/tmp/media-1.enc',
      ticket: {
        objectKey: 'accounts/user-1/media/media-1.enc',
        uploadUrl: 'http://example.com/signed',
        headers: {},
        expiresAt: 1_788_425_000_000,
      },
    }),
  ).rejects.toThrow('COS 上传地址必须使用 HTTPS');
});
