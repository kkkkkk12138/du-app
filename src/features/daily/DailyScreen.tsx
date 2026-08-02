import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

import {PlaceholderScreen} from '../../components/PlaceholderScreen';
import {useToast} from '../../components/Toast';
import {useHaptics} from '../../hooks/useHaptics';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {fontFamilies, fontSizes} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';

export function DailyScreen() {
  const {colors} = useTheme();
  const toast = useToast();
  const haptics = useHaptics();

  const showToast = () => {
    haptics.trigger('button');
    toast.show('此刻不落，就散了');
  };

  return (
    <PlaceholderScreen title="日迹">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="显示提示"
        onPress={showToast}
        style={({pressed}) => [
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            opacity: pressed ? 0.92 : 1,
            transform: [{scale: pressed ? 0.98 : 1}],
          },
        ]}>
        <Text style={[styles.buttonText, {color: colors.textSoft}]}>
          试试提示
        </Text>
      </Pressable>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: radius.paper,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
  },
});
