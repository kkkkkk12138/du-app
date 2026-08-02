export const primitiveColors = {
  wood: '#EDE3D2',
  woodDeep: '#D9CCB8',
  paper: '#FFFDF8',
  paperWarm: '#FBF6EC',
  paperAged: '#F5EDE0',
  ink: '#3A332D',
  inkSoft: '#6B5F55',
  inkLight: '#9B8E82',
  inkFaint: '#C4B8AA',
  accent: '#B85C38',
  accentSoft: '#D4A592',
  sage: '#8FAA95',
  sky: '#9AB8C8',
  dusk: '#D9A26B',
  rose: '#C99B92',
  seal: '#C0392B',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceWarm: string;
  surfaceAged: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  seal: string;
  line: string;
  tabBar: string;
  toastBackground: string;
  toastText: string;
  sage: string;
  sky: string;
  dusk: string;
  rose: string;
};

export const lightColors: ThemeColors = {
  background: primitiveColors.paperWarm,
  surface: primitiveColors.paper,
  surfaceWarm: primitiveColors.paperWarm,
  surfaceAged: primitiveColors.paperAged,
  text: primitiveColors.ink,
  textSoft: primitiveColors.inkSoft,
  textMuted: primitiveColors.inkLight,
  textFaint: primitiveColors.inkFaint,
  accent: primitiveColors.accent,
  accentSoft: primitiveColors.accentSoft,
  seal: primitiveColors.seal,
  line: 'rgba(58, 51, 45, 0.08)',
  tabBar: '#F5F0E4',
  toastBackground: 'rgba(30, 24, 18, 0.90)',
  toastText: '#F5EBD8',
  sage: primitiveColors.sage,
  sky: primitiveColors.sky,
  dusk: primitiveColors.dusk,
  rose: primitiveColors.rose,
};

export const darkColors: ThemeColors = {
  background: '#2A2520',
  surface: '#3A3028',
  surfaceWarm: '#2A2520',
  surfaceAged: '#3A3028',
  text: '#E8DFD3',
  textSoft: '#B8A898',
  textMuted: '#8B7D6F',
  textFaint: '#8B7D6F',
  accent: '#D47854',
  accentSoft: '#D47854',
  seal: '#D44535',
  line: 'rgba(255, 255, 255, 0.08)',
  tabBar: '#2A2520',
  toastBackground: 'rgba(245, 237, 224, 0.94)',
  toastText: '#2A2420',
  sage: primitiveColors.sage,
  sky: primitiveColors.sky,
  dusk: primitiveColors.dusk,
  rose: primitiveColors.rose,
};
