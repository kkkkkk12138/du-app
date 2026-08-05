import React, {createContext, PropsWithChildren, useMemo} from 'react';
import {StatusBar, useColorScheme} from 'react-native';

import {
  getThemeColors,
  ThemeColors,
} from '../tokens/colors';
import {
  ArtSkin,
  ThemeMode,
  useSettingsStore,
} from '../store/useSettingsStore';

export type DuTheme = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  artSkin: ArtSkin;
  setMode: (mode: ThemeMode) => void;
  setArtSkin: (artSkin: ArtSkin) => void;
};

export const ThemeContext = createContext<DuTheme | null>(null);

export function ThemeProvider({children}: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const mode = useSettingsStore(state => state.themeMode);
  const setMode = useSettingsStore(state => state.setThemeMode);
  const artSkin = useSettingsStore(state => state.artSkin);
  const setArtSkin = useSettingsStore(state => state.setArtSkin);
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const value = useMemo<DuTheme>(
    () => ({
      colors: getThemeColors(isDark, artSkin),
      isDark,
      mode,
      artSkin,
      setMode,
      setArtSkin,
    }),
    [artSkin, isDark, mode, setArtSkin, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        animated
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={value.colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
}
