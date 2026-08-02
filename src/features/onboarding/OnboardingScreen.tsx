import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useHaptics} from '../../hooks/useHaptics';
import {useSettingsStore} from '../../store/useSettingsStore';
import {useTheme} from '../../theme/useTheme';
import {radius} from '../../tokens/radius';
import {shadows} from '../../tokens/shadows';
import {spacing} from '../../tokens/spacing';
import {
  fontFamilies,
  fontSizes,
  lineHeights,
} from '../../tokens/typography';

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
    mark: '守',
    eyebrow: '只有你能看',
    title: '你的日记，留在本地',
    body: 'v1 的文字、照片与声音只保存在设备中，\n不会上传给第三方分析或训练。',
  },
] as const;

export function OnboardingScreen() {
  const {colors} = useTheme();
  const haptics = useHaptics();
  const completeOnboarding = useSettingsStore(
    state => state.completeOnboarding,
  );
  const [page, setPage] = useState(0);
  const [accepted, setAccepted] = useState(false);
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
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Text style={[styles.brand, {color: colors.textMuted}]}>渡 · DU</Text>
        <Text style={[styles.pageNumber, {color: colors.textFaint}]}>
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
          ]}>
          <Text style={styles.markText}>{current.mark}</Text>
        </View>
        <Text style={[styles.eyebrow, {color: colors.accent}]}>
          {current.eyebrow}
        </Text>
        <Text style={[styles.title, {color: colors.text}]}>
          {current.title}
        </Text>
        <Text style={[styles.body, {color: colors.textSoft}]}>
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
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{checked: accepted}}
            accessibilityLabel="同意隐私政策"
            onPress={() => {
              haptics.trigger('selection');
              setAccepted(value => !value);
            }}
            style={({pressed}) => [
              styles.consent,
              {opacity: pressed ? 0.92 : 1},
            ]}>
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: accepted ? colors.accent : colors.textMuted,
                  backgroundColor: checkboxBackground,
                },
              ]}>
              <Text style={styles.checkmark}>{accepted ? '✓' : ''}</Text>
            </View>
            <Text style={[styles.consentText, {color: colors.textSoft}]}>
              我已阅读并同意
              <Text style={{color: colors.accent}}>《隐私政策》</Text>
            </Text>
          </Pressable>
        ) : (
          <View style={styles.consentPlaceholder} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? '同意隐私政策并开始' : '继续'}
          accessibilityState={{disabled}}
          disabled={disabled}
          onPress={goNext}
          style={({pressed}) => [
            styles.button,
            {
              backgroundColor: buttonBackground,
              opacity: pressed ? 0.92 : 1,
              transform: [{scale: pressed ? 0.98 : 1}],
            },
          ]}>
          <Text
            style={[
              styles.buttonText,
              {color: buttonTextColor},
            ]}>
            {isLast ? '同意隐私政策并开始' : '继续'}
          </Text>
        </Pressable>
      </View>
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
    transform: [{rotate: '-3deg'}],
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
