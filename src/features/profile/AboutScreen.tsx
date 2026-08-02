import React from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';

import {useToast} from '../../components/Toast';
import {useHaptics} from '../../hooks/useHaptics';
import {useTheme} from '../../theme/useTheme';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {
  fontFamilies,
  fontSizes,
  lineHeights,
} from '../../tokens/typography';

export function AboutScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const toast = useToast();
  const haptics = useHaptics();

  const openFeedback = async () => {
    haptics.trigger('button');

    try {
      await Linking.openURL(
        `mailto:?subject=${encodeURIComponent('渡 App 使用反馈')}`,
      );
    } catch {
      toast.show('暂时无法打开邮件应用');
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => navigation.goBack()}
          style={({pressed}) => [
            styles.back,
            {opacity: pressed ? 0.6 : 1},
          ]}>
          <Text style={[styles.backText, {color: colors.textSoft}]}>‹ 我</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={[styles.seal, {backgroundColor: colors.seal}]}>
          <Text style={styles.sealText}>渡</Text>
        </View>
        <Text style={[styles.title, {color: colors.text}]}>渡</Text>
        <Text style={[styles.version, {color: colors.textMuted}]}>
          Version 0.0.1
        </Text>
        <Text style={[styles.description, {color: colors.textSoft}]}>
          把此刻落下，等时间寄回来。
        </Text>

        <View
          style={[
            styles.list,
            {backgroundColor: colors.surface, borderColor: colors.line},
          ]}>
          <AboutRow
            label="隐私政策"
            onPress={() => {
              haptics.trigger('button');
              toast.show('即将上线');
            }}
          />
          <View style={[styles.divider, {backgroundColor: colors.line}]} />
          <AboutRow
            label="意见反馈"
            onPress={() => openFeedback().catch(() => undefined)}
          />
        </View>

        <Text style={[styles.copyright, {color: colors.textFaint}]}>
          © 2026
        </Text>
      </View>
    </SafeAreaView>
  );
}

function AboutRow({label, onPress}: {label: string; onPress: () => void}) {
  const {colors} = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        {
          opacity: pressed ? 0.92 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
        },
      ]}>
      <Text style={[styles.rowText, {color: colors.text}]}>{label}</Text>
      <Text style={[styles.chevron, {color: colors.textMuted}]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: spacing.navbar,
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
  },
  backText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.body,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxxl,
  },
  seal: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.seal,
    transform: [{rotate: '-3deg'}],
  },
  sealText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serif,
    fontSize: 38,
  },
  title: {
    marginTop: spacing.xl,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    lineHeight: lineHeights.h1,
  },
  version: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
  },
  description: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  list: {
    width: '100%',
    marginTop: spacing.xxxl,
    borderWidth: 0.5,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  rowText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
  },
  chevron: {
    fontSize: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
  copyright: {
    marginTop: 'auto',
    marginBottom: spacing.xxl,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
});
