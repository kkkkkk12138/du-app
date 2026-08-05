import {
  addColumns,
  createTable,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

// v1 是初始 schema；后续每次修改表结构都必须在这里追加迁移。
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'letter_reminder_time',
              type: 'string',
            },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'users',
          columns: [
            {
              name: 'avatar_path',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'memories',
          columns: [
            {
              name: 'status',
              type: 'string',
              isIndexed: true,
            },
          ],
        }),
        createTable({
          name: 'wishes',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'note', type: 'string', isOptional: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'pinned', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'quests',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'description', type: 'string', isOptional: true },
            { name: 'theme_color', type: 'string' },
            { name: 'cover_mode', type: 'string' },
            { name: 'cover_image_asset_id', type: 'string', isOptional: true },
            { name: 'is_template', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'quest_nodes',
          columns: [
            { name: 'quest_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'icon', type: 'string' },
            { name: 'x', type: 'number' },
            { name: 'y', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'quest_edges',
          columns: [
            { name: 'quest_id', type: 'string', isIndexed: true },
            { name: 'from_node_id', type: 'string', isIndexed: true },
            { name: 'to_node_id', type: 'string', isIndexed: true },
            { name: 'style', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'quest_stickies',
          columns: [
            { name: 'quest_id', type: 'string', isIndexed: true },
            { name: 'node_id', type: 'string', isIndexed: true },
            { name: 'text', type: 'string' },
            { name: 'color', type: 'string' },
            { name: 'memory_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'art_skin',
              type: 'string',
            },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'wishes',
          columns: [
            {
              name: 'color',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        createTable({
          name: 'wish_tapes',
          columns: [
            { name: 'wish_id', type: 'string', isIndexed: true },
            { name: 'text', type: 'string' },
            { name: 'style', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'wishes',
          columns: [
            { name: 'category', type: 'string', isOptional: true },
            { name: 'target_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'users',
          columns: [{ name: 'birthday', type: 'number', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        addColumns({
          table: 'memories',
          columns: [
            { name: 'future_arrive_at', type: 'number', isOptional: true },
            { name: 'future_arrive_type', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 11,
      steps: [
        createTable({
          name: 'collage_pages',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'photo_paths', type: 'string' },
            { name: 'palette', type: 'string' },
            { name: 'layout_seed', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 12,
      steps: [
        createTable({
          name: 'books',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'subtitle', type: 'string' },
            { name: 'year', type: 'string', isIndexed: true },
            { name: 'categories', type: 'string' },
            { name: 'cover_template', type: 'string' },
            { name: 'cover_bg', type: 'string' },
            { name: 'cover_accent', type: 'string' },
            { name: 'cover_text', type: 'string' },
            { name: 'spine_width', type: 'number' },
            { name: 'source', type: 'string' },
            { name: 'current_page', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'book_pages',
          columns: [
            { name: 'book_id', type: 'string', isIndexed: true },
            { name: 'page_index', type: 'number', isIndexed: true },
            { name: 'type', type: 'string' },
            { name: 'date_label', type: 'string', isOptional: true },
            { name: 'text_content', type: 'string', isOptional: true },
            { name: 'quote', type: 'string', isOptional: true },
            { name: 'author', type: 'string', isOptional: true },
            { name: 'decoration', type: 'string', isOptional: true },
            { name: 'source_type', type: 'string', isOptional: true },
            { name: 'source_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'scraps',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'text_content', type: 'string' },
            { name: 'source_label', type: 'string' },
            { name: 'source_type', type: 'string', isIndexed: true },
            { name: 'source_id', type: 'string', isOptional: true },
            { name: 'source_book_id', type: 'string', isOptional: true },
            { name: 'color', type: 'string' },
            { name: 'card_type', type: 'string' },
            { name: 'x', type: 'number' },
            { name: 'y', type: 'number' },
            { name: 'rotation', type: 'number' },
            { name: 'tape_color', type: 'string', isOptional: true },
            { name: 'has_letter_line', type: 'boolean' },
            { name: 'archived', type: 'boolean', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 13,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'cover_image_path',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
  ],
});
