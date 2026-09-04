import RNFS from 'react-native-fs';

import type {MediaUploadTicket} from './cloudBaseGateway';

type UploadOptions = {
  toUrl: string;
  files: Array<{
    name: string;
    filename: string;
    filepath: string;
    filetype: string;
  }>;
  method: 'PUT';
  headers: Record<string, string>;
  binaryStreamOnly: true;
};

type UploadResult = {
  statusCode: number;
};

type NativeUploader = (
  options: UploadOptions,
) => Promise<UploadResult>;

function normalizeFilePath(path: string) {
  return path.replace(/^file:\/\//, '');
}

function filenameFromPath(path: string) {
  return normalizeFilePath(path).split('/').pop() ?? 'media.enc';
}

const nativeUploader: NativeUploader = options =>
  RNFS.uploadFiles(options).promise;

export async function uploadEncryptedMedia(
  {
    encryptedPath,
    ticket,
  }: {
    encryptedPath: string;
    ticket: MediaUploadTicket;
  },
  upload: NativeUploader = nativeUploader,
) {
  if (!ticket.uploadUrl.startsWith('https://')) {
    throw new Error('COS 上传地址必须使用 HTTPS');
  }

  const filepath = normalizeFilePath(encryptedPath);
  const result = await upload({
    toUrl: ticket.uploadUrl,
    files: [
      {
        name: 'file',
        filename: filenameFromPath(filepath),
        filepath,
        filetype: 'application/octet-stream',
      },
    ],
    method: 'PUT',
    headers: ticket.headers,
    binaryStreamOnly: true,
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error('加密媒体上传失败');
  }
  return {objectKey: ticket.objectKey};
}
