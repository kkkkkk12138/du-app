import {Platform} from 'react-native';

export const fontFamilies = {
  serif: 'NotoSerifSC-Regular',
  serifMedium: Platform.select({
    ios: 'NotoSerifSC-Medium',
    android: 'NotoSerifSC-Regular',
    default: 'NotoSerifSC-Medium',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  englishSerif: 'CormorantGaramond-Regular',
  englishSerifItalic: 'CormorantGaramond-Italic',
} as const;

export const fontSizes = {
  display: 26,
  h1: 26,
  h2: 24,
  title: 17,
  bodyLarge: 16,
  body: 15,
  writing: 18,
  letter: 16,
  quote: 15,
  statistic: 22,
  meta: 13,
  secondary: 13,
  caption: 11,
} as const;

export const lineHeights = {
  display: 36.4,
  h1: 36.4,
  h2: 33.6,
  title: 24,
  bodyLarge: 29.6,
  body: 27.75,
  writing: 36,
  letter: 32,
  quote: 26.25,
  secondary: 22.75,
  caption: 17.5,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
} as const;
