import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {PlaceholderScreen} from '../../components/PlaceholderScreen';
import {useHaptics} from '../../hooks/useHaptics';
import {ThemeMode} from '../../store/useSettingsStore';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {fontFamilies, fontSizes} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';

const options: Array<{label: string; value: ThemeMode}> = [
  {label: '跟随系统', value: 'system'},
  {label: '浅色', value: 'light'},
  {label: '深色', value: 'dark'},
];

export function ProfileScreen() {
  const {colors, mode, setMode} = useTheme();
  const haptics = useHaptics();

  const selectMode = (nextMode: ThemeMode) => {
    haptics.trigger('selection');
    setMode(nextMode);
  };

  return (
    <PlaceholderScreen title="我">
      <Text style={[styles.label, {color: colors.textMuted}]}>深色模式</Text>
      <View style={[styles.group, {borderColor: colors.line}]}>
        {options.map(option => {
          const selected = option.value === mode;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{checked: selected}}
              accessibilityLabel={option.label}
              key={option.value}
              onPress={() => selectMode(option.value)}
              style={({pressed}) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.surfaceAged : colors.surface,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{scale: pressed ? 0.98 : 1}],
                },
              ]}>
              <Text
                style={[
                  styles.optionText,
                  {color: selected ? colors.accent : colors.textSoft},
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
    marginBottom: spacing.sm,
  },
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.paper,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
  },
});
