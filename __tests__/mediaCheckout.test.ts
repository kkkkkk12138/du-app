import {
  calculateMediaCheckout,
  calculateMediaUnits,
  FREE_MEDIA_BYTES,
  type CheckoutMediaItem,
} from '../src/features/billing/mediaCheckout';

describe('calculateMediaUnits', () => {
  test.each<{
    item: CheckoutMediaItem;
    expected: number;
  }>([
    {
      item: {id: 'photo-1', kind: 'photo', bytes: 2_000_000},
      expected: 1,
    },
    {
      item: {id: 'ink-1', kind: 'ink', bytes: 400_000},
      expected: 1,
    },
    {
      item: {
        id: 'audio-short',
        kind: 'audio',
        bytes: 4_000_000,
        durationSeconds: 15 * 60,
      },
      expected: 1,
    },
    {
      item: {
        id: 'audio-long',
        kind: 'audio',
        bytes: 8_000_000,
        durationSeconds: 15 * 60 + 1,
      },
      expected: 2,
    },
  ])('$item.id costs $expected unit(s)', ({item, expected}) => {
    expect(calculateMediaUnits(item)).toBe(expected);
  });

  test('rejects audio without a valid duration', () => {
    expect(() =>
      calculateMediaUnits({
        id: 'broken-audio',
        kind: 'audio',
        bytes: 1,
      }),
    ).toThrow('录音缺少有效时长');
  });
});

describe('calculateMediaCheckout', () => {
  test('saves text-only entries without media charges', () => {
    expect(
      calculateMediaCheckout({
        items: [],
        remainingFreeBytes: 0,
        availableCredits: 0,
      }),
    ).toEqual({
      freeItemIds: [],
      paidItems: [],
      totalUnits: 0,
      coveredUnits: 0,
      missingUnits: 0,
      remainingFreeBytes: 0,
    });
  });

  test('covers complete media items with remaining free space', () => {
    expect(
      calculateMediaCheckout({
        items: [
          {id: 'photo-1', kind: 'photo', bytes: 2_000_000},
          {id: 'ink-1', kind: 'ink', bytes: 500_000},
        ],
        remainingFreeBytes: FREE_MEDIA_BYTES,
        availableCredits: 0,
      }),
    ).toMatchObject({
      freeItemIds: ['photo-1', 'ink-1'],
      paidItems: [],
      totalUnits: 0,
      missingUnits: 0,
    });
  });

  test('does not partially consume free bytes for an item that does not fit', () => {
    expect(
      calculateMediaCheckout({
        items: [{id: 'photo-1', kind: 'photo', bytes: 2_000_000}],
        remainingFreeBytes: 1_000_000,
        availableCredits: 0,
      }),
    ).toEqual({
      freeItemIds: [],
      paidItems: [
        {
          id: 'photo-1',
          kind: 'photo',
          bytes: 2_000_000,
          units: 1,
        },
      ],
      totalUnits: 1,
      coveredUnits: 0,
      missingUnits: 1,
      remainingFreeBytes: 1_000_000,
    });
  });

  test('applies existing credits to the entire entry shortage', () => {
    expect(
      calculateMediaCheckout({
        items: [
          {id: 'photo-1', kind: 'photo', bytes: 2_000_000},
          {
            id: 'audio-1',
            kind: 'audio',
            bytes: 8_000_000,
            durationSeconds: 20 * 60,
          },
        ],
        remainingFreeBytes: 0,
        availableCredits: 2,
      }),
    ).toMatchObject({
      totalUnits: 3,
      coveredUnits: 2,
      missingUnits: 1,
    });
  });
});
