import React, {forwardRef} from 'react';
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextProps,
} from 'react-native';

export const AppText = forwardRef<NativeText, TextProps>(function renderAppText(
  {style, ...props},
  ref,
) {
  const androidProps =
    Platform.OS === 'android'
      ? {
          allowFontScaling: false,
          android_hyphenationFrequency: 'none' as const,
          maxFontSizeMultiplier: 1,
          textBreakStrategy: 'simple' as const,
        }
      : {};

  return (
    <NativeText
      {...props}
      {...androidProps}
      ref={ref}
      style={[Platform.OS === 'android' ? styles.android : null, style]}
    />
  );
});

const styles = StyleSheet.create({
  android: {
    includeFontPadding: false,
  },
});
