import RNFS from 'react-native-fs';

import {
  clearAbandonedDraftMedia,
  finalizePreparedMedia,
  prepareMediaForPersistence,
  rollbackPreparedMedia,
} from '../src/services/mediaStorage';

beforeEach(() => {
  jest.clearAllMocks();
});

test('copies a draft into durable storage and removes draft after success', async () => {
  const prepared = await prepareMediaForPersistence(
    '/tmp/du-drafts/photo-draft.jpg',
    'photo',
    'jpg',
  );

  expect(prepared).toEqual({
    path: expect.stringContaining('/du-attachments/photo-'),
    draftPath: '/tmp/du-drafts/photo-draft.jpg',
    createdPath: expect.stringContaining('/du-attachments/photo-'),
  });
  expect(RNFS.copyFile).toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-draft.jpg',
    expect.stringContaining('/du-attachments/photo-'),
  );

  await finalizePreparedMedia([prepared]);
  expect(RNFS.unlink).toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-draft.jpg',
  );
});

test('removes only the durable copy when persistence fails', async () => {
  const prepared = await prepareMediaForPersistence(
    '/tmp/du-drafts/ink-draft.png',
    'ink',
    'png',
  );

  await rollbackPreparedMedia([prepared]);

  expect(RNFS.unlink).toHaveBeenCalledWith(
    expect.stringContaining('/du-attachments/ink-'),
  );
  expect(RNFS.unlink).not.toHaveBeenCalledWith(
    '/tmp/du-drafts/ink-draft.png',
  );
});

test('leaves an already durable media path unchanged', async () => {
  await expect(
    prepareMediaForPersistence(
      '/tmp/du-attachments/photo-existing.jpg',
      'photo',
      'jpg',
    ),
  ).resolves.toEqual({
    path: '/tmp/du-attachments/photo-existing.jpg',
  });
  expect(RNFS.copyFile).not.toHaveBeenCalled();
});

test('keeps referenced draft media and removes only orphaned files', async () => {
  (RNFS.readDir as jest.Mock).mockResolvedValueOnce([
    {
      path: '/tmp/du-drafts/photo-kept.jpg',
      isFile: () => true,
    },
    {
      path: '/tmp/du-drafts/audio-orphan.wav',
      isFile: () => true,
    },
  ]);

  await clearAbandonedDraftMedia(['/tmp/du-drafts/photo-kept.jpg']);

  expect(RNFS.unlink).toHaveBeenCalledWith(
    '/tmp/du-drafts/audio-orphan.wav',
  );
  expect(RNFS.unlink).not.toHaveBeenCalledWith(
    '/tmp/du-drafts/photo-kept.jpg',
  );
});
