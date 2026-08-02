import {Platform} from 'react-native';

export const fontFamilies = {
  serif: Platform.select({
    ios: 'Songti SC',
    android: 'serif',
    default: 'serif',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
} as const;

export const fontSizes = {
  display: 30,
  h1: 28,
  h2: 22,
  title: 17,
  body: 15,
  secondary: 12,
  caption: 10,
} as const;

export const lineHeights = {
  display: 42,
  h1: 40,
  h2: 31,
  title: 24,
  body: 27,
  secondary: 19,
  caption: 16,
} as const;
