import {useMemo} from 'react';
import {useWindowDimensions} from 'react-native';

export const PROTOTYPE_WIDTH = 390;
export const PROTOTYPE_HEIGHT = 844;

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

export function createPrototypeMetrics(viewportWidth: number) {
  const scale = viewportWidth / PROTOTYPE_WIDTH;
  const px = (value: number) => roundToHalf(value * scale);

  return {
    height: PROTOTYPE_HEIGHT,
    px,
    scale,
    width: PROTOTYPE_WIDTH,
  };
}

export function usePrototypeMetrics() {
  const {width} = useWindowDimensions();

  return useMemo(() => createPrototypeMetrics(width), [width]);
}
