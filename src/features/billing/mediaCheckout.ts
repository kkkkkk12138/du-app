export type CheckoutMediaKind = 'photo' | 'audio' | 'ink';

export type CheckoutMediaItem = {
  id: string;
  kind: CheckoutMediaKind;
  bytes: number;
  durationSeconds?: number;
};

const LONG_AUDIO_THRESHOLD_SECONDS = 15 * 60;

export function calculateMediaUnits(item: CheckoutMediaItem) {
  if (item.kind !== 'audio') {
    return 1;
  }
  if (
    item.durationSeconds === undefined ||
    !Number.isFinite(item.durationSeconds) ||
    item.durationSeconds <= 0
  ) {
    throw new Error('录音缺少有效时长');
  }
  return item.durationSeconds > LONG_AUDIO_THRESHOLD_SECONDS ? 2 : 1;
}
