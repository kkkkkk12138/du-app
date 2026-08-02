import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {StyleSheet, Text} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {fontFamilies, fontSizes} from '../tokens/typography';
import {spacing} from '../tokens/spacing';
import {useTheme} from '../theme/useTheme';

type ToastContextValue = {
  show: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({children}: PropsWithChildren) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    opacity.value = withTiming(0, {duration: 300});
    translateY.value = withTiming(20, {duration: 300});
  }, [opacity, translateY]);

  const show = useCallback(
    (nextMessage: string, duration = 3000) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      setMessage(nextMessage);
      opacity.value = withTiming(1, {duration: 300});
      translateY.value = withTiming(0, {duration: 300});
      timer.current = setTimeout(hide, duration);
    },
    [hide, opacity, translateY],
  );

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}],
  }));

  return (
    <ToastContext.Provider value={{show}}>
      {children}
      <Animated.View
        accessibilityLiveRegion="polite"
        pointerEvents="none"
        style={[
          styles.toast,
          {
            bottom: Math.max(insets.bottom, spacing.md) + 82,
            backgroundColor: colors.toastBackground,
          },
          animatedStyle,
        ]}>
        <Text style={[styles.text, {color: colors.toastText}]}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }

  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '84%',
    borderRadius: 20,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    zIndex: 999,
  },
  text: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
    letterSpacing: 0.5,
  },
});
