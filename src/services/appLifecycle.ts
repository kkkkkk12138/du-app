import {reconcileLetterArrivals} from '../features/letters/lettersRepository';
import {getDraftMediaPaths} from '../features/write/draftRepository';
import {clearAbandonedDraftMedia} from './mediaStorage';

function reportMaintenanceError(message: string, error: unknown) {
  const nodeEnv = (
    globalThis as {process?: {env?: {NODE_ENV?: string}}}
  ).process?.env?.NODE_ENV;
  if (nodeEnv !== 'test') {
    console.error(message, error);
  }
}

export async function runForegroundDataMaintenance() {
  let arrivedCount = 0;
  try {
    arrivedCount = await reconcileLetterArrivals();
  } catch (error) {
    reportMaintenanceError('未来信到达校验失败', error);
  }

  try {
    const referencedDraftMedia = await getDraftMediaPaths();
    await clearAbandonedDraftMedia(referencedDraftMedia);
  } catch (error) {
    reportMaintenanceError('草稿附件清理失败', error);
  }

  return {arrivedCount};
}
