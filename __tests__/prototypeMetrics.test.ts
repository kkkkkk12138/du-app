import {
  createPrototypeMetrics,
  PROTOTYPE_HEIGHT,
  PROTOTYPE_WIDTH,
} from '../src/ui/prototypeMetrics';

describe('prototype metrics', () => {
  test('preserves every HTML measurement at the 390pt baseline', () => {
    const metrics = createPrototypeMetrics(PROTOTYPE_WIDTH);

    expect(metrics.scale).toBe(1);
    expect(metrics.px(44)).toBe(44);
    expect(metrics.height).toBe(PROTOTYPE_HEIGHT);
  });

  test('scales measurements proportionally on other viewport widths', () => {
    const metrics = createPrototypeMetrics(360);

    expect(metrics.scale).toBeCloseTo(360 / 390);
    expect(metrics.px(20)).toBe(18.5);
    expect(metrics.px(390)).toBe(360);
  });
});
