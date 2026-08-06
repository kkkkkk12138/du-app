import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHaptics } from '../../hooks/useHaptics';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { shadows } from '../../tokens/shadows';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes, lineHeights } from '../../tokens/typography';

const pages = [
  {
    mark: '落',
    eyebrow: '每天写几句',
    title: '把此刻，轻轻落下',
    body: '不用想好，也不必完整。\n一句话、一段声音，都是今天来过的痕迹。',
  },
  {
    mark: '信',
    eyebrow: '收一封未来的信',
    title: '让时间替你保管',
    body: '写给未来的自己。\n在约定的日子到来前，这封信不会被提前打开。',
  },
  {
    mark: '例',
    eyebrow: '先翻几页看看',
    title: '初见的内容，只作示范',
    body: '刚开始时，日迹、信、念想与副本中会放入少量参考内容。\n它们都可以删除，也不会影响你之后写下的真实记录。',
  },
  {
    mark: '守',
    eyebrow: '只有你能看',
    title: '你的日记，留在本地',
    body: 'v1 的文字、照片与声音只保存在设备中，\n不会上传给第三方分析或训练。',
  },
] as const;

export function OnboardingScreen() {
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const completeOnboarding = useSettingsStore(
    state => state.completeOnboarding,
  );
  const [page, setPage] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const current = pages[page];
  const isLast = page === pages.length - 1;
  const disabled = isLast && !accepted;
  const checkboxBackground = accepted ? colors.accent : 'transparent';
  const buttonBackground = disabled ? colors.surfaceAged : colors.seal;
  const buttonTextColor = disabled ? colors.textMuted : '#FFF8F0';

  const goNext = () => {
    haptics.trigger('button');

    if (!isLast) {
      setPage(value => value + 1);
      return;
    }

    if (accepted) {
      completeOnboarding();
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.textMuted }]}>渡 · DU</Text>
        <Text style={[styles.pageNumber, { color: colors.textFaint }]}>
          {page + 1} / {pages.length}
        </Text>
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.mark,
            shadows.seal,
            {
              backgroundColor: colors.seal,
            },
          ]}
        >
          <Text style={styles.markText}>{current.mark}</Text>
        </View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          {current.eyebrow}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {current.title}
        </Text>
        <Text style={[styles.body, { color: colors.textSoft }]}>
          {current.body}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === page ? styles.activeDot : null,
                {
                  backgroundColor:
                    index === page ? colors.accent : colors.textFaint,
                },
              ]}
            />
          ))}
        </View>

        {isLast ? (
          <View style={styles.consent}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              accessibilityLabel="同意隐私政策"
              hitSlop={8}
              onPress={() => {
                haptics.trigger('selection');
                setAccepted(value => !value);
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: accepted ? colors.accent : colors.textMuted,
                    backgroundColor: checkboxBackground,
                  },
                ]}
              >
                <Text style={styles.checkmark}>{accepted ? '✓' : ''}</Text>
              </View>
            </Pressable>
            <Text style={[styles.consentText, { color: colors.textSoft }]}>
              我已阅读并同意
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="阅读隐私政策"
              onPress={() => setPrivacyOpen(true)}
            >
              <Text style={[styles.privacyLink, { color: colors.accent }]}>
                《隐私政策》
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.consentPlaceholder} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? '同意隐私政策并开始' : '继续'}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={goNext}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: buttonBackground,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: buttonTextColor }]}>
            {isLast ? '同意隐私政策并开始' : '继续'}
          </Text>
        </Pressable>
      </View>
      <Modal
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setPrivacyOpen(false)}
        presentationStyle="pageSheet"
        visible={privacyOpen}
      >
        <SafeAreaView
          style={[styles.privacyPage, { backgroundColor: colors.background }]}
        >
          <View style={styles.privacyHeader}>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>
              隐私政策
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭隐私政策"
              onPress={() => setPrivacyOpen(false)}
            >
              <Text style={[styles.privacyDone, { color: colors.accent }]}>
                完成
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.privacyContent}>
            <Text style={[styles.privacyBody, { color: colors.textSoft }]}>
              渡默认将你的文字、照片、录音、手书、地点标签和未来信保存在本机。
              相机、相册、麦克风、位置、通知与生物识别权限只在你主动使用对应功能时申请。
              {'\n\n'}
              当前版本不包含第三方崩溃采集或分析工具。若以后改变数据处理方式，渡会先更新隐私说明。
              {'\n\n'}
              渡不出售个人数据，不将日记内容用于广告画像或模型训练。只有当你主动使用系统分享时，所选内容才会交给你选择的目标应用。
              {'\n\n'}
              当前版本尚未提供账号同步。卸载应用或清除应用数据会移除保存在本机的内容。
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.page,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
  brand: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
  },
  pageNumber: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  mark: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.seal,
    transform: [{ rotate: '-3deg' }],
  },
  markText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serif,
    fontSize: 44,
  },
  eyebrow: {
    marginTop: spacing.xxxl,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
    letterSpacing: 2,
  },
  title: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    lineHeight: lineHeights.h1,
  },
  body: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  footer: {
    paddingBottom: spacing.xxl,
  },
  dots: {
    height: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.round,
  },
  activeDot: {
    width: 18,
  },
  consent: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  consentPlaceholder: {
    height: 36,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: radius.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkmark: {
    color: '#FFF8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  consentText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  privacyLink: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  privacyPage: {
    flex: 1,
  },
  privacyHeader: {
    height: 44,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.title,
  },
  privacyDone: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.body,
  },
  privacyContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: 40,
  },
  privacyBody: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    lineHeight: 25,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pillLarge,
  },
  buttonText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.title,
    letterSpacing: 1,
  },
});
