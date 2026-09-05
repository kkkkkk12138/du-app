export const UPLOAD_JOB_STATES = [
  'blocked_key',
  'pending_encrypt',
  'ready',
  'uploading',
  'confirming',
  'finalizing',
  'retry_wait',
  'confirmed',
  'cancelled',
  'failed_permanent',
] as const;

export type UploadJobState = (typeof UPLOAD_JOB_STATES)[number];

export const UPLOAD_ITEM_STATES = [
  'pending_encrypt',
  'encrypted',
  'put_completed',
  'verified',
] as const;

export type UploadItemState = (typeof UPLOAD_ITEM_STATES)[number];
