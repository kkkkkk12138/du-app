import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActionSheetIOS,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from 'react-native-geolocation-service';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { createMemory } from '../../db/memoryRepository';
import { getLatestRecognizedCity } from '../../db/placeRepository';
import {
  AudioAttachment,
  useAudioRecorder,
} from '../../hooks/useAudioRecorder';
import { useHaptics } from '../../hooks/useHaptics';
import {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/RootNavigator';
import { primitiveColors } from '../../tokens/colors';
import {
  openAppSettings,
  requestCameraAccess,
  requestLocationAccess,
} from '../../services/contextPermissions';
import { removeMediaFile } from '../../services/mediaStorage';
import {
  resolveCurrentPlace,
  resolveManualPlace,
} from '../../services/placeGeocoding';
import { recognizeCity, RecognizedCity } from '../../services/placeRecognition';
import { pickPhotoFromLibrary } from '../../services/photoLibrary';
import {
  requestLetterNotificationAccess,
  scheduleLetterArrivalNotification,
} from '../../services/letterNotifications';
import { useSettingsStore } from '../../store/useSettingsStore';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';
import { useTheme } from '../../theme/useTheme';
import { CameraOverlay } from './CameraOverlay';
import {
  getLatestWriteDraft,
  saveWriteDraft,
  WriteDraftInput,
} from './draftRepository';
import { HandwritingOverlay } from './HandwritingOverlay';
import {
  combineArrivalDateAndTime,
  formatArrivalDate,
  getPresetArrivalDate,
  minimumArrivalDate,
} from '../newLetter/futureLetterLogic';
import type { ArrivalPreset } from '../newLetter/futureLetterLogic';
import { UnifiedArrivalDateTimePicker } from '../newLetter/UnifiedArrivalDateTimePicker';
import { createFutureLetter } from '../newLetter/futureLetterRepository';

type WriteNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Write'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FeelingCategory = 'weather' | 'body' | 'heart';
type DraftSaveState = 'idle' | 'saving' | 'saved' | 'failed';

const FEELINGS_COLLAPSED_HEIGHT = 104;
const FEELINGS_EXPANDED_HEIGHT = 236;
const CUSTOM_FEELING_MAX_LENGTH = 12;
const manualPlaceGuideSeenKey = 'du-manual-place-guide-seen-v1';
const manualPlaceGuideMessage =
  '写“城市 · 具体地点”最准确，例如“哈尔滨 · 中央大街”。识别出的城市会计入足迹；“中央大街”或“窗台边”这类地点可以保存，但不会被擅自归入某座城市。';
const writeFutureOptions: {
  id:
    | Exclude<ArrivalPreset, 'one_month' | 'next_birthday' | 'custom'>
    | 'custom';
  title: string;
  english: string;
}[] = [
  { id: 'three_months', title: '三个月后', english: '3 months' },
  { id: 'half_year', title: '半年后', english: '6 months' },
  { id: 'one_year', title: '一年后', english: '1 year' },
  { id: 'three_years', title: '三年后', english: '3 years' },
  { id: 'five_years', title: '五年后', english: '5 years' },
  { id: 'ten_years', title: '十年后', english: '10 years' },
  { id: 'custom', title: '自选', english: 'pick a date' },
];

const feelingCategories: Record<
  FeelingCategory,
  { label: string; tags: string[] }
> = {
  weather: {
    label: '天',
    tags: [
      '好冷',
      '雨大了',
      '风好大',
      '天很闷',
      '好热',
      '雾很大',
      '天晴了',
      '天黑了',
      '雨终于小了',
      '风停了',
      '晒得慌',
      '空气黏黏的',
      '天有点灰',
      '月亮很亮',
    ],
  },
  body: {
    label: '身',
    tags: [
      '胃空空',
      '困得睁不开',
      '头有点疼',
      '肩膀硬了',
      '想喝热的',
      '手冰凉',
      '有点饿',
      '呼吸有点沉',
      '腿走酸了',
      '终于松下来',
      '没什么力气',
      '身上暖和了',
    ],
  },
  heart: {
    label: '心',
    tags: [
      '想家了',
      '想说话',
      '不想动',
      '想出去走走',
      '有点难过',
      '偷偷开心',
      '心里堵着',
      '有点委屈',
      '终于放心了',
      '平静',
      '说不上来',
      '想一个人待会儿',
      '其实挺好的',
    ],
  },
};

const presetFeelingTags = new Set(
  Object.values(feelingCategories).flatMap(item => item.tags),
);

function formatDates(now: Date) {
  const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return {
    stamp: `${months[now.getMonth()]} ${now.getDate()}`,
    line: `${shortWeekdays[now.getDay()]} · ${
      months[now.getMonth()]
    } ${now.getDate()} · ${hour}:${minute}`,
  };
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function getWritePlaceholder(now: Date) {
  const hour = now.getHours();
  if (hour < 6) {
    return '睡不着的话，写几句吧。';
  }
  if (hour < 11) {
    return '昨夜的梦，今早的茶。';
  }
  if (hour < 18) {
    return '此刻在想什么？';
  }
  return '今天过得怎么样？';
}

function reportDraftError(message: string, error: unknown) {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process?.env?.NODE_ENV;
  if (nodeEnv !== 'test') {
    console.error(message, error);
  }
}

function PaperBackground({ isDark }: { isDark: boolean }) {
  return (
    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="writePaper" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={isDark ? '#3A3028' : '#FEFCF5'} />
          <Stop offset="1" stopColor={isDark ? '#2F2923' : '#FDF8EE'} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#writePaper)" />
    </Svg>
  );
}

function PaperRules() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.bindingLine} />
      {Array.from({ length: 22 }, (_, index) => (
        <View
          key={index}
          style={[styles.paperRule, { top: index * 31 + 31 }]}
        />
      ))}
    </View>
  );
}

function ToolIcon({ name, color }: { name: string; color: string }) {
  if (name === 'camera') {
    return (
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Rect
          x={3}
          y={6}
          width={18}
          height={13}
          rx={2}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
        <Circle
          cx={12}
          cy={12.5}
          r={3.5}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
        <Path
          d="M8 6 9.5 4h5L16 6"
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
      </Svg>
    );
  }
  if (name === 'audio') {
    return (
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Rect
          x={9}
          y={3}
          width={6}
          height={11}
          rx={3}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
        <Path
          d="M5 11a7 7 0 0 0 14 0M12 18v3"
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
      </Svg>
    );
  }
  if (name === 'ink') {
    return (
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Path
          d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
      </Svg>
    );
  }
  return (
    <Svg height={20} width={20} viewBox="0 0 24 24">
      <Path
        d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z"
        fill="none"
        stroke={color}
        strokeWidth={1.3}
      />
      <Circle
        cx={12}
        cy={9}
        r={2.5}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
      />
    </Svg>
  );
}

function AttachmentEnter({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(1, { duration: 150 })
      : withSpring(1, { damping: 14, stiffness: 180 });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function RecordingBar({
  seconds,
  waveLevels,
  onCancel,
  onComplete,
}: {
  seconds: number;
  waveLevels: number[];
  onCancel: () => void;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const entry = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    entry.value = reduceMotion
      ? withTiming(1, { duration: 150 })
      : withSpring(1, { damping: 18, stiffness: 190 });
    if (!reduceMotion) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.38, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        false,
      );
    }
  }, [entry, pulse, reduceMotion]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: reduceMotion ? [] : [{ translateY: 44 * (1 - entry.value) }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View style={[styles.recordingBar, barStyle]}>
      <Animated.View style={[styles.recordingDot, dotStyle]} />
      <View style={styles.recordingWave}>
        {waveLevels.map((level, index) => (
          <View
            key={index}
            style={[
              styles.recordingWaveBar,
              { transform: [{ scaleY: level }] },
            ]}
          />
        ))}
      </View>
      <Text style={styles.recordingTime}>{formatDuration(seconds)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="取消录音"
        onPress={onCancel}
      >
        <Text style={styles.recordingCancel}>取消</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="完成录音"
        onPress={onComplete}
        style={styles.recordingDone}
      >
        <Text style={styles.recordingDoneText}>完成</Text>
      </Pressable>
    </Animated.View>
  );
}

export function WriteScreen() {
  const navigation = useNavigation<WriteNavigation>();
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const showToast = toast.show;
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const letterReminderOn = useSettingsStore(state => state.letterReminderOn);
  const [now, setNow] = useState(() => new Date());
  const date = useMemo(() => formatDates(now), [now]);
  const [content, setContent] = useState('');
  const [isFuture, setIsFuture] = useState(false);
  const [futureArriveAt, setFutureArriveAt] = useState<Date>();
  const [futureArriveType, setFutureArriveType] =
    useState<ArrivalPreset>('one_year');
  const [futureSheetOpen, setFutureSheetOpen] = useState(false);
  const [pendingFutureArriveAt, setPendingFutureArriveAt] = useState(() =>
    getPresetArrivalDate('one_year'),
  );
  const [pendingFutureArriveType, setPendingFutureArriveType] =
    useState<ArrivalPreset>('one_year');
  const [futureDateTimePickerOpen, setFutureDateTimePickerOpen] =
    useState(false);
  const [category, setCategory] = useState<FeelingCategory>('weather');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customFeelingTags, setCustomFeelingTags] = useState<string[]>([]);
  const [customFeelingDraft, setCustomFeelingDraft] = useState('');
  const [showCustomFeelingInput, setShowCustomFeelingInput] = useState(false);
  const [feelingsExpanded, setFeelingsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPath, setPhotoPath] = useState<string>();
  const [audioAttachment, setAudioAttachment] = useState<AudioAttachment>();
  const [inkImagePath, setInkImagePath] = useState<string>();
  const [placeDetail, setPlaceDetail] = useState<string>();
  const [placeCity, setPlaceCity] = useState<RecognizedCity>();
  const [recentPlaceCity, setRecentPlaceCity] = useState<RecognizedCity>();
  const [manualPlaceDraft, setManualPlaceDraft] = useState('');
  const [showManualPlace, setShowManualPlace] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const manualCityPreview = useMemo(
    () => recognizeCity(manualPlaceDraft),
    [manualPlaceDraft],
  );
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>('idle');
  const [showCamera, setShowCamera] = useState(false);
  const [showHandwriting, setShowHandwriting] = useState(false);
  const contentInputRef = useRef<TextInput>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | undefined>(undefined);
  const manualPlaceGuideRequestRef = useRef(false);
  const publishingRef = useRef(false);
  const previousAssetSignature = useRef('');
  const stampScale = useSharedValue(1);
  const stampTranslateY = useSharedValue(0);
  const bloomScale = useSharedValue(1);
  const bloomOpacity = useSharedValue(0);
  const whiteOpacity = useSharedValue(0);
  const pageOpacity = useSharedValue(1);
  const feelingsHeight = useSharedValue(FEELINGS_COLLAPSED_HEIGHT);
  const feelingsStartHeight = useSharedValue(FEELINGS_COLLAPSED_HEIGHT);
  const screenBackgroundStyle = {
    backgroundColor: isDark ? colors.background : '#F5F0E4',
  };
  const whiteFieldStyle = {
    backgroundColor: isDark ? colors.background : '#FEFCF5',
  };
  const draftInput = useMemo<WriteDraftInput>(
    () => ({
      content,
      isFuture,
      futureArriveAt,
      futureArriveType: isFuture ? futureArriveType : undefined,
      customTags: selectedTags,
      imagePath: photoPath,
      audioPath: audioAttachment?.path,
      audioDuration: audioAttachment?.duration,
      inkImagePath,
      placeDetail,
      placeCity,
    }),
    [
      audioAttachment?.duration,
      audioAttachment?.path,
      content,
      futureArriveAt,
      futureArriveType,
      inkImagePath,
      isFuture,
      photoPath,
      placeDetail,
      placeCity,
      selectedTags,
    ],
  );
  const persistDraft = useCallback(async () => {
    if (!draftLoaded || publishingRef.current) {
      return null;
    }
    setDraftSaveState('saving');
    try {
      const snapshot = await saveWriteDraft(draftInput, draftIdRef.current);
      draftIdRef.current = snapshot?.id;
      setDraftSaveState(snapshot ? 'saved' : 'idle');
      return snapshot;
    } catch (error) {
      reportDraftError('草稿自动保存失败', error);
      setDraftSaveState('failed');
      return null;
    }
  }, [draftInput, draftLoaded]);
  const handleAudioComplete = useCallback(
    (attachment: AudioAttachment) => {
      const previousPath = audioAttachment?.path;
      setAudioAttachment(attachment);
      if (previousPath && previousPath !== attachment.path) {
        removeMediaFile(previousPath).catch(error => {
          console.warn('旧录音清理失败', error);
        });
      }
      haptics.trigger('record');
      toast.show('录音已落下');
    },
    [audioAttachment?.path, haptics, toast],
  );
  const handleToolError = useCallback(
    (message: string) => toast.show(message),
    [toast],
  );
  const showSettingsAlert = useCallback(
    (title: string, message: string) => {
      Alert.alert(title, message, [
        { text: '取消', style: 'cancel' },
        {
          text: '前往设置',
          onPress: () =>
            openAppSettings().catch(() => toast.show('暂时无法打开系统设置')),
        },
      ]);
    },
    [toast],
  );
  const recorder = useAudioRecorder(handleAudioComplete, handleToolError, () =>
    showSettingsAlert(
      '需要麦克风权限',
      '请在系统设置中允许“渡”使用麦克风，才能录下此刻的声音。',
    ),
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([getLatestWriteDraft(), getLatestRecognizedCity()])
      .then(([draft, recentCity]) => {
        if (!mounted) {
          return;
        }
        setRecentPlaceCity(draft?.placeCity ?? recentCity);
        if (!draft) {
          return;
        }
        draftIdRef.current = draft.id;
        setContent(draft.content);
        setIsFuture(draft.isFuture);
        setFutureArriveAt(draft.futureArriveAt);
        setFutureArriveType(draft.futureArriveType ?? 'one_year');
        setSelectedTags(draft.customTags);
        setCustomFeelingTags(
          draft.customTags.filter(tag => !presetFeelingTags.has(tag)),
        );
        setPhotoPath(draft.imagePath);
        setAudioAttachment(
          draft.audioPath && draft.audioDuration !== undefined
            ? { path: draft.audioPath, duration: draft.audioDuration }
            : undefined,
        );
        setInkImagePath(draft.inkImagePath);
        setPlaceDetail(draft.placeDetail);
        setPlaceCity(draft.placeCity);
        setDraftSaveState('saved');
      })
      .catch(error => {
        reportDraftError('恢复写作草稿失败', error);
        showToast('草稿暂时没有恢复，请重新进入此刻');
      })
      .finally(() => {
        if (mounted) {
          setDraftLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (!draftLoaded || publishingRef.current) {
      return;
    }
    setDraftSaveState(current => (current === 'failed' ? current : 'idle'));
    const timer = setTimeout(() => {
      persistDraft().catch(() => undefined);
    }, 2_000);
    return () => clearTimeout(timer);
  }, [draftInput, draftLoaded, persistDraft]);

  useEffect(() => {
    if (!draftLoaded || publishingRef.current) {
      return;
    }
    const signature = [
      photoPath,
      audioAttachment?.path,
      audioAttachment?.duration,
      inkImagePath,
      placeDetail,
    ].join('|');
    if (signature === previousAssetSignature.current) {
      return;
    }
    previousAssetSignature.current = signature;
    persistDraft().catch(() => undefined);
  }, [
    audioAttachment?.duration,
    audioAttachment?.path,
    draftLoaded,
    inkImagePath,
    persistDraft,
    photoPath,
    placeDetail,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      persistDraft().catch(() => undefined);
    });
    return unsubscribe;
  }, [navigation, persistDraft]);

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      stampScale.value = 1;
      stampTranslateY.value = 0;
      bloomScale.value = 1;
      bloomOpacity.value = 0;
      whiteOpacity.value = 0;
      pageOpacity.value = 1;
      feelingsHeight.value = FEELINGS_COLLAPSED_HEIGHT;
      setFeelingsExpanded(false);
      setSaving(false);
      return () => {
        if (navigationTimer.current) {
          clearTimeout(navigationTimer.current);
          navigationTimer.current = null;
        }
      };
    }, [
      bloomOpacity,
      bloomScale,
      feelingsHeight,
      pageOpacity,
      stampScale,
      stampTranslateY,
      whiteOpacity,
    ]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(new Date());
      } else {
        persistDraft().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [persistDraft]);

  useEffect(
    () => () => {
      if (navigationTimer.current) {
        clearTimeout(navigationTimer.current);
      }
    },
    [],
  );

  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: stampTranslateY.value },
      { rotate: '-3deg' },
      { scale: stampScale.value },
    ],
  }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: bloomScale.value }],
  }));
  const whiteStyle = useAnimatedStyle(() => ({
    opacity: whiteOpacity.value,
  }));
  const pageStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
  }));
  const feelingsPanelStyle = useAnimatedStyle(() => ({
    height: feelingsHeight.value,
  }));

  const setFeelingsPanel = (expanded: boolean) => {
    setFeelingsExpanded(expanded);
    feelingsHeight.value = withTiming(
      expanded ? FEELINGS_EXPANDED_HEIGHT : FEELINGS_COLLAPSED_HEIGHT,
      {
        duration: reduceMotion ? 1 : 220,
        easing: Easing.out(Easing.cubic),
      },
    );
  };

  const feelingsGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onStart(() => {
      feelingsStartHeight.value = feelingsHeight.value;
    })
    .onUpdate(event => {
      feelingsHeight.value = Math.min(
        FEELINGS_EXPANDED_HEIGHT,
        Math.max(
          FEELINGS_COLLAPSED_HEIGHT,
          feelingsStartHeight.value - event.translationY,
        ),
      );
    })
    .onEnd(event => {
      const expanded =
        event.velocityY < -300 ||
        (event.velocityY <= 300 &&
          feelingsHeight.value >
            (FEELINGS_COLLAPSED_HEIGHT + FEELINGS_EXPANDED_HEIGHT) / 2);
      feelingsHeight.value = withTiming(
        expanded ? FEELINGS_EXPANDED_HEIGHT : FEELINGS_COLLAPSED_HEIGHT,
        {
          duration: reduceMotion ? 1 : 220,
          easing: Easing.out(Easing.cubic),
        },
      );
      runOnJS(setFeelingsExpanded)(expanded);
    });

  const openFutureSheet = () => {
    const preset = isFuture ? futureArriveType : 'one_year';
    const arriveAt =
      isFuture && futureArriveAt
        ? futureArriveAt
        : getPresetArrivalDate('one_year', now);
    setPendingFutureArriveType(preset);
    setPendingFutureArriveAt(arriveAt);
    setFutureSheetOpen(true);
    haptics.trigger('selection');
  };

  const chooseFuturePreset = (preset: ArrivalPreset) => {
    setPendingFutureArriveType(preset);
    if (preset === 'custom') {
      setFutureDateTimePickerOpen(true);
      return;
    }
    setPendingFutureArriveAt(current =>
      combineArrivalDateAndTime(getPresetArrivalDate(preset, now), current),
    );
  };

  const confirmFuture = () => {
    setFutureArriveType(pendingFutureArriveType);
    setFutureArriveAt(pendingFutureArriveAt);
    setIsFuture(true);
    setFutureSheetOpen(false);
    haptics.trigger('selection');
  };

  const clearFuture = () => {
    setIsFuture(false);
    setFutureArriveAt(undefined);
    setFutureSheetOpen(false);
    haptics.trigger('selection');
  };

  const toggleTag = (tag: string) => {
    haptics.trigger('selection');
    setSelectedTags(current =>
      current.includes(tag)
        ? current.filter(item => item !== tag)
        : [...current, tag],
    );
  };

  const openCustomFeelingInput = () => {
    setFeelingsPanel(true);
    setShowCustomFeelingInput(true);
  };

  const addCustomFeeling = () => {
    const tag = customFeelingDraft.trim();
    if (!tag) {
      return;
    }
    if (tag.length > CUSTOM_FEELING_MAX_LENGTH) {
      toast.show(`感觉最多 ${CUSTOM_FEELING_MAX_LENGTH} 个字`);
      return;
    }

    haptics.trigger('selection');
    if (!presetFeelingTags.has(tag)) {
      setCustomFeelingTags(current =>
        current.includes(tag) ? current : [...current, tag],
      );
    }
    setSelectedTags(current =>
      current.includes(tag) ? current : [...current, tag],
    );
    setCustomFeelingDraft('');
    setShowCustomFeelingInput(false);
  };

  const openCamera = async () => {
    const permission = await requestCameraAccess();
    if (permission === 'granted') {
      setShowCamera(true);
    } else if (permission === 'blocked') {
      showSettingsAlert(
        '需要相机权限',
        '请在系统设置中允许“渡”使用相机，才能拍下此刻的景。',
      );
    } else {
      toast.show('没有相机权限，暂时不能拍照');
    }
  };

  const addPhoto = async (path: string) => {
    const previousPath = photoPath;
    setPhotoPath(path);
    setShowCamera(false);
    if (previousPath && previousPath !== path) {
      await removeMediaFile(previousPath).catch(error => {
        console.warn('旧照片清理失败', error);
      });
    }
    haptics.trigger('selection');
    toast.show('已添加此刻的景');
  };

  const openPhotoLibrary = async () => {
    const result = await pickPhotoFromLibrary();
    if (result.status === 'selected') {
      await addPhoto(result.path);
    } else if (result.status === 'error') {
      toast.show(result.message);
    }
  };

  const choosePhotoSource = () => {
    haptics.trigger('selection');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: photoPath ? '替换这张照片' : '添加此刻的景',
          options: ['拍照', '从相册选择', '取消'],
          cancelButtonIndex: 2,
        },
        index => {
          if (index === 0) {
            openCamera().catch(() => toast.show('相机暂时没有打开'));
          } else if (index === 1) {
            openPhotoLibrary().catch(() => toast.show('相册暂时没有打开'));
          }
        },
      );
      return;
    }
    Alert.alert(photoPath ? '替换这张照片' : '添加此刻的景', undefined, [
      {
        text: '拍照',
        onPress: () => openCamera().catch(() => toast.show('相机暂时没有打开')),
      },
      {
        text: '从相册选择',
        onPress: () =>
          openPhotoLibrary().catch(() => toast.show('相册暂时没有打开')),
      },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const addInk = async (path: string) => {
    const previousPath = inkImagePath;
    setInkImagePath(path);
    setShowHandwriting(false);
    if (previousPath && previousPath !== path) {
      await removeMediaFile(previousPath).catch(error => {
        console.warn('旧手书清理失败', error);
      });
    }
    haptics.trigger('selection');
    toast.show('手书已落下');
  };

  const openManualPlace = useCallback(() => {
    setManualPlaceDraft(placeDetail ?? '');
    const openSheet = () => setShowManualPlace(true);

    if (manualPlaceGuideRequestRef.current) {
      openSheet();
      return;
    }
    manualPlaceGuideRequestRef.current = true;

    AsyncStorage.getItem(manualPlaceGuideSeenKey)
      .then(seen => {
        if (seen === 'true') {
          openSheet();
          return;
        }
        Alert.alert(
          '怎样写地点',
          manualPlaceGuideMessage,
          [
            {
              text: '开始填写',
              onPress: () => {
                AsyncStorage.setItem(manualPlaceGuideSeenKey, 'true').catch(
                  () => undefined,
                );
                openSheet();
              },
            },
          ],
          { cancelable: false },
        );
      })
      .catch(() => {
        Alert.alert(
          '怎样写地点',
          manualPlaceGuideMessage,
          [{ text: '开始填写', onPress: openSheet }],
          { cancelable: false },
        );
      });
  }, [placeDetail]);

  const addLocation = async () => {
    const permission = await requestLocationAccess();
    if (permission === 'blocked') {
      Alert.alert(
        '需要位置权限',
        '你可以手动写下地点，或前往系统设置允许“渡”读取位置。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '手动填写',
            onPress: openManualPlace,
          },
          {
            text: '系统设置',
            onPress: () =>
              openAppSettings().catch(() => toast.show('暂时无法打开系统设置')),
          },
        ],
      );
      return;
    }
    if (permission !== 'granted') {
      openManualPlace();
      return;
    }
    Geolocation.getCurrentPosition(
      async position => {
        const latitude = position.coords.latitude.toFixed(5);
        const longitude = position.coords.longitude.toFixed(5);
        const resolved = await resolveCurrentPlace(
          position.coords.latitude,
          position.coords.longitude,
        );
        setPlaceDetail(resolved?.detail ?? `${latitude}, ${longitude}`);
        setPlaceCity(resolved?.city);
        if (resolved) {
          setRecentPlaceCity(resolved.city);
        }
        haptics.trigger('selection');
        toast.show(
          resolved
            ? `已识别为${resolved.city.name}`
            : '已保存坐标，暂未识别所在城市',
        );
      },
      () => {
        toast.show('暂时没有读到位置，可以手动写下地点');
        openManualPlace();
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  };

  const saveManualPlace = async () => {
    const normalized = manualPlaceDraft.trim();
    if (!normalized) {
      toast.show('请写下一个地点');
      return;
    }
    if (normalized.length > 60) {
      toast.show('地点最多 60 个字');
      return;
    }
    setResolvingPlace(true);
    const resolved = await resolveManualPlace(normalized);
    setResolvingPlace(false);
    if (!resolved && recentPlaceCity) {
      Alert.alert(
        '确认足迹城市',
        `“${normalized}”无法单独确定城市。是否按${recentPlaceCity.name}记录？`,
        [
          {
            text: '仅保存地点',
            onPress: () => {
              setPlaceDetail(normalized);
              setPlaceCity(undefined);
              setShowManualPlace(false);
              toast.show('地点已保存；未计入城市足迹');
            },
          },
          {
            text: `计入${recentPlaceCity.name}`,
            onPress: () => {
              setPlaceDetail(`${recentPlaceCity.name} · ${normalized}`);
              setPlaceCity(recentPlaceCity);
              setShowManualPlace(false);
              toast.show(`已计入${recentPlaceCity.name}足迹`);
            },
          },
          { text: '重写', style: 'cancel' },
        ],
      );
      return;
    }
    setPlaceDetail(resolved?.detail ?? normalized);
    setPlaceCity(resolved?.city);
    if (resolved) {
      setRecentPlaceCity(resolved.city);
    }
    setShowManualPlace(false);
    haptics.trigger('selection');
    toast.show(
      resolved
        ? `已识别为${resolved.city.name}，将计入足迹`
        : '地点已保存；未识别城市，不计入足迹',
    );
  };

  const handleToolPress = (tool: string) => {
    if (tool === 'camera') {
      choosePhotoSource();
    } else if (tool === 'audio') {
      if (recorder.recording) {
        recorder.stop(false);
      } else {
        haptics.trigger('record');
        recorder.start();
      }
    } else if (tool === 'ink') {
      setShowHandwriting(true);
    } else {
      addLocation();
    }
  };

  const renderFeelingTag = (tag: string) => {
    const selected = selectedTags.includes(tag);
    const selectedFeelingStyle = {
      backgroundColor: selected ? colors.text : 'transparent',
      borderColor: selected ? colors.text : 'rgba(58,51,45,0.1)',
    };

    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={tag}
        accessibilityState={{ checked: selected }}
        key={tag}
        onPress={() => toggleTag(tag)}
        style={[styles.feelingTag, selectedFeelingStyle]}
      >
        <Text
          style={[
            styles.feelingTagText,
            {
              color: selected
                ? isDark
                  ? colors.background
                  : '#FEFCF5'
                : colors.textMuted,
            },
          ]}
        >
          {tag}
        </Text>
      </Pressable>
    );
  };

  const animateStamp = (onFinished: () => void, includeBloom: boolean) => {
    haptics.trigger('seal');
    const quick = reduceMotion ? 1 : 100;
    stampScale.value = withSequence(
      withTiming(0.9, { duration: quick }),
      withTiming(1, { duration: quick }),
    );
    stampTranslateY.value = withSequence(
      withDelay(quick, withTiming(1, { duration: quick })),
      withTiming(0, { duration: quick }),
    );

    if (includeBloom && !reduceMotion) {
      bloomOpacity.value = withDelay(
        150,
        withSequence(
          withTiming(0.4, { duration: 275 }),
          withTiming(0, { duration: 275 }),
        ),
      );
      bloomScale.value = withDelay(
        150,
        withTiming(20, { duration: 550, easing: Easing.out(Easing.cubic) }),
      );
      whiteOpacity.value = withDelay(
        600,
        withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 300 }),
        ),
      );
      pageOpacity.value = withDelay(1000, withTiming(0, { duration: 200 }));
    }

    navigationTimer.current = setTimeout(
      onFinished,
      reduceMotion ? 220 : includeBloom ? 1200 : 220,
    );
  };

  const closeWrite = async () => {
    await persistDraft();
    navigation.navigate('Daily');
  };

  const submit = async () => {
    if (saving) {
      return;
    }

    const trimmed = content.trim();
    if (
      !trimmed &&
      !photoPath &&
      !audioAttachment &&
      !inkImagePath &&
      !placeDetail
    ) {
      toast.show('先落下一句话或一份附件');
      return;
    }
    if (isFuture) {
      setSaving(true);
      publishingRef.current = true;
      const arriveDate =
        futureArriveAt ??
        (futureArriveType === 'custom'
          ? minimumArrivalDate(now)
          : getPresetArrivalDate(futureArriveType, now));
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
          draft: {
            draftId: draftIdRef.current,
            content: trimmed,
            type: photoPath ? 'photo' : audioAttachment ? 'audio' : 'text',
            customTags: selectedTags,
            imagePath: photoPath,
            audioPath: audioAttachment?.path,
            audioDuration: audioAttachment?.duration,
            inkImagePath,
            placeDetail,
            placeCity,
          },
          arriveDate,
          arriveType: futureArriveType,
        });
        if (notificationAllowed) {
          scheduleLetterArrivalNotification({
            letterId: letter.id,
            arriveDate,
          }).catch(error => console.warn('未来信通知调度失败', error));
        }
        draftIdRef.current = undefined;
        animateStamp(() => {
          toast.show('信已放入时间长河');
          navigation.navigate('Letters');
          setContent('');
          contentInputRef.current?.clear();
          setIsFuture(false);
          setFutureArriveAt(undefined);
          setFutureArriveType('one_year');
          setSelectedTags([]);
          setCustomFeelingTags([]);
          setCustomFeelingDraft('');
          setShowCustomFeelingInput(false);
          setPhotoPath(undefined);
          setAudioAttachment(undefined);
          setInkImagePath(undefined);
          setPlaceDetail(undefined);
          setPlaceCity(undefined);
          setDraftSaveState('idle');
          setSaving(false);
          publishingRef.current = false;
        }, true);
      } catch (error) {
        console.error('保存未来信失败', error);
        setSaving(false);
        publishingRef.current = false;
        toast.show('信没有放稳，请再试一次');
      }
      return;
    }

    setSaving(true);
    publishingRef.current = true;
    try {
      const memory = await createMemory({
        draftId: draftIdRef.current,
        content: trimmed,
        type: photoPath ? 'photo' : audioAttachment ? 'audio' : 'text',
        customTags: selectedTags,
        imagePath: photoPath,
        audioPath: audioAttachment?.path,
        audioDuration: audioAttachment?.duration,
        inkImagePath,
        placeDetail,
        placeCity,
        writtenAt: new Date(),
      });
      draftIdRef.current = undefined;
      animateStamp(() => {
        toast.show('落下了');
        navigation.navigate('Daily', { newMemoryId: memory.id });
        setContent('');
        contentInputRef.current?.clear();
        setSelectedTags([]);
        setCustomFeelingTags([]);
        setCustomFeelingDraft('');
        setShowCustomFeelingInput(false);
        setPhotoPath(undefined);
        setAudioAttachment(undefined);
        setInkImagePath(undefined);
        setPlaceDetail(undefined);
        setPlaceCity(undefined);
        setDraftSaveState('idle');
        setSaving(false);
        publishingRef.current = false;
      }, true);
    } catch (error) {
      console.error('保存此刻失败', error);
      setSaving(false);
      publishingRef.current = false;
      toast.show('没有落稳，请再试一次');
    }
  };

  if (showCamera) {
    return (
      <CameraOverlay
        onCancel={() => setShowCamera(false)}
        onCapture={addPhoto}
      />
    );
  }

  if (showHandwriting) {
    return (
      <HandwritingOverlay
        onCancel={() => setShowHandwriting(false)}
        onComplete={addInk}
        onError={toast.show}
      />
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, screenBackgroundStyle]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}
      >
        <Animated.View style={[styles.page, pageStyle]}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="收起"
              hitSlop={8}
              onPress={() => closeWrite().catch(() => undefined)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.close, { color: colors.textMuted }]}>
                收起
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="未来信模式"
              accessibilityState={{ checked: isFuture }}
              hitSlop={8}
              onPress={openFutureSheet}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text
                style={[
                  styles.dateStamp,
                  { color: isFuture ? colors.accent : colors.textMuted },
                ]}
              >
                {date.stamp.toUpperCase()}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.paper, { borderColor: colors.line }]}>
            <PaperBackground isDark={isDark} />
            <PaperRules />
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="寄给未来"
              accessibilityState={{ checked: isFuture }}
              onPress={openFutureSheet}
              style={styles.futureFold}
            >
              <Svg height={44} width={44}>
                <Polygon
                  points="44,0 44,44 0,0"
                  fill={isFuture ? colors.accent : colors.text}
                  opacity={isFuture ? 0.15 : 0.04}
                />
              </Svg>
              <Text
                style={[
                  styles.futureText,
                  { color: isFuture ? colors.accent : colors.textFaint },
                ]}
              >
                {isFuture && futureArriveAt
                  ? `${
                      futureArriveAt.getMonth() + 1
                    }.${futureArriveAt.getDate()}`
                  : '未来'}
              </Text>
            </Pressable>

            <View style={styles.paperHead}>
              <Text style={[styles.paperDate, { color: colors.textFaint }]}>
                {date.line.toUpperCase()}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.body}
            >
              <TextInput
                accessibilityLabel="此刻内容"
                defaultValue={content}
                key={`write-content-${draftLoaded ? 'restored' : 'loading'}`}
                multiline
                onChangeText={setContent}
                placeholder={getWritePlaceholder(now)}
                placeholderTextColor={colors.textMuted}
                ref={contentInputRef}
                selectionColor={colors.accent}
                style={[styles.input, { color: colors.text }]}
                textAlignVertical="top"
              />
              <Text
                style={[
                  styles.count,
                  {
                    color:
                      content.length > 500 ? colors.accent : colors.textFaint,
                  },
                ]}
              >
                {content.length} 字
              </Text>
              {draftSaveState !== 'idle' ? (
                <Pressable
                  accessibilityRole={
                    draftSaveState === 'failed' ? 'button' : undefined
                  }
                  disabled={draftSaveState !== 'failed'}
                  onPress={() => persistDraft().catch(() => undefined)}
                >
                  <Text
                    style={[
                      styles.draftStatus,
                      {
                        color:
                          draftSaveState === 'failed'
                            ? colors.accent
                            : colors.textFaint,
                      },
                    ]}
                  >
                    {
                      {
                        saving: '正在保存草稿…',
                        saved: '草稿已保存',
                        failed: '未保存，点此重试',
                      }[draftSaveState]
                    }
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>

            {photoPath || audioAttachment || inkImagePath || placeDetail ? (
              <View style={styles.attachments}>
                {photoPath ? (
                  <AttachmentEnter>
                    <View style={styles.photoAttachment}>
                      <Image
                        source={{ uri: `file://${photoPath}` }}
                        style={styles.photoPreview}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="删除照片"
                        onPress={() => {
                          const removedPath = photoPath;
                          setPhotoPath(undefined);
                          removeMediaFile(removedPath).catch(() =>
                            toast.show('照片已移除，文件稍后清理'),
                          );
                        }}
                        style={styles.removeAttachment}
                      >
                        <Text style={styles.removeAttachmentText}>×</Text>
                      </Pressable>
                    </View>
                  </AttachmentEnter>
                ) : null}
                {audioAttachment ? (
                  <AttachmentEnter>
                    <View style={styles.audioAttachment}>
                      <Text
                        style={[
                          styles.audioAttachmentIcon,
                          { color: colors.accent },
                        ]}
                      >
                        声
                      </Text>
                      <View style={styles.audioAttachmentWave}>
                        {[6, 12, 8, 16, 10, 14, 7, 12, 9, 15].map(
                          (height, index) => (
                            <View
                              key={index}
                              style={[
                                styles.audioAttachmentBar,
                                { height, backgroundColor: colors.textFaint },
                              ]}
                            />
                          ),
                        )}
                      </View>
                      <Text
                        style={[
                          styles.attachmentMeta,
                          { color: colors.textMuted },
                        ]}
                      >
                        {formatDuration(audioAttachment.duration)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="删除录音"
                        onPress={() => {
                          const removedPath = audioAttachment.path;
                          setAudioAttachment(undefined);
                          removeMediaFile(removedPath).catch(() =>
                            toast.show('录音已移除，文件稍后清理'),
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.inlineRemove,
                            { color: colors.textFaint },
                          ]}
                        >
                          ×
                        </Text>
                      </Pressable>
                    </View>
                  </AttachmentEnter>
                ) : null}
                {inkImagePath ? (
                  <AttachmentEnter>
                    <View style={styles.inkAttachment}>
                      <Image
                        resizeMode="contain"
                        source={{ uri: `file://${inkImagePath}` }}
                        style={styles.inkPreview}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="删除手书"
                        onPress={() => {
                          const removedPath = inkImagePath;
                          setInkImagePath(undefined);
                          removeMediaFile(removedPath).catch(() =>
                            toast.show('手书已移除，文件稍后清理'),
                          );
                        }}
                        style={styles.removeAttachment}
                      >
                        <Text style={styles.removeAttachmentText}>×</Text>
                      </Pressable>
                    </View>
                  </AttachmentEnter>
                ) : null}
                {placeDetail ? (
                  <AttachmentEnter>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="移除位置"
                      onPress={() => {
                        setPlaceDetail(undefined);
                        setPlaceCity(undefined);
                      }}
                      style={styles.locationAttachment}
                    >
                      <Text
                        style={[
                          styles.attachmentMeta,
                          { color: colors.textMuted },
                        ]}
                      >
                        此刻坐标 · {placeDetail} ×
                      </Text>
                    </Pressable>
                  </AttachmentEnter>
                ) : null}
              </View>
            ) : null}

            {recorder.recording ? (
              <RecordingBar
                seconds={recorder.seconds}
                waveLevels={recorder.waveLevels}
                onCancel={() => recorder.stop(true)}
                onComplete={() => recorder.stop(false)}
              />
            ) : null}

            <GestureDetector gesture={feelingsGesture}>
              <Animated.View
                style={[
                  styles.feelingsPanel,
                  isDark ? styles.feelingsPanelDark : styles.feelingsPanelLight,
                  { borderTopColor: colors.line },
                  feelingsPanelStyle,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    feelingsExpanded ? '收起感觉标签' : '展开感觉标签'
                  }
                  accessibilityHint="也可以上下拖动"
                  onPress={() => setFeelingsPanel(!feelingsExpanded)}
                  style={styles.feelingsHandle}
                >
                  <View
                    style={[
                      styles.feelingsHandleBar,
                      { backgroundColor: colors.textFaint },
                    ]}
                  />
                </Pressable>

                <View style={styles.feelings}>
                  <View style={styles.categoryRow}>
                    {(Object.keys(feelingCategories) as FeelingCategory[]).map(
                      item => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`感觉分类${feelingCategories[item].label}`}
                          key={item}
                          onPress={() => setCategory(item)}
                          style={[
                            styles.category,
                            category === item && {
                              borderBottomColor: colors.text,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              {
                                color:
                                  category === item
                                    ? colors.text
                                    : colors.textFaint,
                              },
                            ]}
                          >
                            {feelingCategories[item].label}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  {feelingsExpanded ? (
                    <View style={styles.expandedTagGrid}>
                      {feelingCategories[category].tags.map(renderFeelingTag)}
                      {customFeelingTags.map(renderFeelingTag)}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="自己写感觉"
                        onPress={openCustomFeelingInput}
                        style={styles.customFeelingTrigger}
                      >
                        <Text
                          style={[
                            styles.customFeelingTriggerText,
                            { color: colors.textFaint },
                          ]}
                        >
                          ＋ 自己写…
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      contentContainerStyle={styles.tagRow}
                      showsHorizontalScrollIndicator={false}
                    >
                      {feelingCategories[category].tags.map(renderFeelingTag)}
                      {customFeelingTags.map(renderFeelingTag)}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="自己写感觉"
                        onPress={openCustomFeelingInput}
                        style={styles.customFeelingTrigger}
                      >
                        <Text
                          style={[
                            styles.customFeelingTriggerText,
                            { color: colors.textFaint },
                          ]}
                        >
                          ＋ 自己写…
                        </Text>
                      </Pressable>
                    </ScrollView>
                  )}
                </View>

                {showCustomFeelingInput ? (
                  <View style={styles.customFeelingComposer}>
                    <TextInput
                      accessibilityLabel="自定义感觉"
                      autoFocus
                      blurOnSubmit={false}
                      defaultValue=""
                      onChangeText={setCustomFeelingDraft}
                      placeholder="比如：今天有点软"
                      placeholderTextColor={colors.textFaint}
                      returnKeyType="default"
                      selectionColor={colors.accent}
                      style={[
                        styles.customFeelingInput,
                        {
                          borderBottomColor: colors.line,
                          color: colors.text,
                        },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="加入自定义感觉"
                      disabled={!customFeelingDraft.trim()}
                      onPress={addCustomFeeling}
                      style={({ pressed }) => [
                        styles.customFeelingAdd,
                        {
                          opacity: !customFeelingDraft.trim()
                            ? 0.35
                            : pressed
                            ? 0.6
                            : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.customFeelingAddText,
                          { color: colors.accent },
                        ]}
                      >
                        加入
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {selectedTags.length ? (
                  <View style={styles.selectedTags}>
                    {selectedTags.map(tag => (
                      <View key={tag} style={styles.selectedTag}>
                        <Text
                          style={[
                            styles.selectedTagText,
                            { color: primitiveColors.rose },
                          ]}
                        >
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            </GestureDetector>
          </View>

          <View style={styles.edge}>
            <View style={styles.tools}>
              {['camera', 'audio', 'ink', 'location'].map(tool => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    {
                      camera: '添加图片',
                      audio: '录音',
                      ink: '手书',
                      location: '位置',
                    }[tool]
                  }
                  key={tool}
                  onPress={() => handleToolPress(tool)}
                  style={({ pressed }) => [
                    styles.tool,
                    pressed && { backgroundColor: colors.line },
                  ]}
                >
                  <ToolIcon
                    color={
                      (tool === 'audio' && recorder.recording) ||
                      (tool === 'camera' && photoPath) ||
                      (tool === 'ink' && inkImagePath) ||
                      (tool === 'location' && placeDetail)
                        ? colors.accent
                        : colors.textFaint
                    }
                    name={tool}
                  />
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFuture ? '继续写未来信' : '落下此刻'}
              disabled={saving}
              onPress={submit}
              style={styles.sealButton}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sealBloom,
                  { backgroundColor: colors.seal },
                  bloomStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.sealStamp,
                  { backgroundColor: colors.seal },
                  stampStyle,
                ]}
              >
                <Text style={styles.sealText}>落</Text>
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.whiteField, whiteFieldStyle, whiteStyle]}
        />
      </KeyboardAvoidingView>
      <OverlayPortal
        name="write-manual-place"
        onRequestClose={() => setShowManualPlace(false)}
        visible={showManualPlace}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.manualPlaceBackdrop}
        >
          <Pressable
            accessibilityLabel="关闭手动地点"
            onPress={() => setShowManualPlace(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.manualPlaceSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
              },
            ]}
          >
            <Text style={[styles.manualPlaceTitle, { color: colors.text }]}>
              写下此刻地点
            </Text>
            <TextInput
              accessibilityLabel="手动地点"
              autoFocus
              defaultValue={manualPlaceDraft}
              onChangeText={setManualPlaceDraft}
              placeholder="例如：家里的窗边"
              placeholderTextColor={colors.textFaint}
              returnKeyType="default"
              style={[
                styles.manualPlaceInput,
                {
                  borderColor: colors.line,
                  color: colors.text,
                },
              ]}
            />
            {manualPlaceDraft.trim() ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  styles.manualPlaceRecognition,
                  {
                    color: manualCityPreview ? colors.accent : colors.textFaint,
                  },
                ]}
              >
                {manualCityPreview
                  ? `将计入足迹：${manualCityPreview.name}`
                  : '写下后会尝试通过系统地图识别全球城市'}
              </Text>
            ) : null}
            <View style={styles.manualPlaceActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消手动地点"
                onPress={() => setShowManualPlace(false)}
                style={styles.manualPlaceAction}
              >
                <Text
                  style={[
                    styles.manualPlaceCancel,
                    { color: colors.textMuted },
                  ]}
                >
                  取消
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="保存手动地点"
                disabled={resolvingPlace}
                onPress={saveManualPlace}
                style={[
                  styles.manualPlaceSave,
                  { backgroundColor: colors.seal },
                ]}
              >
                <Text style={styles.manualPlaceSaveText}>
                  {resolvingPlace ? '识别中' : '写下'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </OverlayPortal>
      <OverlayPortal
        name="write-future-sheet"
        onRequestClose={() => setFutureSheetOpen(false)}
        visible={futureSheetOpen}
      >
        <View style={styles.futureBackdrop}>
          <Pressable
            accessibilityLabel="关闭未来日期选择"
            onPress={() => setFutureSheetOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.futureSheet}>
            <View style={styles.futureHandle} />
            <Text style={styles.futureTitle}>寄给未来</Text>
            <Text style={styles.futureSubtitle}>choose a date to arrive</Text>
            <View style={styles.futureOptions}>
              {writeFutureOptions.map(option => {
                const selected = pendingFutureArriveType === option.id;
                const custom = option.id === 'custom';
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={option.title}
                    accessibilityState={{ selected }}
                    key={option.id}
                    onPress={() => chooseFuturePreset(option.id)}
                    style={[
                      styles.futureOption,
                      custom && styles.futureOptionCustom,
                      selected && styles.futureOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.futureOptionTitle,
                        selected && styles.futureOptionTitleSelected,
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.futureOptionEnglish,
                        selected && styles.futureOptionEnglishSelected,
                      ]}
                    >
                      {option.english}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.futureSelectedDate}>
              {formatArrivalDate(pendingFutureArriveAt)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择到达日期与时间"
              onPress={() => setFutureDateTimePickerOpen(true)}
              style={styles.futureTimeAction}
            >
              <Text style={styles.futureTimeActionText}>
                一次选择日期与时间
              </Text>
            </Pressable>
            <View style={styles.futureActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消未来日期"
                onPress={() => setFutureSheetOpen(false)}
                style={styles.futureCancel}
              >
                <Text style={styles.futureCancelText}>取消</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="盖上邮戳"
                onPress={confirmFuture}
                style={styles.futureConfirm}
              >
                <Text style={styles.futureConfirmText}>盖上邮戳</Text>
              </Pressable>
            </View>
            {isFuture ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="不寄了"
                onPress={clearFuture}
                style={styles.futureClear}
              >
                <Text style={styles.futureClearText}>× 不寄了</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </OverlayPortal>
      <UnifiedArrivalDateTimePicker
        date={pendingFutureArriveAt}
        minimumDate={minimumArrivalDate()}
        name="write-arrival-date-time"
        visible={futureDateTimePickerOpen}
        onCancel={() => {
          setFutureDateTimePickerOpen(false);
        }}
        onConfirm={selectedArrival => {
          setFutureDateTimePickerOpen(false);
          setPendingFutureArriveAt(selectedArrival);
          setPendingFutureArriveType('custom');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  page: { flex: 1 },
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.cardGap,
  },
  close: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    letterSpacing: 1,
  },
  dateStamp: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 11,
    letterSpacing: 3,
  },
  paper: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 0.5,
    borderRadius: 2,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(58,51,45,0.05), 0 6px 20px rgba(58,51,45,0.04)',
  },
  bindingLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 44,
    width: 0.5,
    backgroundColor: 'rgba(212,168,83,0.12)',
  },
  paperRule: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 0.5,
    backgroundColor: 'rgba(58,51,45,0.025)',
  },
  futureFold: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 4,
    width: 44,
    height: 44,
  },
  futureText: {
    position: 'absolute',
    top: 6,
    right: 5,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 7,
    letterSpacing: 1,
  },
  paperHead: {
    zIndex: 2,
    paddingTop: spacing.xl,
    paddingRight: spacing.xxl,
    paddingLeft: 58,
  },
  paperDate: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 11,
    letterSpacing: 3,
  },
  body: { flex: 1, zIndex: 2 },
  bodyContent: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingRight: spacing.xxl,
    paddingBottom: spacing.sm,
    paddingLeft: 58,
  },
  input: {
    minHeight: 180,
    flex: 1,
    padding: 0,
    fontFamily: fontFamilies.serif,
    fontSize: 16,
    lineHeight: 32,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  count: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    textAlign: 'right',
  },
  draftStatus: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    textAlign: 'right',
  },
  attachments: {
    zIndex: 3,
    flexShrink: 0,
    gap: spacing.xs,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
    paddingLeft: 58,
  },
  photoAttachment: {
    width: 180,
    height: 104,
    borderRadius: 2,
    overflow: 'hidden',
    transform: [{ rotate: '-0.5deg' }],
  },
  photoPreview: { width: '100%', height: '100%' },
  inkAttachment: {
    width: 180,
    height: 58,
    borderWidth: 0.5,
    borderColor: 'rgba(58,51,45,0.1)',
    borderRadius: 2,
    backgroundColor: '#FEFCF5',
  },
  inkPreview: { width: '100%', height: '100%' },
  removeAttachment: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  removeAttachmentText: { color: '#FFFFFF', fontSize: 13, lineHeight: 16 },
  audioAttachment: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(58,51,45,0.05)',
  },
  audioAttachmentIcon: {
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  audioAttachmentWave: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  audioAttachmentBar: { width: 1.5, borderRadius: 1 },
  attachmentMeta: { fontFamily: fontFamilies.sans, fontSize: 10 },
  inlineRemove: { paddingHorizontal: spacing.xs, fontSize: 14 },
  locationAttachment: { alignSelf: 'flex-start', paddingVertical: spacing.xxs },
  manualPlaceBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(32, 27, 23, 0.32)',
  },
  manualPlaceSheet: {
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.paper,
  },
  manualPlaceTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
  },
  manualPlaceInput: {
    minHeight: 46,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.paper,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  manualPlaceRecognition: {
    minHeight: 18,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    lineHeight: 16,
  },
  manualPlaceActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
  },
  manualPlaceAction: {
    minWidth: 56,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualPlaceCancel: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  manualPlaceSave: {
    minWidth: 70,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.paper,
  },
  manualPlaceSaveText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 13,
    letterSpacing: 2,
  },
  futureBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(42,35,28,0.38)',
  },
  futureSheet: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#F5EDDC',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.15)',
  },
  futureHandle: {
    width: 36,
    height: 3,
    alignSelf: 'center',
    marginBottom: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(139,115,85,0.25)',
  },
  futureTitle: {
    textAlign: 'center',
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 15,
    letterSpacing: 2,
  },
  futureSubtitle: {
    marginTop: 4,
    marginBottom: 18,
    textAlign: 'center',
    color: '#8B7355',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  futureOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  futureOption: {
    minHeight: 58,
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,115,85,0.15)',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  futureOptionCustom: {
    flexBasis: '100%',
    minHeight: 48,
    borderStyle: 'dashed',
    borderColor: 'rgba(139,115,85,0.3)',
    backgroundColor: 'transparent',
  },
  futureOptionSelected: {
    borderColor: 'rgba(184,92,56,0.35)',
    backgroundColor: 'rgba(184,92,56,0.1)',
  },
  futureOptionTitle: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  futureOptionTitleSelected: {
    color: '#B85C38',
  },
  futureOptionEnglish: {
    marginTop: 3,
    color: '#8B7355',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  futureOptionEnglishSelected: {
    color: '#B85C38',
    opacity: 0.7,
  },
  futureSelectedDate: {
    marginTop: 10,
    textAlign: 'center',
    color: '#8B7355',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 12,
    letterSpacing: 1,
  },
  futureTimeAction: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  futureTimeActionText: {
    color: '#B85C38',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 1,
  },
  futureActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  futureCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(139,115,85,0.2)',
    borderRadius: 4,
  },
  futureCancelText: {
    color: '#5C4F42',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  futureConfirm: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 4,
    backgroundColor: '#B85C38',
  },
  futureConfirmText: {
    color: '#F5EDDC',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    letterSpacing: 2,
  },
  futureClear: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  futureClearText: {
    color: '#8B7355',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    fontStyle: 'italic',
  },
  recordingBar: {
    zIndex: 5,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#2A2F3D',
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#C0392B',
  },
  recordingWave: {
    height: 20,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recordingWaveBar: {
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  recordingTime: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  recordingCancel: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  recordingDone: {
    borderRadius: radius.pill,
    backgroundColor: '#C0392B',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recordingDoneText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  feelings: {
    paddingBottom: 6,
    paddingLeft: 58,
  },
  feelingsPanel: {
    zIndex: 3,
    flexShrink: 0,
    overflow: 'hidden',
    borderTopWidth: 0.5,
  },
  feelingsPanelLight: {
    backgroundColor: 'rgba(253,248,238,0.96)',
  },
  feelingsPanelDark: {
    backgroundColor: 'rgba(47,41,35,0.96)',
  },
  feelingsHandle: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingsHandleBar: {
    width: 32,
    height: 3,
    borderRadius: radius.pill,
    opacity: 0.35,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  category: {
    marginRight: spacing.gap,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  categoryText: {
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  tagRow: {
    gap: spacing.xs,
    paddingRight: spacing.xxl,
  },
  expandedTagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingRight: spacing.xxl,
  },
  customFeelingTrigger: {
    justifyContent: 'center',
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(58,51,45,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.cardGap,
    paddingVertical: 3,
  },
  customFeelingTriggerText: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15.4,
  },
  customFeelingComposer: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginRight: spacing.xxl,
    marginLeft: 58,
    gap: spacing.sm,
  },
  customFeelingInput: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: spacing.xxs,
    borderBottomWidth: 0.5,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 19.2,
  },
  customFeelingAdd: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  customFeelingAddText: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  feelingTag: {
    borderWidth: 0.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.cardGap,
    paddingVertical: 3,
  },
  feelingTagText: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 15.4,
  },
  selectedTags: {
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingRight: spacing.xxl,
    paddingLeft: 58,
  },
  selectedTag: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(201,155,146,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  selectedTagText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  edge: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  tools: { flexDirection: 'row', gap: spacing.xxs },
  tool: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.image,
  },
  sealButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealStamp: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    boxShadow: '0 2px 8px rgba(192,57,43,0.2)',
  },
  sealText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 20,
  },
  sealBloom: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: radius.round,
  },
  whiteField: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
});
