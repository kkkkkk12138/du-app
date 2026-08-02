import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

type SettingsState = {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      themeMode: 'system',
      setThemeMode: themeMode => set({themeMode}),
    }),
    {
      name: 'du-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({themeMode: state.themeMode}),
    },
  ),
);
