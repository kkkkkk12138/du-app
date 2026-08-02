import React, {createContext, PropsWithChildren, useMemo} from 'react';
import {StatusBar, useColorScheme} from 'react-native';

import {
  darkColors,
  lightColors,
  ThemeColors,
} from '../tokens/colors';
import {ThemeMode, useSettingsStore} from '../store/useSettingsStore';

export type DuTheme = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<DuTheme | null>(null);

export function ThemeProvider({children}: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const mode = useSettingsStore(state => state.themeMode);
  const setMode = useSettingsStore(state => state.setThemeMode);
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const value = useMemo<DuTheme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      mode,
      setMode,
    }),
    [isDark, mode, setMode],
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
