import { Model } from '@nozbe/watermelondb';
import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

import { database } from '../db/database';
import {
  Book,
  CollagePage,
  Letter,
  Memory,
  Place,
  Quest,
  Scrap,
  User,
  Wish,
} from '../db/models';

const exportRoot = `${RNFS.CachesDirectoryPath}/du-exports`;

export const backupTables = [
  'users',
  'places',
  'memories',
  'letters',
  'settings',
  'tags',
  'wishes',
  'wish_tapes',
  'quests',
  'quest_nodes',
  'quest_edges',
  'quest_stickies',
  'collage_pages',
  'books',
  'book_pages',
  'scraps',
] as const;

export type BackupTable = (typeof backupTables)[number];
export type BackupRawRecord = Record<string, string | number | boolean | null>;

export type BackupAsset = {
  ownerType: 'memory' | 'profile' | 'quest' | 'book' | 'collagePage';
  ownerId: string;
  kind: string;
  source: string;
  filename?: string;
  dataBase64?: string;
  sha256?: string;
  missing: boolean;
};

export type FullBackupManifest = {
  format: 'du-local-backup';
  version: 1;
  schemaVersion: 14;
  exportedAt: string;
  tables: Record<BackupTable, BackupRawRecord[]>;
  assets: BackupAsset[];
  readableText: string;
};

function normalizedPath(path: string) {
  return path.startsWith('file://') ? path.slice(7) : path;
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function extension(path: string) {
  const basename = path.split('/').pop() ?? '';
  const dot = basename.lastIndexOf('.');
  return dot >= 0 ? basename.slice(dot) : '';
}

function rawRecord(model: Model): BackupRawRecord {
  return { ...(model._raw as BackupRawRecord) };
}

async function fetchRawTables() {
  const entries = await Promise.all(
    backupTables.map(async table => {
      const records = await database.get<Model>(table).query().fetch();
      return [table, records.map(rawRecord)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<BackupTable, BackupRawRecord[]>;
}

function formatDate(value?: Date) {
  if (!value) {
    return '未记录';
  }
  return value.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function buildReadableText() {
  const [users, places, memories, letters, wishes, quests, books, scraps] =
    await Promise.all([
      database.get<User>('users').query().fetch(),
      database.get<Place>('places').query().fetch(),
      database.get<Memory>('memories').query().fetch(),
      database.get<Letter>('letters').query().fetch(),
      database.get<Wish>('wishes').query().fetch(),
      database.get<Quest>('quests').query().fetch(),
      database.get<Book>('books').query().fetch(),
      database.get<Scrap>('scraps').query().fetch(),
    ]);
  const placeNames = new Map(places.map(place => [place.id, place.name]));
  const activeMemories = memories
    .filter(memory => !memory.deleted && memory.status !== 'draft')
    .sort(
      (left, right) => left.writtenAt.getTime() - right.writtenAt.getTime(),
    );
  const lines = [
    '渡 · 我的数据',
    `导出时间：${formatDate(new Date())}`,
    `昵称：${users[0]?.nickname ?? '未设置'}`,
    `生日：${
      users[0]?.birthday
        ? formatDate(users[0].birthday).split(' ')[0]
        : '未设置'
    }`,
    '',
    `日迹（${activeMemories.length}）`,
    '────────────────',
  ];

  activeMemories.forEach(memory => {
    lines.push(
      `[${formatDate(memory.writtenAt)}]${
        memory.placeId
          ? ` · ${placeNames.get(memory.placeId) ?? '未知地点'}`
          : ''
      }`,
      memory.content || '（附件记录）',
    );
    const attachments = [
      memory.imagePath ? '照片' : '',
      memory.audioPath ? '录音' : '',
      memory.inkImagePath ? '手写' : '',
    ].filter(Boolean);
    if (attachments.length) {
      lines.push(`附件：${attachments.join('、')}`);
    }
    lines.push('');
  });

  lines.push(`未来信（${letters.length}）`, '────────────────');
  letters
    .sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime())
    .forEach(letter => {
      const memory = memories.find(item => item.id === letter.memoryId);
      lines.push(
        `${formatDate(letter.sentAt)} 寄出 · ${formatDate(
          letter.arriveDate,
        )} 到达 · ${letter.status}`,
        memory?.content || '（附件信件）',
        '',
      );
    });

  const activeWishes = wishes.filter(wish => !wish.deletedAt);
  lines.push(`念想（${activeWishes.length}）`, '────────────────');
  activeWishes.forEach(wish => {
    lines.push(
      `${wish.status === 'fulfilled' ? '✓' : '○'} ${wish.title}`,
      wish.note ?? '',
    );
  });
  lines.push('', `副本（${quests.filter(quest => !quest.deletedAt).length}）`);
  quests
    .filter(quest => !quest.deletedAt)
    .forEach(quest => lines.push(`· ${quest.title}`));
  lines.push('');
  lines.push(
    `书架（${books.filter(book => !book.deletedAt).length} 本）`,
    `散页（${
      scraps.filter(scrap => !scrap.deletedAt && !scrap.archived).length
    } 张）`,
  );
  lines.push('', '此文件由用户主动在本机导出。');
  return lines.join('\n');
}

async function createExportDirectory() {
  await RNFS.mkdir(exportRoot);
  const directory = `${exportRoot}/${Date.now()}`;
  await RNFS.mkdir(directory);
  return directory;
}

async function collectAsset({
  source,
  owner,
  kind,
}: {
  source?: string;
  owner: string;
  kind: string;
}) {
  if (!source) {
    return undefined;
  }
  const normalized = normalizedPath(source);
  if (!(await RNFS.exists(normalized))) {
    return { source, missing: true };
  }
  return {
    source,
    filename: `${safeFilePart(owner)}-${kind}${extension(normalized)}`,
    dataBase64: await RNFS.readFile(normalized, 'base64'),
    sha256: await RNFS.hash(normalized, 'sha256'),
    missing: false,
  };
}

async function shareFile(path: string, mimeType: string, title: string) {
  const module = NativeModules.DuFileShare as
    | {
        shareFile(path: string, mimeType: string, title: string): Promise<void>;
      }
    | undefined;
  if (!module) {
    throw new Error('系统文件分享模块不可用');
  }
  await module.shareFile(path, mimeType, title);
}

export async function shareReadableData() {
  const directory = await createExportDirectory();
  const path = `${directory}/渡-我的数据.txt`;
  try {
    await RNFS.writeFile(path, await buildReadableText(), 'utf8');
    await shareFile(path, 'text/plain', '导出渡的可读文稿');
    return path;
  } catch (error) {
    await RNFS.unlink(directory).catch(() => undefined);
    throw error;
  }
}

export async function createFullBackupFile() {
  const directory = await createExportDirectory();
  const backupPath = `${directory}/渡-完整备份.du-backup.json`;
  try {
    const rawTables = await fetchRawTables();
    const [memories, users, quests, books, collagePages] = await Promise.all([
      database.get<Memory>('memories').query().fetch(),
      database.get<User>('users').query().fetch(),
      database.get<Quest>('quests').query().fetch(),
      database.get<Book>('books').query().fetch(),
      database.get<CollagePage>('collage_pages').query().fetch(),
    ]);
    const assets: BackupAsset[] = [];
    for (const memory of memories) {
      for (const [kind, source] of [
        ['photo', memory.imagePath],
        ['audio', memory.audioPath],
        ['handwriting', memory.inkImagePath],
      ] as const) {
        const copied = await collectAsset({
          source,
          owner: memory.id,
          kind,
        });
        if (copied) {
          assets.push({
            ownerType: 'memory',
            ownerId: memory.id,
            kind,
            ...copied,
          });
        }
      }
    }
    const avatar = await collectAsset({
      source: users[0]?.avatarPath,
      owner: users[0]?.id ?? 'profile',
      kind: 'avatar',
    });
    if (avatar) {
      assets.push({
        ownerType: 'profile',
        ownerId: users[0]?.id ?? 'profile',
        kind: 'avatar',
        ...avatar,
      });
    }
    for (const quest of quests) {
      const cover = await collectAsset({
        source: quest.coverImageAssetId,
        owner: quest.id,
        kind: 'cover',
      });
      if (cover) {
        assets.push({
          ownerType: 'quest',
          ownerId: quest.id,
          kind: 'cover',
          ...cover,
        });
      }
    }
    for (const book of books) {
      const cover = await collectAsset({
        source: book.coverImagePath,
        owner: book.id,
        kind: 'cover',
      });
      if (cover) {
        assets.push({
          ownerType: 'book',
          ownerId: book.id,
          kind: 'cover',
          ...cover,
        });
      }
    }
    for (const page of collagePages) {
      let paths: unknown;
      try {
        paths = JSON.parse(page.photoPaths);
      } catch {
        paths = [];
      }
      if (!Array.isArray(paths)) {
        continue;
      }
      for (const [index, source] of paths.entries()) {
        if (typeof source !== 'string') {
          continue;
        }
        const copied = await collectAsset({
          source,
          owner: page.id,
          kind: `collage-${index + 1}`,
        });
        if (copied) {
          assets.push({
            ownerType: 'collagePage',
            ownerId: page.id,
            kind: `photo-${index + 1}`,
            ...copied,
          });
        }
      }
    }
    const manifest: FullBackupManifest = {
      format: 'du-local-backup',
      version: 1,
      schemaVersion: 14,
      exportedAt: new Date().toISOString(),
      tables: rawTables,
      assets,
      readableText: await buildReadableText(),
    };
    await RNFS.writeFile(backupPath, JSON.stringify(manifest, null, 2), 'utf8');
    return backupPath;
  } catch (error) {
    await RNFS.unlink(directory).catch(() => undefined);
    throw error;
  }
}

export async function shareFullBackup() {
  const backupPath = await createFullBackupFile();
  try {
    await shareFile(backupPath, 'application/json', '导出渡的完整备份');
    return backupPath;
  } catch (error) {
    const directory = backupPath.slice(0, backupPath.lastIndexOf('/'));
    await RNFS.unlink(directory).catch(() => undefined);
    throw error;
  }
}
