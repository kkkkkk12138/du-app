import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DatePicker from 'react-native-date-picker';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Path, Rect, Stop} from 'react-native-svg';

import {useToast} from '../../components/Toast';
import {useHaptics} from '../../hooks/useHaptics';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {
  requestLetterNotificationAccess,
  scheduleLetterArrivalNotification,
} from '../../services/letterNotifications';
import {useSettingsStore} from '../../store/useSettingsStore';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {fontFamilies, fontSizes, lineHeights} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';
import {
  formatArrivalDate,
  getPresetArrivalDate,
  minimumArrivalDate,
  startOfLocalDay,
} from './futureLetterLogic';
import type {ArrivalPreset} from './futureLetterLogic';
import {createFutureLetter} from './futureLetterRepository';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'NewLetter'>;
type NewLetterRoute = RouteProp<RootStackParamList, 'NewLetter'>;

const options: {id: ArrivalPreset; title: string; note: string}[] = [
  {id: 'one_year', title: '一年后', note: '再走过一轮四季'},
  {id: 'half_year', title: '半年后', note: '季节刚好换一面'},
  {id: 'three_months', title: '三个月后', note: '留给不远的以后'},
  {id: 'custom', title: '自定义', note: '选一个你记得的日子'},
];

function RiverBackground() {
  return (
    <Svg
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="river" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D9E0DB" />
          <Stop offset="0.55" stopColor="#BECBD0" />
          <Stop offset="1" stopColor="#8FA8B2" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill="url(#river)" />
      <Path
        d="M-10 62 C18 46 36 76 62 57 C78 45 92 53 110 40"
        fill="none"
        opacity={0.24}
        stroke="#F6F1E7"
        strokeWidth="12"
      />
      <Path
        d="M-10 78 C18 61 40 86 68 69 C85 58 99 61 112 53"
        fill="none"
        opacity={0.16}
        stroke="#516D78"
        strokeWidth="5"
      />
    </Svg>
  );
}

function SmallEnvelope() {
  return (
    <View style={styles.smallEnvelope}>
      <View style={styles.envelopeFoldLeft} />
      <View style={styles.envelopeFoldRight} />
      <View style={styles.envelopeSeal}>
        <Text style={styles.envelopeSealText}>渡</Text>
      </View>
    </View>
  );
}

export function NewLetterScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<NewLetterRoute>();
  const {colors, isDark} = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const letterReminderOn = useSettingsStore(state => state.letterReminderOn);
  const letterReminderTime = useSettingsStore(
    state => state.letterReminderTime,
  );
  const [selection, setSelection] = useState<ArrivalPreset>('one_year');
  const [customDate, setCustomDate] = useState(minimumArrivalDate);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bloomOpacity = useSharedValue(0);
  const bloomScale = useSharedValue(1);
  const riverOpacity = useSharedValue(0);
  const envelopeProgress = useSharedValue(0);
  const pageOpacity = useSharedValue(1);

  const selectedDate = useMemo(
    () =>
      selection === 'custom'
        ? startOfLocalDay(customDate)
        : getPresetArrivalDate(selection),
    [customDate, selection],
  );

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const schedule = (callback: () => void, delay: number) => {
    timers.current.push(setTimeout(callback, delay));
  };

  useEffect(
    () => () => {
      clearTimers();
      [
        bloomOpacity,
        bloomScale,
        riverOpacity,
        envelopeProgress,
        pageOpacity,
      ].forEach(cancelAnimation);
    },
    [
      bloomOpacity,
      bloomScale,
      envelopeProgress,
      pageOpacity,
      riverOpacity,
    ],
  );

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{scale: bloomScale.value}],
  }));
  const riverStyle = useAnimatedStyle(() => ({
    opacity: riverOpacity.value,
  }));
  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: riverOpacity.value * (1 - envelopeProgress.value),
    transform: [
      {translateX: envelopeProgress.value * 210},
      {translateY: envelopeProgress.value * 170},
      {rotate: `${envelopeProgress.value * 3}deg`},
      {scale: 1 - envelopeProgress.value * 0.7},
    ],
  }));
  const pageStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
  }));

  const resetToLetters = () =>
    navigation.reset({
      index: 0,
      routes: [{name: 'Main', params: {screen: 'Letters'}}],
    });
  const departureMessage = (scheduled: boolean) =>
    scheduled
      ? '信已放入时间长河'
      : '信已放入时间长河，通知未开启';

  const playDeparture = (notificationScheduled: boolean) => {
    haptics.trigger('seal');
    if (reduceMotion) {
      pageOpacity.value = withTiming(0, {duration: 220});
      schedule(() => {
        toast.show(departureMessage(notificationScheduled));
        resetToLetters();
      }, 260);
      return;
    }
    bloomOpacity.value = withDelay(150, withTiming(1, {duration: 220}));
    bloomScale.value = withDelay(
      150,
      withTiming(30, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      }),
    );
    riverOpacity.value = withDelay(700, withTiming(1, {duration: 400}));
    pageOpacity.value = withDelay(700, withTiming(0, {duration: 400}));
    envelopeProgress.value = withDelay(
      1100,
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
      }),
    );
    schedule(
      () => toast.show(departureMessage(notificationScheduled)),
      2000,
    );
    schedule(resetToLetters, 2500);
  };

  const chooseOption = (preset: ArrivalPreset) => {
    if (submitting) {
      return;
    }
    setSelection(preset);
    haptics.trigger('selection');
    if (preset === 'custom') {
      setPickerOpen(true);
    }
  };

  const sendLetter = async () => {
    if (submitting) {
      return;
    }
    const draft = route.params?.draft;
    if (!draft?.content.trim()) {
      toast.show('这封信还没有正文');
      return;
    }
    setSubmitting(true);

    let notificationAllowed = false;
    if (letterReminderOn) {
      try {
        notificationAllowed = await requestLetterNotificationAccess();
      } catch (error) {
        console.warn('通知权限请求失败', error);
      }
    }

    try {
      const {letter} = await createFutureLetter({
        draft,
        arriveDate: selectedDate,
        arriveType: selection,
      });
      let notificationScheduled = false;
      if (notificationAllowed) {
        try {
          notificationScheduled =
            await scheduleLetterArrivalNotification({
              letterId: letter.id,
              arriveDate: selectedDate,
              reminderTime: letterReminderTime,
            });
        } catch (error) {
          console.warn('未来信通知调度失败', error);
        }
      }
      playDeparture(notificationScheduled);
    } catch (error) {
      console.error('保存未来信失败', error);
      setSubmitting(false);
      toast.show('信没有放稳，请再试一次');
    }
  };

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, riverStyle]}>
        <RiverBackground />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.departingEnvelope, envelopeStyle]}>
        <SmallEnvelope />
      </Animated.View>

      <Animated.View style={[styles.page, pageStyle]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回此刻"
              disabled={submitting}
              hitSlop={12}
              onPress={() => navigation.goBack()}
              style={styles.back}>
              <Text style={[styles.backText, {color: colors.textSoft}]}>
                ‹ 此刻
              </Text>
            </Pressable>
            <Text style={[styles.eyebrow, {color: colors.accent}]}>
              LETTER TO THE FUTURE
            </Text>
            <Text style={[styles.title, {color: colors.text}]}>
              让它在那一天靠岸
            </Text>
            <Text style={[styles.subtitle, {color: colors.textMuted}]}>
              在到达之前，这封信不会被提前打开
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.paper,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}>
              <Text
                numberOfLines={3}
                style={[styles.preview, {color: colors.textSoft}]}>
                {route.params?.draft.content}
              </Text>
              <View style={[styles.paperRule, {backgroundColor: colors.line}]} />
              <Text style={[styles.arrivalLabel, {color: colors.textFaint}]}>
                预计到达
              </Text>
              <Text style={[styles.arrivalDate, {color: colors.accent}]}>
                {formatArrivalDate(selectedDate)}
              </Text>
            </View>

            <Text style={[styles.sectionLabel, {color: colors.textMuted}]}>
              选一段时间
            </Text>
            <View style={styles.options}>
              {options.map(option => {
                const selected = selection === option.id;
                const optionDate =
                  option.id === 'custom'
                    ? customDate
                    : getPresetArrivalDate(option.id);
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={option.title}
                    accessibilityState={{selected}}
                    key={option.id}
                    onPress={() => chooseOption(option.id)}
                    style={({pressed}) => [
                      styles.option,
                      {
                        backgroundColor: selected
                          ? colors.surfaceAged
                          : colors.surface,
                        borderColor: selected ? colors.accent : colors.line,
                        opacity: pressed ? 0.78 : 1,
                        transform: [{scale: pressed ? 0.98 : 1}],
                      },
                    ]}>
                    <View style={styles.optionText}>
                      <Text
                        style={[
                          styles.optionTitle,
                          {color: selected ? colors.accent : colors.text},
                        ]}>
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.optionNote,
                          {color: colors.textMuted},
                        ]}>
                        {option.note}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionDate,
                        {color: selected ? colors.accent : colors.textFaint},
                      ]}>
                      {formatArrivalDate(optionDate)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={[styles.promise, {color: colors.textFaint}]}>
              {letterReminderOn
                ? `到达日当天 ${letterReminderTime} 提醒你`
                : '未来信提醒已关闭'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="封信放入河中"
              disabled={submitting}
              onPress={sendLetter}
              style={({pressed}) => [
                styles.sendButton,
                {
                  backgroundColor: colors.seal,
                  opacity: submitting ? 0.55 : pressed ? 0.82 : 1,
                  transform: [{scale: pressed ? 0.96 : 1}],
                },
              ]}>
              <Text style={styles.sendButtonText}>
                {submitting ? '正在封信……' : '封信 · 放入河中'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.bloom,
          {backgroundColor: colors.seal},
          bloomStyle,
        ]}
      />
      <DatePicker
        modal
        cancelText="取消"
        confirmText="选这一天"
        date={customDate}
        locale="zh-CN"
        minimumDate={minimumArrivalDate()}
        mode="date"
        open={pickerOpen}
        theme={isDark ? 'dark' : 'light'}
        title="选择到达日期"
        onCancel={() => setPickerOpen(false)}
        onConfirm={date => {
          setPickerOpen(false);
          setCustomDate(startOfLocalDay(date));
          setSelection('custom');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, overflow: 'hidden'},
  page: {flex: 1},
  safeArea: {flex: 1},
  header: {
    paddingHorizontal: spacing.greeting,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  back: {
    minWidth: 72,
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  backText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.bodyLarge,
  },
  eyebrow: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 4,
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    lineHeight: lineHeights.h1,
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    lineHeight: lineHeights.secondary,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  paper: {
    padding: spacing.xl,
    borderWidth: 0.5,
    borderRadius: radius.image,
    boxShadow: '0 10px 24px rgba(70, 48, 30, 0.08)',
  },
  preview: {
    minHeight: 62,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  paperRule: {height: 0.5, marginVertical: spacing.lg},
  arrivalLabel: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
  },
  arrivalDate: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.title,
    letterSpacing: 1,
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
  },
  options: {gap: spacing.sm},
  option: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 0.8,
    borderRadius: radius.image,
  },
  optionText: {minWidth: 0, flex: 1},
  optionTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.bodyLarge,
  },
  optionNote: {
    marginTop: spacing.xxs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
  },
  optionDate: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.secondary,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  promise: {
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 0.5,
  },
  sendButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.image,
    boxShadow: '0 5px 14px rgba(100, 28, 15, 0.24)',
  },
  sendButtonText: {
    color: '#FFF5E8',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.bodyLarge,
    letterSpacing: 2,
  },
  bloom: {
    position: 'absolute',
    right: -10,
    bottom: 10,
    width: 54,
    height: 54,
    borderRadius: radius.round,
    opacity: 0,
  },
  departingEnvelope: {
    position: 'absolute',
    top: '43%',
    left: '50%',
    zIndex: 6,
    marginLeft: -50,
  },
  smallEnvelope: {
    width: 100,
    height: 64,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#E8D6B4',
    boxShadow: '0 8px 20px rgba(45, 55, 60, 0.2)',
  },
  envelopeFoldLeft: {
    position: 'absolute',
    bottom: -30,
    left: -22,
    width: 76,
    height: 76,
    backgroundColor: '#D7C29C',
    transform: [{rotate: '45deg'}],
  },
  envelopeFoldRight: {
    position: 'absolute',
    right: -22,
    bottom: -30,
    width: 76,
    height: 76,
    backgroundColor: '#CEB58C',
    transform: [{rotate: '45deg'}],
  },
  envelopeSeal: {
    position: 'absolute',
    top: 21,
    left: 40,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: '#7B2114',
  },
  envelopeSealText: {
    color: '#3E0D07',
    fontFamily: fontFamilies.serif,
    fontSize: 9,
  },
});
