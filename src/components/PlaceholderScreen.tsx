import React, {ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {fontFamilies, fontSizes, lineHeights} from '../tokens/typography';
import {spacing} from '../tokens/spacing';
import {useTheme} from '../theme/useTheme';

type PlaceholderScreenProps = {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
};

export function PlaceholderScreen({
  title,
  eyebrow = '渡 · DU',
  children,
}: PlaceholderScreenProps) {
  const {colors} = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, {color: colors.textMuted}]}>
          {eyebrow}
        </Text>
        <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
        <View style={[styles.rule, {backgroundColor: colors.accent}]} />
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.page,
  },
  eyebrow: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    lineHeight: lineHeights.h1,
    fontWeight: '400',
  },
  rule: {
    width: 22,
    height: 2,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
