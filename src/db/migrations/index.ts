import {schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

// v1 是初始 schema；后续每次修改表结构都必须在这里追加迁移。
export const migrations = schemaMigrations({
  migrations: [],
});
