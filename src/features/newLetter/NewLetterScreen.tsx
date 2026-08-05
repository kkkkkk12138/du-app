import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useToast } from '../../components/Toast';
import { useHaptics } from '../../hooks/useHaptics';
import { RootStackParamList } from '../../navigation/RootNavigator';
import {
  requestLetterNotificationAccess,
  scheduleLetterArrivalNotification,
} from '../../services/letterNotifications';
import { useSettingsStore } from '../../store/useSettingsStore';
import { radius } from '../../tokens/radius';
import { fontFamilies } from '../../tokens/typography';
import { useTheme } from '../../theme/useTheme';
import {
  combineArrivalDateAndTime,
  formatArrivalDate,
  getPresetArrivalDate,
  minimumArrivalDate,
} from './futureLetterLogic';
import type { ArrivalPreset } from './futureLetterLogic';
import { createFutureLetter } from './futureLetterRepository';
import { UnifiedArrivalDateTimePicker } from './UnifiedArrivalDateTimePicker';
import { getProfileData } from '../profile/profileRepository';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'NewLetter'>;
type NewLetterRoute = RouteProp<RootStackParamList, 'NewLetter'>;

const options: {
  id: ArrivalPreset;
  icon: string;
  title: string;
  note: string;
}[] = [
  { id: 'one_month', icon: '月', title: '一个月后', note: '适合短期回望' },
  { id: 'half_year', icon: '半', title: '半年后', note: '季节换了一轮' },
  { id: 'next_birthday', icon: '寿', title: '下一个生日', note: '' },
  { id: 'one_year', icon: '年', title: '一年后', note: '最受欢迎' },
  { id: 'three_years', icon: '远', title: '三年后', note: '给更远的自己' },
  {
    id: 'custom',
    icon: '自',
    title: '自己选日子',
    note: '选一个对你重要的日期',
  },
];

function RiverBackground() {
  return (
    <Svg
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
    >
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
  const { colors } = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const letterReminderOn = useSettingsStore(state => state.letterReminderOn);
  const anonymousId = useSettingsStore(state => state.anonymousId);
  const [selection, setSelection] = useState<ArrivalPreset>('one_month');
  const [customDate, setCustomDate] = useState(minimumArrivalDate);
  const [birthday, setBirthday] = useState<Date>();
  const [dateTimePickerOpen, setDateTimePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bloomOpacity = useSharedValue(0);
  const bloomScale = useSharedValue(1);
  const riverOpacity = useSharedValue(0);
  const envelopeProgress = useSharedValue(0);
  const pageOpacity = useSharedValue(1);
  const effectiveSelection =
    selection === 'next_birthday' && !birthday ? 'one_month' : selection;

  const selectedDate = useMemo(() => {
    const date =
      effectiveSelection === 'custom'
        ? customDate
        : getPresetArrivalDate(effectiveSelection, new Date(), birthday);
    return combineArrivalDateAndTime(date, customDate);
  }, [birthday, customDate, effectiveSelection]);
  const draft = route.params?.draft;
  const hasDraftContent = Boolean(
    draft?.content.trim() ||
      draft?.imagePath ||
      draft?.audioPath ||
      draft?.inkImagePath ||
      draft?.placeDetail,
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getProfileData(anonymousId ?? undefined)
        .then(profile => {
          if (active) {
            setBirthday(profile.birthday);
            setSelection(current =>
              current === 'next_birthday' && !profile.birthday
                ? 'one_month'
                : current,
            );
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [anonymousId]),
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
    [bloomOpacity, bloomScale, envelopeProgress, pageOpacity, riverOpacity],
  );

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: bloomScale.value }],
  }));
  const riverStyle = useAnimatedStyle(() => ({
    opacity: riverOpacity.value,
  }));
  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: riverOpacity.value * (1 - envelopeProgress.value),
    transform: [
      { translateX: envelopeProgress.value * 210 },
      { translateY: envelopeProgress.value * 170 },
      { rotate: `${envelopeProgress.value * 3}deg` },
      { scale: 1 - envelopeProgress.value * 0.7 },
    ],
  }));
  const pageStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
  }));

  const resetToLetters = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Letters' } }],
    });
  const departureMessage = (scheduled: boolean) =>
    scheduled ? '信已放入时间长河' : '信已放入时间长河，通知未开启';

  const playDeparture = (notificationScheduled: boolean) => {
    haptics.trigger('seal');
    if (reduceMotion) {
      pageOpacity.value = withTiming(0, { duration: 220 });
      schedule(() => {
        toast.show(departureMessage(notificationScheduled));
        resetToLetters();
      }, 260);
      return;
    }
    bloomOpacity.value = withDelay(150, withTiming(1, { duration: 220 }));
    bloomScale.value = withDelay(
      150,
      withTiming(30, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      }),
    );
    riverOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    pageOpacity.value = withDelay(700, withTiming(0, { duration: 400 }));
    envelopeProgress.value = withDelay(
      1100,
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
      }),
    );
    schedule(() => toast.show(departureMessage(notificationScheduled)), 2000);
    schedule(resetToLetters, 2500);
  };

  const chooseOption = (preset: ArrivalPreset) => {
    if (submitting) {
      return;
    }
    if (preset === 'next_birthday' && !birthday) {
      toast.show('先在个人资料中设置生日');
      navigation.navigate('ProfileEdit');
      return;
    }
    setSelection(preset);
    haptics.trigger('selection');
    if (preset === 'custom') {
      setDateTimePickerOpen(true);
    }
  };

  const sendLetter = async () => {
    if (submitting) {
      return;
    }
    if (!draft || !hasDraftContent) {
      toast.show('这封信还没有内容');
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
      const { letter } = await createFutureLetter({
        draft,
        arriveDate: selectedDate,
        arriveType: effectiveSelection,
      });
      let notificationScheduled = false;
      if (notificationAllowed) {
        try {
          notificationScheduled = await scheduleLetterArrivalNotification({
            letterId: letter.id,
            arriveDate: selectedDate,
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, riverStyle]}
      >
        <RiverBackground />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.departingEnvelope, envelopeStyle]}
      >
        <SmallEnvelope />
      </Animated.View>

      <Animated.View style={[styles.page, pageStyle]}>
        <SafeAreaView
          edges={['left', 'right', 'bottom']}
          style={styles.safeArea}
        >
          <View
            style={[
              styles.topBar,
              { height: 52 + insets.top, paddingTop: insets.top },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回此刻"
              disabled={submitting}
              hitSlop={12}
              onPress={() => navigation.goBack()}
              style={styles.back}
            >
              <Text style={[styles.backText, { color: colors.textFaint }]}>
                ‹ 取消
              </Text>
            </Pressable>
          </View>

          <View style={styles.paper}>
            <View style={styles.paperMarginLine} />
            <View style={styles.titleArea}>
              <Text style={[styles.title, { color: colors.text }]}>
                这封信
                <Text style={{ color: colors.accent }}>何时</Text>
                到达？
              </Text>
              <Text style={[styles.subtitle, { color: colors.textFaint }]}>
                不到时间，你无法打开它。
              </Text>
            </View>
            <View style={styles.options}>
              {options.map(option => {
                const selected = selection === option.id;
                const birthdayMissing =
                  option.id === 'next_birthday' && !birthday;
                const optionCalendarDate =
                  option.id === 'custom'
                    ? customDate
                    : birthdayMissing
                    ? undefined
                    : getPresetArrivalDate(option.id, new Date(), birthday);
                const optionDate = optionCalendarDate
                  ? combineArrivalDateAndTime(optionCalendarDate, customDate)
                  : undefined;
                const optionIconStyle = {
                  backgroundColor: selected
                    ? 'rgba(192,57,43,0.06)'
                    : 'rgba(58,51,45,0.03)',
                };
                const optionCheckStyle = {
                  backgroundColor: selected ? colors.accent : 'transparent',
                  borderColor: selected ? colors.accent : colors.line,
                };
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={option.title}
                    accessibilityState={{ disabled: birthdayMissing, selected }}
                    key={option.id}
                    onPress={() => chooseOption(option.id)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderBottomColor: colors.line,
                        opacity: birthdayMissing ? 0.58 : pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    {selected ? (
                      <View
                        style={[
                          styles.selectedLine,
                          { backgroundColor: colors.accent },
                        ]}
                      />
                    ) : null}
                    <View style={[styles.optionIcon, optionIconStyle]}>
                      <Text
                        style={[
                          styles.optionIconText,
                          {
                            color: selected ? colors.accent : colors.textMuted,
                          },
                        ]}
                      >
                        {option.icon}
                      </Text>
                    </View>
                    <View style={styles.optionText}>
                      <Text
                        style={[
                          styles.optionTitle,
                          { color: selected ? colors.accent : colors.text },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[styles.optionNote, { color: colors.textFaint }]}
                      >
                        {birthdayMissing
                          ? '先在个人资料中设置生日'
                          : `${
                              optionDate ? formatArrivalDate(optionDate) : ''
                            }${option.note ? ` · ${option.note}` : ''}`}
                      </Text>
                    </View>
                    <View style={[styles.optionCheck, optionCheckStyle]}>
                      {selected ? (
                        <Text style={styles.optionCheckMark}>✓</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择到达日期与时间"
              onPress={() => setDateTimePickerOpen(true)}
              style={styles.timeAction}
            >
              <Text
                style={[styles.timeActionLabel, { color: colors.textFaint }]}
              >
                到达时刻
              </Text>
              <Text style={[styles.timeActionValue, { color: colors.accent }]}>
                {String(selectedDate.getHours()).padStart(2, '0')}:
                {String(selectedDate.getMinutes()).padStart(2, '0')}
              </Text>
              <Text
                style={[styles.timeActionHint, { color: colors.textFaint }]}
              >
                一次选择日期与时间 ›
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="封信放入河中"
              disabled={submitting}
              onPress={sendLetter}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: colors.seal,
                  opacity: submitting ? 0.55 : pressed ? 0.82 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text style={styles.sendButtonText}>
                {submitting ? '正在封信……' : '封 信 · 放 入 河 中'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.bloom, { backgroundColor: colors.seal }, bloomStyle]}
      />
      <UnifiedArrivalDateTimePicker
        date={selectedDate}
        minimumDate={minimumArrivalDate()}
        name="new-letter-arrival-date-time"
        visible={dateTimePickerOpen}
        onCancel={() => {
          setDateTimePickerOpen(false);
        }}
        onConfirm={date => {
          setDateTimePickerOpen(false);
          setCustomDate(date);
          setSelection('custom');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  page: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  back: {
    minWidth: 72,
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  backText: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  paper: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 2,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#FEFCF5',
    boxShadow:
      '0 0 0 0.5px rgba(58,51,45,0.06), 0 1px 3px rgba(58,51,45,0.05), 0 6px 20px rgba(58,51,45,0.04)',
  },
  paperMarginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 44,
    width: 0.5,
    backgroundColor: 'rgba(212,168,83,0.12)',
  },
  titleArea: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 24,
  },
  title: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 22,
    lineHeight: 30.8,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 19.2,
    letterSpacing: 0.3,
  },
  options: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 24,
  },
  option: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 16,
    borderBottomWidth: 0.5,
    position: 'relative',
  },
  selectedLine: {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: 2,
    height: 20,
    marginTop: -10,
    borderRadius: 1,
  },
  optionIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  optionIconText: {
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  optionText: { minWidth: 0, flex: 1 },
  optionTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  optionNote: {
    marginTop: 3,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  optionCheck: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 9,
  },
  optionCheckMark: {
    color: '#FFF',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
  },
  timeAction: {
    minHeight: 40,
    marginLeft: 24,
    marginRight: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 2,
    backgroundColor: 'rgba(192,57,43,0.04)',
  },
  timeActionLabel: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  timeActionValue: {
    marginLeft: 10,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 15,
    letterSpacing: 1,
  },
  timeActionHint: {
    marginLeft: 'auto',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  footer: {
    marginHorizontal: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  sendButton: {
    minWidth: 200,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 4,
    boxShadow:
      '0 2px 10px rgba(192,57,43,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
    transform: [{ rotate: '-0.5deg' }],
  },
  sendButtonText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 16,
    letterSpacing: 4,
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
    transform: [{ rotate: '45deg' }],
  },
  envelopeFoldRight: {
    position: 'absolute',
    right: -22,
    bottom: -30,
    width: 76,
    height: 76,
    backgroundColor: '#CEB58C',
    transform: [{ rotate: '45deg' }],
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
