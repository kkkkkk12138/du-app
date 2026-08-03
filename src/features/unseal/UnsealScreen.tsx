import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useToast } from '../../components/Toast';
import { useHaptics } from '../../hooks/useHaptics';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { cancelLetterArrivalNotification } from '../../services/letterNotifications';
import { removeMediaFile } from '../../services/mediaStorage';
import { primitiveColors } from '../../tokens/colors';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes, lineHeights } from '../../tokens/typography';
import {
  deleteLetter,
  getLetterDetail,
  LetterWithMemory,
  markLetterOpened,
} from '../letters/lettersRepository';
import { LetterReadingView } from './LetterReadingView';

type UnsealNavigation = NativeStackNavigationProp<RootStackParamList, 'Unseal'>;
type UnsealRoute = RouteProp<RootStackParamList, 'Unseal'>;

function formatDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
}

function LetterBackground() {
  return (
    <Svg
      pointerEvents="none"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
    >
      <Defs>
        <LinearGradient id="riverPaper" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#EDE4D0" />
          <Stop offset="1" stopColor="#E0D6BF" />
        </LinearGradient>
        <RadialGradient id="riverGlow" cx="50%" cy="43%" r="42%">
          <Stop offset="0" stopColor="#FFF8E6" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFF8E6" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100" height="100" fill="url(#riverPaper)" />
      <Rect width="100" height="100" fill="url(#riverGlow)" />
    </Svg>
  );
}

function EnvelopeBase() {
  return (
    <Svg
      height="100%"
      width="100%"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 260 175"
    >
      <Defs>
        <LinearGradient id="envelopeBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E2CEA8" />
          <Stop offset="0.48" stopColor="#D4BE94" />
          <Stop offset="1" stopColor="#C8AE82" />
        </LinearGradient>
        <LinearGradient id="leftFold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D8C29A" />
          <Stop offset="1" stopColor="#CCB488" />
        </LinearGradient>
        <LinearGradient id="rightFold" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D0BA90" />
          <Stop offset="1" stopColor="#C4AA7E" />
        </LinearGradient>
      </Defs>
      <Rect width="260" height="175" rx="2" fill="url(#envelopeBody)" />
      <Polygon points="0,0 135,76 135,175 0,175" fill="url(#leftFold)" />
      <Polygon points="125,76 260,0 260,175 125,175" fill="url(#rightFold)" />
    </Svg>
  );
}

function EnvelopeTop() {
  return (
    <Svg
      height="100%"
      width="100%"
      preserveAspectRatio="none"
      viewBox="0 0 260 102"
    >
      <Defs>
        <LinearGradient id="envelopeTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DCC8A3" />
          <Stop offset="1" stopColor="#CEB78D" />
        </LinearGradient>
      </Defs>
      <Polygon points="0,0 260,0 130,102" fill="url(#envelopeTop)" />
    </Svg>
  );
}

function WaxSeal({ small = false }: { small?: boolean }) {
  return (
    <View style={small ? styles.miniWax : styles.wax}>
      <View style={styles.waxDisk}>
        <View style={styles.waxImprint}>
          <Text style={small ? styles.miniWaxText : styles.waxText}>渡</Text>
        </View>
      </View>
    </View>
  );
}

export function UnsealScreen() {
  const navigation = useNavigation<UnsealNavigation>();
  const route = useRoute<UnsealRoute>();
  const toast = useToast();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const [item, setItem] = useState<LetterWithMemory | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sealProgress = useSharedValue(0);
  const flapProgress = useSharedValue(0);
  const previewProgress = useSharedValue(0);
  const sealedProgress = useSharedValue(1);
  const openProgress = useSharedValue(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    let active = true;
    getLetterDetail(route.params?.letterId)
      .then(result => {
        if (!active) {
          return;
        }
        setItem(result);
        if (result.letter.status === 'opened' || result.letter.openedAt) {
          setOpened(true);
          sealedProgress.value = 0;
          openProgress.value = 1;
        }
      })
      .catch(error => {
        console.error('读取信件失败', error);
        if (active) {
          setLoadingError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [openProgress, route.params?.letterId, sealedProgress]);

  useEffect(
    () => () => {
      clearTimers();
      [
        sealProgress,
        flapProgress,
        previewProgress,
        sealedProgress,
        openProgress,
      ].forEach(cancelAnimation);
    },
    [
      clearTimers,
      flapProgress,
      openProgress,
      previewProgress,
      sealProgress,
      sealedProgress,
    ],
  );

  const sealStyle = useAnimatedStyle(() => ({
    opacity: 1 - sealProgress.value,
    transform: [{ scale: 1 - sealProgress.value * 0.4 }],
  }));
  const flapStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${-170 * flapProgress.value}deg` },
    ],
  }));
  const previewStyle = useAnimatedStyle(() => ({
    opacity: previewProgress.value,
    transform: [
      { translateY: 70 - previewProgress.value * 108 },
      { scale: 0.92 + previewProgress.value * 0.08 },
      { rotateY: `${-2 + previewProgress.value * 2}deg` },
    ],
  }));
  const sealedStyle = useAnimatedStyle(() => ({
    opacity: sealedProgress.value,
    transform: [{ scale: 0.96 + sealedProgress.value * 0.04 }],
  }));
  const openStyle = useAnimatedStyle(() => ({
    opacity: openProgress.value,
    transform: [{ translateY: -20 * (1 - openProgress.value) }],
  }));

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timers.current.push(timer);
  };

  const openLetter = () => {
    if (!item || opening || opened) {
      return;
    }
    setOpening(true);
    haptics.trigger('button');

    if (reduceMotion) {
      sealedProgress.value = withTiming(0, { duration: 220 });
      openProgress.value = withDelay(100, withTiming(1, { duration: 300 }));
      schedule(() => {
        setOpened(true);
        markLetterOpened(item.letter).catch(error =>
          console.error('更新拆信状态失败', error),
        );
        haptics.trigger('envelopeOpen');
      }, 400);
      return;
    }

    sealProgress.value = withTiming(1, {
      duration: 300,
      easing: Easing.in(Easing.cubic),
    });
    flapProgress.value = withDelay(
      200,
      withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.3, 0.05, 0.2, 1),
      }),
    );
    previewProgress.value = withDelay(
      500,
      withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      }),
    );
    sealedProgress.value = withDelay(1200, withTiming(0, { duration: 400 }));
    openProgress.value = withDelay(
      1700,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      }),
    );
    schedule(() => haptics.trigger('record'), 350);
    schedule(() => {
      setOpened(true);
      haptics.trigger('envelopeOpen');
      markLetterOpened(item.letter).catch(error =>
        console.error('更新拆信状态失败', error),
      );
    }, 2100);
  };

  const goBack = () => {
    clearTimers();
    navigation.popTo('Main', {
      screen: route.params?.source === 'daily' ? 'Daily' : 'Letters',
    });
  };

  const goToWrite = () => {
    clearTimers();
    navigation.popTo('Main', { screen: 'Write' });
  };

  const saveToDaily = () => {
    toast.show('已收进日迹');
    schedule(() => {
      clearTimers();
      navigation.popTo('Main', { screen: 'Daily' });
    }, 600);
  };

  const confirmDelete = () => {
    if (!item || deleting) {
      return;
    }
    Alert.alert(
      item.letter.status === 'reply' ? '删除这封回信？' : '删除这封信？',
      '信件内容会永久移除，此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            deleteLetter(item)
              .then(() =>
                Promise.allSettled([
                  cancelLetterArrivalNotification(item.letter.id),
                  removeMediaFile(item.memory.imagePath),
                  removeMediaFile(item.memory.audioPath),
                  removeMediaFile(item.memory.inkImagePath),
                ]),
              )
              .then(() => {
                haptics.trigger('selection');
                toast.show('信件已删除');
                goBack();
              })
              .catch(error => {
                console.error('删除信件失败', error);
                toast.show('信件没有删除，请再试一次');
              })
              .finally(() => setDeleting(false));
          },
        },
      ],
    );
  };

  if (loadingError) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.errorText}>这封信暂时没有靠岸</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={goBack}
        >
          <Text style={styles.errorBack}>返回</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.errorText}>正在从河面捞起这封信……</Text>
      </SafeAreaView>
    );
  }

  const sourceLabel = route.params?.source === 'daily' ? '日迹' : '信箱';
  const driftDays = daysBetween(item.letter.sentAt, item.letter.arriveDate);
  const elapsedYears = Math.max(
    1,
    item.letter.arriveDate.getFullYear() - item.letter.sentAt.getFullYear(),
  );
  return (
    <View style={styles.screen}>
      <LetterBackground />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          pointerEvents={opened ? 'none' : 'auto'}
          style={[styles.sealedState, sealedStyle]}
        >
          <View style={styles.meta}>
            <Text style={styles.arrivedLabel}>A LETTER ARRIVED</Text>
            <Text style={styles.fromTitle}>{elapsedYears} 年前的你</Text>
            <Text style={styles.fromMeta}>
              写于 {formatDate(item.letter.sentAt)}
              {item.memory.placeDetail ? ` · ${item.memory.placeDetail}` : ''}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="轻触火漆印开启"
            disabled={opening}
            onPress={openLetter}
            style={({ pressed }) => [
              styles.envelope,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <EnvelopeBase />
            <Animated.View style={[styles.previewPaper, previewStyle]}>
              <Text style={styles.previewDate}>
                {formatDate(item.letter.sentAt)}
              </Text>
              <Text numberOfLines={5} style={styles.previewText}>
                {item.memory.content}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.envelopeTop, flapStyle]}>
              <EnvelopeTop />
            </Animated.View>
            <Animated.View style={[styles.sealLayer, sealStyle]}>
              <WaxSeal />
            </Animated.View>
          </Pressable>

          <Text style={styles.openHint}>
            {opening ? '……' : '轻触火漆印开启'}
          </Text>
          <Text style={styles.driftDate}>
            {formatDate(item.letter.sentAt)} →{' '}
            {formatDate(item.letter.arriveDate)} · 漂流 {driftDays} 天
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="删除这封信"
            disabled={deleting}
            onPress={confirmDelete}
            style={styles.sealedDelete}
          >
            <Text style={styles.sealedDeleteText}>删除这封信</Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={opened ? 'auto' : 'none'}
          style={[
            styles.openState,
            openStyle,
            opened && styles.openStateOpened,
          ]}
        >
          <LetterReadingView
            item={item}
            sourceLabel={sourceLabel}
            onArchive={saveToDaily}
            onBack={goBack}
            onDelete={confirmDelete}
            onError={toast.show}
            onReply={goToWrite}
          />
        </Animated.View>

        {!opened ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`返回${sourceLabel}`}
            hitSlop={12}
            onPress={goBack}
            style={styles.back}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>{sourceLabel}</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E8DFCA' },
  safeArea: { flex: 1 },
  back: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.xl,
    zIndex: 20,
    minWidth: 72,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backIcon: {
    color: primitiveColors.ink,
    fontFamily: fontFamilies.sans,
    fontSize: 28,
    lineHeight: 28,
  },
  backText: {
    color: primitiveColors.ink,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.bodyLarge,
  },
  sealedState: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  meta: { alignItems: 'center', marginBottom: 36 },
  arrivedLabel: {
    marginBottom: spacing.gap,
    color: primitiveColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 5,
    opacity: 0.75,
  },
  fromTitle: {
    color: primitiveColors.ink,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    letterSpacing: 2,
  },
  fromMeta: {
    marginTop: spacing.cardGap,
    color: primitiveColors.inkLight,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  envelope: {
    width: 260,
    height: 175,
    boxShadow: '0 16px 40px rgba(80,50,20,0.25)',
  },
  envelopeTop: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 5,
    height: 102,
    transformOrigin: 'top',
  },
  previewPaper: {
    position: 'absolute',
    top: 31,
    right: 21,
    bottom: 18,
    left: 21,
    zIndex: 3,
    paddingHorizontal: spacing.cardGap,
    paddingTop: spacing.md,
    borderRadius: 1,
    backgroundColor: '#FEFCF5',
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(80,50,20,0.08)',
  },
  previewDate: {
    marginBottom: spacing.xs,
    color: primitiveColors.inkFaint,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 8,
    letterSpacing: 1,
  },
  previewText: {
    color: primitiveColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: 9,
    lineHeight: 15.3,
  },
  sealLayer: {
    position: 'absolute',
    top: 48,
    right: 0,
    left: 0,
    zIndex: 8,
    alignItems: 'center',
  },
  wax: { width: 66, height: 56 },
  miniWax: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    zIndex: 8,
    width: 44,
    height: 38,
    opacity: 0.3,
  },
  waxDisk: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#60180D',
    boxShadow: '0 2px 4px rgba(50,12,6,0.35)',
  },
  waxImprint: {
    width: '58%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.7,
    borderColor: 'rgba(30,8,3,0.5)',
    borderRadius: radius.round,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  waxText: {
    color: '#350C04',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
    fontWeight: '700',
    transform: [{ rotate: '-5deg' }],
  },
  miniWaxText: {
    color: '#350C04',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 12,
    fontWeight: '700',
    transform: [{ rotate: '-5deg' }],
  },
  openHint: {
    marginTop: spacing.xxl,
    color: primitiveColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
    letterSpacing: 3,
    opacity: 0.55,
  },
  driftDate: {
    marginTop: spacing.cardGap,
    color: primitiveColors.inkFaint,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: fontSizes.caption,
    letterSpacing: 1.2,
  },
  sealedDelete: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  sealedDeleteText: {
    color: '#9B5A49',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  openState: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#E8DFCA',
  },
  openStateOpened: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  letterScroll: {
    paddingHorizontal: spacing.page,
    paddingTop: 58,
    paddingBottom: spacing.xxl,
  },
  letterPaper: {
    position: 'relative',
    paddingHorizontal: spacing.letterCard,
    paddingTop: spacing.xxxl,
    paddingBottom: 28,
    borderRadius: 2,
    backgroundColor: '#FEFCF5',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  paperRule: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 0.5,
    backgroundColor: 'rgba(180,140,90,0.08)',
  },
  letterDate: {
    marginBottom: spacing.xl,
    color: primitiveColors.inkFaint,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  salute: {
    marginBottom: spacing.md,
    color: primitiveColors.ink,
    fontFamily: fontFamilies.serif,
    fontSize: 18,
  },
  paragraph: {
    marginBottom: spacing.md,
    color: primitiveColors.ink,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: 30,
  },
  signature: {
    marginTop: spacing.lg,
    color: primitiveColors.inkLight,
    textAlign: 'right',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  tip: {
    paddingBottom: spacing.xs,
    color: primitiveColors.inkFaint,
    textAlign: 'center',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  paperButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(140,100,60,0.2)',
    borderRadius: radius.image,
    backgroundColor: '#F8F2E3',
  },
  paperButtonText: {
    color: primitiveColors.ink,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    letterSpacing: 2,
  },
  waxButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.image,
    backgroundColor: '#721D10',
    boxShadow: '0 2px 6px rgba(80,20,10,0.3)',
  },
  waxButtonText: {
    color: '#F5E8D0',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    letterSpacing: 2,
  },
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: '#E8DFCA',
  },
  errorText: {
    color: primitiveColors.inkSoft,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  errorBack: {
    color: primitiveColors.accent,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.meta,
  },
});
