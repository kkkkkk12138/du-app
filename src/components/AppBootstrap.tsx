import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';

import { verifyMemoryRoundTrip } from '../db/memoryRepository';
import { saveSettingsSnapshot } from '../db/settingsRepository';
import { seedDevelopmentData } from '../db/seed';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { initializeAnonymousIdentity } from '../services/anonymousIdentity';
import { verifyBiometricLock } from '../services/biometricLock';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTheme } from '../theme/useTheme';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';
import { fontFamilies, fontSizes } from '../tokens/typography';

type BootstrapState = 'waiting' | 'loading' | 'ready' | 'error';
type LockState = 'unlocked' | 'locked' | 'unlocking';

export function AppBootstrap({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const hasHydrated = useSettingsStore(state => state.hasHydrated);
  const onboardingCompleted = useSettingsStore(
    state => state.onboardingCompleted,
  );
  const setIdentity = useSettingsStore(state => state.setIdentity);
  const settingsState = useSettingsStore();
  const settingsSnapshot = useMemo(
    () => ({
      themeMode: settingsState.themeMode,
      dailyReminderOn: settingsState.dailyReminderOn,
      dailyReminderTime: settingsState.dailyReminderTime,
      letterReminderOn: settingsState.letterReminderOn,
      letterReminderTime: settingsState.letterReminderTime,
      biometricLockOn: settingsState.biometricLockOn,
      defaultCity: settingsState.defaultCity,
      onboardingCompleted: settingsState.onboardingCompleted,
      privacyAcceptedAt: settingsState.privacyAcceptedAt,
    }),
    [
      settingsState.biometricLockOn,
      settingsState.dailyReminderOn,
      settingsState.dailyReminderTime,
      settingsState.defaultCity,
      settingsState.letterReminderOn,
      settingsState.letterReminderTime,
      settingsState.onboardingCompleted,
      settingsState.privacyAcceptedAt,
      settingsState.themeMode,
    ],
  );
  const [bootstrapState, setBootstrapState] =
    useState<BootstrapState>('waiting');
  const [lockState, setLockState] = useState<LockState>('unlocked');
  const initializedLock = useRef(false);

  const unlock = useCallback(async () => {
    setLockState('unlocking');
    try {
      const unlocked = await verifyBiometricLock();
      setLockState(unlocked ? 'unlocked' : 'locked');
    } catch {
      setLockState('locked');
    }
  }, []);

  const initialize = useCallback(async () => {
    setBootstrapState('loading');

    try {
      await seedDevelopmentData();
      await verifyMemoryRoundTrip();
      const identity = await initializeAnonymousIdentity();
      setIdentity(identity.anonymousId, identity.duNumber);
      setBootstrapState('ready');
    } catch (error) {
      console.error('应用初始化失败', error);
      setBootstrapState('error');
    } finally {
      await BootSplash.hide({ fade: true });
    }
  }, [setIdentity]);

  useEffect(() => {
    if (hasHydrated && bootstrapState === 'waiting') {
      initialize().catch(() => undefined);
    }
  }, [bootstrapState, hasHydrated, initialize]);

  useEffect(() => {
    if (bootstrapState === 'ready') {
      saveSettingsSnapshot(settingsSnapshot).catch(error => {
        console.error('设置写入数据库失败', error);
      });
    }
  }, [bootstrapState, settingsSnapshot]);

  useEffect(() => {
    if (bootstrapState !== 'ready' || initializedLock.current) {
      return;
    }
    initializedLock.current = true;
    if (settingsState.biometricLockOn) {
      setLockState('locked');
      unlock().catch(() => undefined);
    }
  }, [bootstrapState, settingsState.biometricLockOn, unlock]);

  useEffect(() => {
    if (!settingsState.biometricLockOn) {
      setLockState('unlocked');
      return;
    }

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background') {
        setLockState('locked');
      } else if (nextState === 'active' && lockState === 'locked') {
        unlock().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [lockState, settingsState.biometricLockOn, unlock]);

  if (bootstrapState === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text }]}>
          本地数据没有准备好
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重试初始化"
          onPress={() => initialize().catch(() => undefined)}
          style={({ pressed }) => [
            styles.retry,
            {
              backgroundColor: colors.seal,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  if (bootstrapState !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingMark, { color: colors.seal }]}>渡</Text>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          正在铺开信纸
        </Text>
      </View>
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingScreen />;
  }

  if (settingsState.biometricLockOn && lockState !== 'unlocked') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.lockMark, { borderColor: colors.seal }]}>
          <Text style={[styles.lockMarkText, { color: colors.seal }]}>渡</Text>
        </View>
        <Text
          style={[styles.message, styles.lockTitle, { color: colors.text }]}
        >
          你的日迹已锁好
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="解锁渡"
          disabled={lockState === 'unlocking'}
          onPress={() => unlock().catch(() => undefined)}
          style={({ pressed }) => [
            styles.retry,
            {
              backgroundColor: colors.seal,
              opacity: lockState === 'unlocking' ? 0.5 : pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={styles.retryText}>
            {lockState === 'unlocking' ? '正在验证' : '验证并解锁'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.page,
  },
  loadingMark: {
    fontFamily: fontFamilies.serif,
    fontSize: 48,
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
    letterSpacing: 2,
  },
  message: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.title,
  },
  lockMark: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.seal,
    transform: [{ rotate: '-3deg' }],
  },
  lockMarkText: {
    fontFamily: fontFamilies.serif,
    fontSize: 28,
  },
  lockTitle: {
    marginTop: spacing.xl,
  },
  retry: {
    marginTop: spacing.lg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
  },
});
