import {Database, Q} from '@nozbe/watermelondb';

import {database as defaultDatabase} from '../../db/database';
import {
  MediaUploadItem,
  MediaUploadJob,
} from '../../db/models';
import {retryDelayMs} from './uploadRetryPolicy';
import type {UploadJobState} from './uploadOutboxTypes';

const leaseDurationMs = 5 * 60_000;
const stableErrorCode = /^[A-Z][A-Z0-9_]{0,63}$/;

const runnableStates: UploadJobState[] = [
  'pending_encrypt',
  'ready',
  'uploading',
  'confirming',
  'finalizing',
  'retry_wait',
];

const checkpointManagedStates: UploadJobState[] = [
  'ready',
  'uploading',
  'confirming',
  'finalizing',
];

export const allowedTransitions: Record<
  UploadJobState,
  UploadJobState[]
> = {
  blocked_key: ['pending_encrypt', 'cancelled'],
  pending_encrypt: [
    'ready',
    'retry_wait',
    'cancelled',
    'failed_permanent',
  ],
  ready: ['uploading', 'retry_wait', 'cancelled', 'failed_permanent'],
  uploading: ['confirming', 'retry_wait', 'cancelled'],
  confirming: ['finalizing', 'retry_wait'],
  finalizing: ['confirmed', 'retry_wait'],
  retry_wait: [
    'blocked_key',
    'pending_encrypt',
    'ready',
    'uploading',
    'confirming',
    'finalizing',
    'cancelled',
    'failed_permanent',
  ],
  confirmed: [],
  cancelled: [],
  failed_permanent: [],
};

export type CreateUploadJobInput = {
  entryCommitId: string;
  entryType: 'memory' | 'future_letter';
  localEntryId: string;
  letterId?: string;
  accountUid: string;
  state: 'blocked_key' | 'pending_encrypt';
  items: Array<{
    mediaId: string;
    mediaKind: 'photo' | 'audio' | 'ink';
    sourcePath: string;
    plaintextBytes: number;
  }>;
};

export type PendingUploadOutboxInput = Pick<
  CreateUploadJobInput,
  'entryCommitId' | 'accountUid' | 'state'
> & {
  items: Array<
    Omit<CreateUploadJobInput['items'][number], 'sourcePath'>
  >;
};

type RepositoryOptions = {
  database?: Pick<Database, 'get' | 'write'>;
  now?: () => number;
  ownerId?: string;
  random?: () => number;
  leaseMs?: number;
};

function processOwnerId() {
  return `upload-worker-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function timestamp(value: Date | number | undefined) {
  if (value === undefined) {
    return undefined;
  }
  return value instanceof Date ? value.getTime() : value;
}

function assertTransition(
  from: UploadJobState,
  to: UploadJobState,
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`非法上传任务状态转换：${from} → ${to}`);
  }
}

function assertCreateInput(input: CreateUploadJobInput) {
  if (
    !input.entryCommitId ||
    !input.localEntryId ||
    !input.accountUid ||
    input.items.length === 0
  ) {
    throw new Error('上传任务数据无效');
  }
  if (
    input.entryType === 'future_letter' &&
    !input.letterId
  ) {
    throw new Error('未来信上传任务缺少 letterId');
  }
  const mediaIds = new Set(input.items.map(item => item.mediaId));
  if (
    mediaIds.size !== input.items.length ||
    input.items.some(
      item =>
        !item.mediaId ||
        !item.sourcePath ||
        !Number.isFinite(item.plaintextBytes) ||
        item.plaintextBytes < 0,
    )
  ) {
    throw new Error('上传媒体数据无效');
  }
}

export function createUploadOutboxRepository({
  database = defaultDatabase,
  now = Date.now,
  ownerId = processOwnerId(),
  random = Math.random,
  leaseMs = leaseDurationMs,
}: RepositoryOptions = {}) {
  const jobs = () =>
    database.get<MediaUploadJob>('media_upload_jobs');
  const items = () =>
    database.get<MediaUploadItem>('media_upload_items');

  const findItems = async (jobId: string) => {
    const records = await items()
      .query(Q.where('job_id', jobId))
      .fetch();
    return records.filter(item => item.jobId === jobId);
  };

  const findItem = async (jobId: string, mediaId: string) => {
    const item = (await findItems(jobId)).find(
      record => record.mediaId === mediaId,
    );
    if (!item) {
      throw new Error('上传媒体不存在');
    }
    return item;
  };

  const transitionInWriter = async (
    job: MediaUploadJob,
    to: UploadJobState,
    at: Date,
  ) => {
    assertTransition(job.state, to);
    await job.update(record => {
      record.state = to;
      record.updatedAt = at;
      if (to !== 'retry_wait') {
        record.nextAttemptAt = undefined;
        record.lastErrorCode = undefined;
      }
      if (
        to === 'confirmed' ||
        to === 'cancelled' ||
        to === 'failed_permanent'
      ) {
        record.leaseOwner = undefined;
        record.leaseExpiresAt = undefined;
      }
      if (to === 'confirmed') {
        record.confirmedAt = at;
      }
    });
  };

  const createJobInCurrentWriter = async (
    input: CreateUploadJobInput,
  ) => {
    assertCreateInput(input);
    const existing = (
      await jobs()
        .query(
          Q.where('entry_commit_id', input.entryCommitId),
          Q.take(1),
        )
        .fetch()
    ).find(job => job.entryCommitId === input.entryCommitId);
    if (existing) {
      return {
        job: existing,
        items: await findItems(existing.id),
        created: false,
      };
    }

    const createdAt = new Date(now());
    const job = await jobs().create(record => {
      record.entryCommitId = input.entryCommitId;
      record.entryType = input.entryType;
      record.localEntryId = input.localEntryId;
      record.letterId = input.letterId;
      record.accountUid = input.accountUid;
      record.state = input.state;
      record.attemptCount = 0;
      record.createdAt = createdAt;
      record.updatedAt = createdAt;
    });
    const createdItems: MediaUploadItem[] = [];
    for (const inputItem of input.items) {
      const item = await items().create(record => {
        record.jobId = job.id;
        record.mediaId = inputItem.mediaId;
        record.mediaKind = inputItem.mediaKind;
        record.sourcePath = inputItem.sourcePath;
        record.plaintextBytes = inputItem.plaintextBytes;
        record.state = 'pending_encrypt';
        record.createdAt = createdAt;
        record.updatedAt = createdAt;
      });
      createdItems.push(item);
    }
    return {job, items: createdItems, created: true};
  };

  return {
    createJobInCurrentWriter,

    createJob(input: CreateUploadJobInput) {
      return database.write(() => createJobInCurrentWriter(input));
    },

    claimNextDueJob(accountUid: string) {
      return database.write(async () => {
        const currentTime = now();
        const candidates = await jobs()
          .query(
            Q.where('account_uid', accountUid),
            Q.where('state', Q.oneOf(runnableStates)),
            Q.or(
              Q.where('next_attempt_at', Q.eq(null)),
              Q.where('next_attempt_at', Q.lte(currentTime)),
            ),
            Q.or(
              Q.where('lease_expires_at', Q.eq(null)),
              Q.where('lease_expires_at', Q.lte(currentTime)),
            ),
            Q.sortBy('created_at', Q.asc),
          )
          .fetch();
        const job =
          candidates
            .filter(
              candidate =>
                candidate.accountUid === accountUid &&
                runnableStates.includes(candidate.state) &&
                (timestamp(candidate.nextAttemptAt) ?? currentTime) <=
                  currentTime &&
                (timestamp(candidate.leaseExpiresAt) ?? currentTime) <=
                  currentTime,
            )
            .sort(
              (left, right) =>
                left.createdAt.getTime() - right.createdAt.getTime(),
            )[0] ?? null;
        if (!job) {
          return null;
        }
        await job.update(record => {
          record.leaseOwner = ownerId;
          record.leaseExpiresAt = new Date(currentTime + leaseMs);
          record.updatedAt = new Date(currentTime);
        });
        return job;
      });
    },

    transitionJob(jobId: string, to: UploadJobState) {
      return database.write(async () => {
        if (checkpointManagedStates.includes(to)) {
          throw new Error('上传任务检查点不完整');
        }
        const job = await jobs().find(jobId);
        await transitionInWriter(job, to, new Date(now()));
        return job;
      });
    },

    checkpointEncryptedItem(
      jobId: string,
      mediaId: string,
      checkpoint: {
        encryptedPath: string;
        encryptedBytes: number;
        sha256: string;
      },
    ) {
      return database.write(async () => {
        if (
          !checkpoint.encryptedPath ||
          !Number.isFinite(checkpoint.encryptedBytes) ||
          checkpoint.encryptedBytes <= 0 ||
          !/^[a-f0-9]{64}$/.test(checkpoint.sha256)
        ) {
          throw new Error('加密媒体检查点无效');
        }
        const at = new Date(now());
        const job = await jobs().find(jobId);
        const item = await findItem(jobId, mediaId);
        if (item.state !== 'pending_encrypt' && item.state !== 'encrypted') {
          throw new Error('上传媒体状态不允许写入加密检查点');
        }
        await item.update(record => {
          record.encryptedPath = checkpoint.encryptedPath;
          record.encryptedBytes = checkpoint.encryptedBytes;
          record.sha256 = checkpoint.sha256;
          record.state = 'encrypted';
          record.updatedAt = at;
        });
        const jobItems = await findItems(jobId);
        if (
          jobItems.every(record =>
            ['encrypted', 'put_completed', 'verified'].includes(
              record.state,
            ),
          ) &&
          (job.state === 'pending_encrypt' ||
            job.state === 'retry_wait')
        ) {
          await transitionInWriter(job, 'ready', at);
        }
        return item;
      });
    },

    persistReservations(
      jobId: string,
      reservation: {
        expiresAt: Date;
        items: Array<{mediaId: string; reservationId: string}>;
      },
    ) {
      return database.write(async () => {
        const at = new Date(now());
        const job = await jobs().find(jobId);
        assertTransition(job.state, 'uploading');
        const jobItems = await findItems(jobId);
        const reservationByMediaId = new Map(
          reservation.items.map(item => [
            item.mediaId,
            item.reservationId,
          ]),
        );
        if (
          jobItems.length !== reservationByMediaId.size ||
          jobItems.some(
            item =>
              item.state !== 'encrypted' ||
              !reservationByMediaId.get(item.mediaId),
          )
        ) {
          throw new Error('上传预留检查点不完整');
        }
        for (const item of jobItems) {
          await item.update(record => {
            record.reservationId = reservationByMediaId.get(
              item.mediaId,
            );
            record.updatedAt = at;
          });
        }
        await transitionInWriter(job, 'uploading', at);
        await job.update(record => {
          record.reservationExpiresAt = reservation.expiresAt;
        });
        return job;
      });
    },

    markPutCompleted(
      jobId: string,
      mediaId: string,
      objectKey: string,
    ) {
      return database.write(async () => {
        if (!objectKey) {
          throw new Error('COS object key 无效');
        }
        const at = new Date(now());
        const job = await jobs().find(jobId);
        const item = await findItem(jobId, mediaId);
        if (!item.reservationId) {
          throw new Error('上传预留尚未持久化');
        }
        if (item.state !== 'encrypted' && item.state !== 'put_completed') {
          throw new Error('上传媒体状态不允许完成 PUT');
        }
        await item.update(record => {
          record.objectKey = objectKey;
          record.state = 'put_completed';
          record.updatedAt = at;
        });
        const jobItems = await findItems(jobId);
        if (
          jobItems.every(record =>
            ['put_completed', 'verified'].includes(record.state),
          ) &&
          (job.state === 'uploading' || job.state === 'retry_wait')
        ) {
          await transitionInWriter(job, 'confirming', at);
        }
        return item;
      });
    },

    markVerified(jobId: string, mediaId: string) {
      return database.write(async () => {
        const at = new Date(now());
        const job = await jobs().find(jobId);
        const item = await findItem(jobId, mediaId);
        if (item.state !== 'put_completed' && item.state !== 'verified') {
          throw new Error('上传媒体状态不允许确认');
        }
        await item.update(record => {
          record.state = 'verified';
          record.updatedAt = at;
        });
        const jobItems = await findItems(jobId);
        if (
          jobItems.every(record => record.state === 'verified') &&
          (job.state === 'confirming' || job.state === 'retry_wait')
        ) {
          await transitionInWriter(job, 'finalizing', at);
        }
        return item;
      });
    },

    scheduleRetry(jobId: string, errorCode: string) {
      return database.write(async () => {
        if (!stableErrorCode.test(errorCode)) {
          throw new Error('上传错误码无效');
        }
        const currentTime = now();
        const job = await jobs().find(jobId);
        assertTransition(job.state, 'retry_wait');
        const attemptCount = job.attemptCount + 1;
        await job.update(record => {
          record.state = 'retry_wait';
          record.attemptCount = attemptCount;
          record.nextAttemptAt = new Date(
            currentTime + retryDelayMs(attemptCount, random),
          );
          record.lastErrorCode = errorCode;
          record.leaseOwner = undefined;
          record.leaseExpiresAt = undefined;
          record.updatedAt = new Date(currentTime);
        });
        return job;
      });
    },
  };
}

export const uploadOutboxRepository =
  createUploadOutboxRepository();
