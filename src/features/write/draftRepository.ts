import {Q} from '@nozbe/watermelondb';

import {database} from '../../db/database';
import {Memory} from '../../db/models';
import type {ArrivalPreset} from '../newLetter/futureLetterLogic';

export type WriteDraftInput = {
  content: string;
  isFuture: boolean;
  futureArriveAt?: Date;
  futureArriveType?: ArrivalPreset;
  customTags: string[];
  imagePath?: string;
  audioPath?: string;
  audioDuration?: number;
  inkImagePath?: string;
  placeDetail?: string;
};

export type WriteDraftSnapshot = WriteDraftInput & {
  id: string;
  updatedAt: Date;
};

function hasDraftContent(input: WriteDraftInput) {
  return Boolean(
    input.content.trim() ||
      input.imagePath ||
      input.audioPath ||
      input.inkImagePath ||
      input.placeDetail ||
      input.customTags.length,
  );
}

function toSnapshot(memory: Memory): WriteDraftSnapshot {
  let customTags: string[] = [];
  try {
    const parsed = JSON.parse(memory.customTags);
    customTags = Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    customTags = [];
  }

  return {
    id: memory.id,
    content: memory.content,
    isFuture: memory.isFutureLetter,
    futureArriveAt: memory.futureArriveAt,
    futureArriveType: memory.futureArriveType as ArrivalPreset | undefined,
    customTags,
    imagePath: memory.imagePath,
    audioPath: memory.audioPath,
    audioDuration: memory.audioDuration,
    inkImagePath: memory.inkImagePath,
    placeDetail: memory.placeDetail,
    updatedAt: memory.updatedAt,
  };
}

export async function getLatestWriteDraft() {
  const drafts = await database
    .get<Memory>('memories')
    .query(
      Q.where('status', 'draft'),
      Q.where('deleted', false),
      Q.sortBy('updated_at', Q.desc),
      Q.take(1),
    )
    .fetch();
  return drafts[0] ? toSnapshot(drafts[0]) : null;
}

export async function getDraftMediaPaths() {
  const drafts = await database
    .get<Memory>('memories')
    .query(Q.where('status', 'draft'), Q.where('deleted', false))
    .fetch();
  return drafts.flatMap(draft =>
    [draft.imagePath, draft.audioPath, draft.inkImagePath].filter(
      (path): path is string => Boolean(path),
    ),
  );
}

export async function saveWriteDraft(
  input: WriteDraftInput,
  draftId?: string,
): Promise<WriteDraftSnapshot | null> {
  if (!hasDraftContent(input)) {
    if (draftId) {
      await discardWriteDraft(draftId);
    }
    return null;
  }

  let existing: Memory | undefined;
  if (draftId) {
    try {
      existing = await database.get<Memory>('memories').find(draftId);
    } catch {
      existing = undefined;
    }
  }

  const now = new Date();
  const apply = (record: Memory) => {
    record.type = input.imagePath
      ? 'photo'
      : input.audioPath
        ? 'audio'
        : input.inkImagePath
          ? 'handwriting'
          : 'text';
    record.content = input.content;
    record.status = 'draft';
    record.imagePath = input.imagePath;
    record.audioPath = input.audioPath;
    record.audioDuration = input.audioDuration;
    record.inkImagePath = input.inkImagePath;
    record.placeDetail = input.placeDetail;
    record.bodyTags = '[]';
    record.heartTags = '[]';
    record.customTags = JSON.stringify(input.customTags);
    record.writtenAt = now;
    record.updatedAt = now;
    record.isFutureLetter = input.isFuture;
    record.futureArriveAt = input.isFuture ? input.futureArriveAt : undefined;
    record.futureArriveType = input.isFuture
      ? input.futureArriveType
      : undefined;
    record.deleted = false;
  };

  const draft = await database.write(async () => {
    if (existing) {
      await existing.update(apply);
      return existing;
    }

    return database.get<Memory>('memories').create(record => {
      apply(record);
      record.createdAt = now;
    });
  });
  return toSnapshot(draft);
}

export async function discardWriteDraft(draftId: string) {
  let draft: Memory;
  try {
    draft = await database.get<Memory>('memories').find(draftId);
  } catch {
    return;
  }
  await database.write(() => draft.destroyPermanently());
}
