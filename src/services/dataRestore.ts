import { Model } from '@nozbe/watermelondb';
import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

import { database } from '../db/database';
import { Book, CollagePage, Memory, User } from '../db/models';
import {schema} from '../db/schema';
import {
  backupTables,
  BackupAsset,
  BackupRawRecord,
  BackupTable,
  createFullBackupFile,
  FullBackupManifest,
} from './dataExport';
import { removeMediaFile, writeRestoredMediaFile } from './mediaStorage';

const currentSchemaVersion = schema.version;
const maximumBackupBytes = 300 * 1024 * 1024;
const maximumRecords = 100000;
const maximumAssets = 5000;

export type BackupPreview = {
  path: string;
  exportedAt: Date;
  recordCount: number;
  memoryCount: number;
  letterCount: number;
  wishCount: number;
  questCount: number;
  collageCount: number;
  bookCount: number;
  scrapCount: number;
  assetCount: number;
  missingAssetCount: number;
};

export type RestoreResult = {
  preview: BackupPreview;
  settings: BackupRawRecord | undefined;
  duNumber: string;
};

type PreparedBackup = {
  manifest: FullBackupManifest;
  preview: BackupPreview;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRawRecords(table: string, value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(`备份缺少 ${table} 数据表`);
  }
  const ids = new Set<string>();
  value.forEach(record => {
    if (!isObject(record) || typeof record.id !== 'string' || !record.id) {
      throw new Error(`备份中的 ${table} 记录无效`);
    }
    if (
      Object.prototype.hasOwnProperty.call(record, '__proto__') ||
      ids.has(record.id)
    ) {
      throw new Error(`备份中的 ${table} 记录重复或不安全`);
    }
    ids.add(record.id);
  });
}

function validateAsset(value: unknown): asserts value is BackupAsset {
  if (
    !isObject(value) ||
    !['memory', 'profile', 'quest', 'book', 'collagePage'].includes(
      String(value.ownerType),
    ) ||
    typeof value.ownerId !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.missing !== 'boolean'
  ) {
    throw new Error('备份附件清单无效');
  }
  if (
    !value.missing &&
    (typeof value.filename !== 'string' ||
      typeof value.dataBase64 !== 'string' ||
      typeof value.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(value.sha256))
  ) {
    throw new Error('备份附件内容不完整');
  }
}

async function readAndValidateBackup(path: string): Promise<PreparedBackup> {
  const normalizedPath = path.replace(/^file:\/\//, '');
  const stat = await RNFS.stat(normalizedPath);
  if (Number(stat.size) > maximumBackupBytes) {
    throw new Error('备份超过 300 MB，请确认文件是否正确');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await RNFS.readFile(normalizedPath, 'utf8'));
  } catch {
    throw new Error('无法解析备份文件，文件可能已损坏');
  }
  if (
    !isObject(parsed) ||
    parsed.format !== 'du-local-backup' ||
    parsed.version !== 1 ||
    ![11, 12, 13, 14, currentSchemaVersion].includes(
      Number(parsed.schemaVersion),
    ) ||
    !isObject(parsed.tables) ||
    !Array.isArray(parsed.assets) ||
    typeof parsed.exportedAt !== 'string'
  ) {
    throw new Error('这不是当前版本支持的渡完整备份');
  }

  const parsedTables = parsed.tables as Record<string, unknown>;
  // Early v1 backups did not include the static tag table.
  parsedTables.tags ??= [];
  // Schema v11 predates the bookshelf and scraps features.
  parsedTables.books ??= [];
  parsedTables.book_pages ??= [];
  parsedTables.scraps ??= [];
  if (Number(parsed.schemaVersion) < 14) {
    (parsedTables.memories as BackupRawRecord[]).forEach(record => {
      record.place_city ??= null;
      record.place_region ??= null;
      record.place_country_code ??= null;
    });
    (parsedTables.places as BackupRawRecord[]).forEach(record => {
      record.region ??= null;
      record.country_code ??= null;
    });
  }
  if (Number(parsed.schemaVersion) < 15) {
    (parsedTables.letters as BackupRawRecord[]).forEach(record => {
      record.notification_status ??= null;
      record.notification_id ??= null;
    });
  }
  backupTables.forEach(table => validateRawRecords(table, parsedTables[table]));
  const recordCount = backupTables.reduce(
    (count, table) => count + (parsedTables[table] as unknown[]).length,
    0,
  );
  if (recordCount > maximumRecords || parsed.assets.length > maximumAssets) {
    throw new Error('备份记录数量异常，已停止恢复');
  }
  parsed.assets.forEach(validateAsset);
  const exportedAt = new Date(parsed.exportedAt);
  if (Number.isNaN(exportedAt.getTime())) {
    throw new Error('备份导出时间无效');
  }

  parsed.schemaVersion = currentSchemaVersion;
  const manifest = parsed as unknown as FullBackupManifest;
  const count = (table: BackupTable) => manifest.tables[table].length;
  return {
    manifest,
    preview: {
      path: normalizedPath,
      exportedAt,
      recordCount,
      memoryCount: count('memories'),
      letterCount: count('letters'),
      wishCount: count('wishes'),
      questCount: count('quests'),
      collageCount: count('collage_pages'),
      bookCount: count('books'),
      scrapCount: count('scraps'),
      assetCount: manifest.assets.filter(asset => !asset.missing).length,
      missingAssetCount: manifest.assets.filter(asset => asset.missing).length,
    },
  };
}

function pickerModule() {
  const module = NativeModules.DuFileShare as
    | { pickBackupFile(): Promise<string | null> }
    | undefined;
  if (!module?.pickBackupFile) {
    throw new Error('系统文件选择模块不可用');
  }
  return module;
}

export async function pickAndInspectBackup() {
  const path = await pickerModule().pickBackupFile();
  if (!path) {
    return undefined;
  }
  try {
    return (await readAndValidateBackup(path)).preview;
  } catch (error) {
    await removeMediaFile(path);
    throw error;
  }
}

export async function discardPickedBackup(path: string) {
  await removeMediaFile(path);
}

function copyTables(manifest: FullBackupManifest) {
  return Object.fromEntries(
    backupTables.map(table => [
      table,
      manifest.tables[table].map(record => ({ ...record })),
    ]),
  ) as Record<BackupTable, BackupRawRecord[]>;
}

function remapIdentity(
  tables: Record<BackupTable, BackupRawRecord[]>,
  currentUserId: string,
) {
  const user = tables.users[0];
  if (!user) {
    throw new Error('备份中没有用户资料');
  }
  user.id = currentUserId;
  tables.users = [user];
  tables.settings = tables.settings.slice(0, 1).map(settings => ({
    ...settings,
    id: 'local-settings',
    user_id: currentUserId,
  }));
  for (const table of [
    'wishes',
    'quests',
    'collage_pages',
    'books',
    'scraps',
  ] as const) {
    tables[table].forEach(record => {
      record.user_id = currentUserId;
    });
  }
}

function assetKey(asset: Pick<BackupAsset, 'ownerType' | 'ownerId' | 'kind'>) {
  return `${asset.ownerType}:${asset.ownerId}:${asset.kind}`;
}

async function restoreAssets(
  manifest: FullBackupManifest,
  tables: Record<BackupTable, BackupRawRecord[]>,
) {
  const restoredPaths = new Map<string, string>();
  const createdPaths: string[] = [];
  try {
    for (const asset of manifest.assets) {
      if (asset.missing) {
        continue;
      }
      const path = await writeRestoredMediaFile({
        dataBase64: asset.dataBase64!,
        filename: asset.filename!,
        sha256: asset.sha256!,
      });
      restoredPaths.set(assetKey(asset), path);
      createdPaths.push(path);
    }
  } catch (error) {
    await Promise.allSettled(createdPaths.map(removeMediaFile));
    throw error;
  }

  const pathFor = (
    ownerType: BackupAsset['ownerType'],
    ownerId: string,
    kind: string,
  ) => restoredPaths.get(`${ownerType}:${ownerId}:${kind}`) ?? null;

  tables.memories.forEach(record => {
    record.image_path = pathFor('memory', String(record.id), 'photo');
    record.audio_path = pathFor('memory', String(record.id), 'audio');
    record.ink_image_path = pathFor('memory', String(record.id), 'handwriting');
  });
  const sourceUserId = String(manifest.tables.users[0]?.id ?? '');
  if (tables.users[0]) {
    tables.users[0].avatar_path = pathFor('profile', sourceUserId, 'avatar');
  }
  tables.quests.forEach(record => {
    const coverPath = pathFor('quest', String(record.id), 'cover');
    record.cover_image_asset_id = coverPath;
    if (!coverPath && record.cover_mode === 'photo') {
      record.cover_mode = 'auto';
    }
  });
  tables.books.forEach(record => {
    record.cover_image_path = pathFor('book', String(record.id), 'cover');
  });
  tables.collage_pages = tables.collage_pages.filter(record => {
    const ownerId = String(record.id);
    const paths = [1, 2, 3]
      .map(index => pathFor('collagePage', ownerId, `photo-${index}`))
      .filter((path): path is string => Boolean(path));
    if (paths.length !== 3) {
      return false;
    }
    record.photo_paths = JSON.stringify(paths);
    return true;
  });
  return createdPaths;
}

async function replaceDatabase(tables: Record<BackupTable, BackupRawRecord[]>) {
  await database.write(async () => {
    await database.unsafeResetDatabase();
    const prepared = backupTables.flatMap(table =>
      tables[table].map(record =>
        database.get<Model>(table).prepareCreateFromDirtyRaw({
          ...record,
          _status: 'synced',
          _changed: '',
        }),
      ),
    );
    for (let start = 0; start < prepared.length; start += 500) {
      await database.batch(...prepared.slice(start, start + 500));
    }
  });
}

async function currentMediaPaths() {
  const [memories, users, quests, books, collagePages] = await Promise.all([
    database.get<Memory>('memories').query().fetch(),
    database.get<User>('users').query().fetch(),
    database.get<Model>('quests').query().fetch(),
    database.get<Book>('books').query().fetch(),
    database.get<CollagePage>('collage_pages').query().fetch(),
  ]);
  const paths = [
    ...memories.flatMap(memory => [
      memory.imagePath,
      memory.audioPath,
      memory.inkImagePath,
    ]),
    ...users.map(user => user.avatarPath),
    ...books.map(book => book.coverImagePath),
    ...quests.map(quest => {
      const raw = quest._raw as BackupRawRecord;
      return typeof raw.cover_image_asset_id === 'string'
        ? raw.cover_image_asset_id
        : undefined;
    }),
  ];
  collagePages.forEach(page => {
    try {
      const parsed = JSON.parse(page.photoPaths);
      if (Array.isArray(parsed)) {
        paths.push(...parsed.filter(path => typeof path === 'string'));
      }
    } catch {
      // A malformed legacy collage path is ignored during cleanup.
    }
  });
  return paths.filter((path): path is string => Boolean(path));
}

async function applyManifest(
  manifest: FullBackupManifest,
  currentUserId: string,
) {
  const tables = copyTables(manifest);
  const createdPaths = await restoreAssets(manifest, tables);
  remapIdentity(tables, currentUserId);
  try {
    await replaceDatabase(tables);
    return { tables, createdPaths };
  } catch (error) {
    await Promise.allSettled(createdPaths.map(removeMediaFile));
    throw error;
  }
}

export async function restoreFullBackup(
  path: string,
  currentUserId: string,
): Promise<RestoreResult> {
  const imported = await readAndValidateBackup(path);
  const rescuePath = await createFullBackupFile();
  const existingMedia = await currentMediaPaths();
  try {
    const restored = await applyManifest(imported.manifest, currentUserId);
    await Promise.allSettled(existingMedia.map(removeMediaFile));
    const settings = restored.tables.settings[0];
    return {
      preview: imported.preview,
      settings,
      duNumber: String(restored.tables.users[0]?.du_number ?? ''),
    };
  } catch (restoreError) {
    try {
      const rescue = await readAndValidateBackup(rescuePath);
      await applyManifest(rescue.manifest, currentUserId);
    } catch (rollbackError) {
      console.error('恢复失败且自动回滚未完成', rollbackError);
      throw new Error('恢复失败，自动回滚也未完成，请保留原备份并联系支持');
    }
    throw restoreError;
  } finally {
    await removeMediaFile(path);
    const rescueDirectory = rescuePath.slice(0, rescuePath.lastIndexOf('/'));
    await RNFS.unlink(rescueDirectory).catch(() => undefined);
  }
}
