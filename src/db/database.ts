import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {migrations} from './migrations';
import {modelClasses} from './models';
import {schema} from './schema';

const adapter = new SQLiteAdapter({
  dbName: 'du',
  schema,
  migrations,
  jsi: true,
  onSetUpError: error => {
    console.error('本地数据库初始化失败', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});
