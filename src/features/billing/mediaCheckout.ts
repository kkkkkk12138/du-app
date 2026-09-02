export type CheckoutMediaKind = 'photo' | 'audio' | 'ink';

export type CheckoutMediaItem = {
  id: string;
  kind: CheckoutMediaKind;
  bytes: number;
  durationSeconds?: number;
};

export type PaidMediaItem = CheckoutMediaItem & {
  units: number;
};

export type MediaCheckoutQuote = {
  freeItemIds: string[];
  paidItems: PaidMediaItem[];
  totalUnits: number;
  coveredUnits: number;
  missingUnits: number;
  remainingFreeBytes: number;
};

export const FREE_MEDIA_BYTES = 500 * 1024 * 1024;

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

export function calculateMediaCheckout({
  items,
  remainingFreeBytes,
  availableCredits,
}: {
  items: CheckoutMediaItem[];
  remainingFreeBytes: number;
  availableCredits: number;
}): MediaCheckoutQuote {
  const freeItemIds: string[] = [];
  const paidItems: PaidMediaItem[] = [];
  let freeBytes = Math.max(0, Math.floor(remainingFreeBytes));

  items.forEach(item => {
    if (!Number.isFinite(item.bytes) || item.bytes < 0) {
      throw new Error('媒体文件大小无效');
    }
    if (item.bytes <= freeBytes) {
      freeItemIds.push(item.id);
      freeBytes -= item.bytes;
      return;
    }
    paidItems.push({...item, units: calculateMediaUnits(item)});
  });

  const totalUnits = paidItems.reduce((sum, item) => sum + item.units, 0);
  const coveredUnits = Math.min(
    totalUnits,
    Math.max(0, Math.floor(availableCredits)),
  );

  return {
    freeItemIds,
    paidItems,
    totalUnits,
    coveredUnits,
    missingUnits: totalUnits - coveredUnits,
    remainingFreeBytes: freeBytes,
  };
}
