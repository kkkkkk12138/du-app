import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

type SettingsState = {
  hasHydrated: boolean;
  anonymousId: string | null;
  duNumber: string | null;
  themeMode: ThemeMode;
  dailyReminderOn: boolean;
  dailyReminderTime: string;
  letterReminderOn: boolean;
  letterReminderTime: string;
  biometricLockOn: boolean;
  defaultCity: string;
  onboardingCompleted: boolean;
  privacyAcceptedAt: number | null;
  setHasHydrated: (hasHydrated: boolean) => void;
  setIdentity: (anonymousId: string, duNumber: string) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setDailyReminderOn: (enabled: boolean) => void;
  setDailyReminderTime: (time: string) => void;
  setLetterReminderOn: (enabled: boolean) => void;
  setLetterReminderTime: (time: string) => void;
  setBiometricLockOn: (enabled: boolean) => void;
  setDefaultCity: (city: string) => void;
  completeOnboarding: () => void;
  resetAfterDataDeletion: (anonymousId: string, duNumber: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      hasHydrated: false,
      anonymousId: null,
      duNumber: null,
      themeMode: 'system',
      dailyReminderOn: false,
      dailyReminderTime: '22:30',
      letterReminderOn: true,
      letterReminderTime: '09:00',
      biometricLockOn: false,
      defaultCity: '上海',
      onboardingCompleted: false,
      privacyAcceptedAt: null,
      setHasHydrated: hasHydrated => set({ hasHydrated }),
      setIdentity: (anonymousId, duNumber) => set({ anonymousId, duNumber }),
      setThemeMode: themeMode => set({ themeMode }),
      setDailyReminderOn: dailyReminderOn => set({ dailyReminderOn }),
      setDailyReminderTime: dailyReminderTime => set({ dailyReminderTime }),
      setLetterReminderOn: letterReminderOn => set({ letterReminderOn }),
      setLetterReminderTime: letterReminderTime => set({ letterReminderTime }),
      setBiometricLockOn: biometricLockOn => set({ biometricLockOn }),
      setDefaultCity: defaultCity => set({ defaultCity }),
      completeOnboarding: () =>
        set({
          onboardingCompleted: true,
          privacyAcceptedAt: Date.now(),
        }),
      resetAfterDataDeletion: (anonymousId, duNumber) =>
        set({
          anonymousId,
          duNumber,
          themeMode: 'system',
          dailyReminderOn: false,
          dailyReminderTime: '22:30',
          letterReminderOn: true,
          letterReminderTime: '09:00',
          biometricLockOn: false,
          defaultCity: '上海',
          onboardingCompleted: false,
          privacyAcceptedAt: null,
        }),
    }),
    {
      name: 'du-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        themeMode: state.themeMode,
        dailyReminderOn: state.dailyReminderOn,
        dailyReminderTime: state.dailyReminderTime,
        letterReminderOn: state.letterReminderOn,
        letterReminderTime: state.letterReminderTime,
        biometricLockOn: state.biometricLockOn,
        defaultCity: state.defaultCity,
        onboardingCompleted: state.onboardingCompleted,
        privacyAcceptedAt: state.privacyAcceptedAt,
      }),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
