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
  background: '#1C1917',
  surface: '#27221F',
  surfaceWarm: '#211D1A',
  surfaceAged: '#342D28',
  text: '#E8E2D6',
  textSoft: '#D2C8BA',
  textMuted: '#B8AA98',
  textFaint: '#9A8D7D',
  accent: '#E05A47',
  accentSoft: '#C98272',
  seal: '#E05A47',
  line: 'rgba(232, 226, 214, 0.12)',
  tabBar: '#211D1A',
  toastBackground: 'rgba(245, 237, 224, 0.94)',
  toastText: '#2A2420',
  sage: '#9EB9A3',
  sky: '#A9C4D1',
  dusk: '#E2B477',
  rose: '#D5A9A0',
};
