import {
  calculateMediaCheckout,
  calculateMediaUnits,
  FREE_MEDIA_BYTES,
  recommendCreditProduct,
  type CheckoutMediaItem,
  type CreditProduct,
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

const products: CreditProduct[] = [
  {id: 'credit_1', credits: 1, priceMinor: 100},
  {id: 'credit_5', credits: 5, priceMinor: 400},
  {id: 'credit_10', credits: 10, priceMinor: 600},
  {id: 'credit_20', credits: 20, priceMinor: 1000},
];

describe('recommendCreditProduct', () => {
  test.each([
    [1, 'credit_1'],
    [3, 'credit_5'],
    [7, 'credit_10'],
    [16, 'credit_20'],
  ])('recommends a product covering %i missing units', (missing, expected) => {
    expect(recommendCreditProduct(missing, products)?.id).toBe(expected);
  });

  test('returns undefined when no purchase is required', () => {
    expect(recommendCreditProduct(0, products)).toBeUndefined();
  });

  test('rejects a shortage larger than the available products', () => {
    expect(() => recommendCreditProduct(21, products)).toThrow(
      '没有可覆盖本次内容的媒体额度商品',
    );
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
