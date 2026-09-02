import {
  calculateMediaUnits,
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
