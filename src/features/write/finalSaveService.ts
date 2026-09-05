import {randomId} from '@nozbe/watermelondb/utils/common';

import {
  createMemory,
  type CreateMemoryInput,
  type MemoryPersistenceOptions,
  type MemoryPersistenceResult,
} from '../../db/memoryRepository';
import type {FutureLetterDraft} from '../../navigation/RootNavigator';
import {
  collectCheckoutMediaItems,
  type EntryMediaPaths,
} from '../billing/mediaCheckoutInput';
import type {PendingUploadOutboxInput} from '../billing/uploadOutboxRepository';
import type {AccountState} from '../account/useAccountStore';
import {
  createFutureLetter,
  type FutureLetterPersistenceOptions,
} from '../newLetter/futureLetterRepository';
import type {ArrivalPreset} from '../newLetter/futureLetterLogic';

const stableServiceId = /^[A-Za-z0-9._:-]{1,160}$/;

type SaveAccountState = Exclude<AccountState, {status: 'restoring'}>;
type MediaKind = 'photo' | 'audio' | 'ink';

export type SaveCompletionKind =
  | 'saved_local'
  | 'saved_pending_upload'
  | 'saved_pending_finalize'
  | 'sent';

export type StableSaveIds = {
  entryCommitId?: string;
  localEntryId?: string;
  mediaIds?: Partial<Record<MediaKind, string>>;
};

type FutureLetterPersistenceResult = Awaited<
  ReturnType<typeof createFutureLetter>
>;

type FinalSaveDependencies = {
  collectMediaItems: typeof collectCheckoutMediaItems;
  createId: (prefix: string) => string;
  persistMemory: (
    input: CreateMemoryInput,
    options: MemoryPersistenceOptions,
  ) => Promise<MemoryPersistenceResult>;
  persistFutureLetter: (
    input: {
      draft: FutureLetterDraft;
      arriveDate: Date;
      arriveType: ArrivalPreset;
    },
    options: FutureLetterPersistenceOptions,
  ) => Promise<FutureLetterPersistenceResult>;
  triggerUpload: (jobId: string) => void | Promise<void>;
};

function defaultCreateId(prefix: string) {
  return `${prefix}-${randomId()}`;
}

function hasMedia(paths: EntryMediaPaths) {
  return Boolean(
    paths.imagePath || paths.audioPath || paths.inkImagePath,
  );
}

function assertStableId(value: string, label: string) {
  if (!stableServiceId.test(value)) {
    throw new Error(`${label} 无效`);
  }
  return value;
}

export function createUploadIdempotencyKey({
  entryType,
  localEntryId,
  entryCommitId,
}: {
  entryType: 'memory' | 'future_letter';
  localEntryId: string;
  entryCommitId: string;
}) {
  return assertStableId(
    `${entryType}:${localEntryId}:${entryCommitId}`,
    '上传幂等键',
  );
}

export function createFinalSaveService(
  dependencies: Partial<FinalSaveDependencies> = {},
) {
  const collectMediaItems =
    dependencies.collectMediaItems ?? collectCheckoutMediaItems;
  const createId = dependencies.createId ?? defaultCreateId;
  const persistMemory =
    dependencies.persistMemory ??
    ((input, options) => createMemory(input, options));
  const persistFutureLetter =
    dependencies.persistFutureLetter ?? createFutureLetter;
  const triggerUpload =
    dependencies.triggerUpload ?? (() => undefined);

  const buildPersistenceOptions = async ({
    account,
    entryType,
    localEntryId,
    media,
    ids,
  }: {
    account: SaveAccountState;
    entryType: 'memory' | 'future_letter';
    localEntryId: string;
    media: EntryMediaPaths;
    ids?: StableSaveIds;
  }) => {
    const options: MemoryPersistenceOptions = {localEntryId};
    if (
      account.status === 'signed_out' ||
      !hasMedia(media)
    ) {
      return {options};
    }

    const checkoutItems = await collectMediaItems(media);
    const entryCommitId = assertStableId(
      ids?.entryCommitId ?? createId('commit'),
      'entryCommitId',
    );
    const items: PendingUploadOutboxInput['items'] =
      checkoutItems.map(item => {
        const mediaKind = item.kind;
        return {
          mediaId: assertStableId(
            ids?.mediaIds?.[mediaKind] ??
              createId(`media-${mediaKind}`),
            'mediaId',
          ),
          mediaKind,
          plaintextBytes: item.bytes,
        };
      });
    const outbox: PendingUploadOutboxInput = {
      entryCommitId,
      accountUid: account.session.uid,
      state:
        account.status === 'signed_in_unlocked'
          ? 'pending_encrypt'
          : 'blocked_key',
      items,
    };
    const idempotencyKey = createUploadIdempotencyKey({
      entryType,
      localEntryId,
      entryCommitId,
    });
    return {
      options: {...options, outbox},
      idempotencyKey,
    };
  };

  const triggerCommittedUpload = async (uploadJobId?: string) => {
    if (!uploadJobId) {
      return;
    }
    try {
      await triggerUpload(uploadJobId);
    } catch {
      // The durable outbox remains the source of truth for later recovery.
    }
  };

  return {
    async saveMemory({
      input,
      account,
      ids,
    }: {
      input: CreateMemoryInput;
      account: SaveAccountState;
      ids?: StableSaveIds;
    }) {
      const localEntryId = assertStableId(
        ids?.localEntryId ??
          input.draftId ??
          createId('memory'),
        'localEntryId',
      );
      const {options, idempotencyKey} =
        await buildPersistenceOptions({
          account,
          entryType: 'memory',
          localEntryId,
          media: input,
          ids,
        });
      const result = await persistMemory(input, options);
      await triggerCommittedUpload(result.uploadJobId);
      return {
        ...result,
        idempotencyKey,
        completion: result.uploadJobId
          ? ('saved_pending_upload' as const)
          : ('saved_local' as const),
      };
    },

    async saveFutureLetter({
      draft,
      arriveDate,
      arriveType,
      account,
      ids,
    }: {
      draft: FutureLetterDraft;
      arriveDate: Date;
      arriveType: ArrivalPreset;
      account: SaveAccountState;
      ids?: StableSaveIds;
    }) {
      const localEntryId = assertStableId(
        ids?.localEntryId ??
          draft.draftId ??
          createId('memory'),
        'localEntryId',
      );
      const {options, idempotencyKey} =
        await buildPersistenceOptions({
          account,
          entryType: 'future_letter',
          localEntryId,
          media: draft,
          ids,
        });
      const result = await persistFutureLetter(
        {draft, arriveDate, arriveType},
        options,
      );
      await triggerCommittedUpload(result.uploadJobId);
      return {
        ...result,
        idempotencyKey,
        completion: result.uploadJobId
          ? ('saved_pending_upload' as const)
          : ('saved_pending_finalize' as const),
      };
    },
  };
}

export const finalSaveService = createFinalSaveService();
