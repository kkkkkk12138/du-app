import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  CompositeNavigationProp,
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { useHaptics } from '../../hooks/useHaptics';
import {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/RootNavigator';
import { cancelLetterArrivalNotification } from '../../services/letterNotifications';
import { removeMediaFile } from '../../services/mediaStorage';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes } from '../../tokens/typography';
import { useTheme } from '../../theme/useTheme';
import {
  AudioStrip,
  HandwritingAttachment,
  Polaroid,
} from '../daily/MemoryDetailParts';
import {
  filterLetterSections,
  getOpenedLetterRuleCount,
  LetterFilter,
} from './letterLogic';
import {
  daysUntil,
  deleteLetter,
  getLetterProgress,
  getLettersData,
  LetterSections,
  LetterWithMemory,
} from './lettersRepository';
import {
  handwrittenLetterGreeting,
  handwrittenLetterText,
  LETTER_TEXT_LINE_HEIGHT,
  startsWithLetterSalutation,
} from './letterTextStyle';

type LettersNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Letters'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type LettersRoute = RouteProp<MainTabParamList, 'Letters'>;

const emptySections: LetterSections = {
  arriving: [],
  traveling: [],
  opened: [],
  tomorrowCount: 0,
};

const OPENED_LETTER_MIN_RULES = 24;

function formatDate(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function letterTitle(item: LetterWithMemory) {
  return item.letter.toName
    ? `写给${item.letter.toName}`
    : item.memory.content.slice(0, 18);
}

function splitLetterParagraphs(content: string) {
  const explicit = content
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
  if (explicit.length > 1) {
    return explicit;
  }
  const sentences = content
    .split(/(?<=[。！？……])/u)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 2) {
    return explicit.length ? explicit : ['这封信没有留下文字。'];
  }
  const paragraphCount = Math.min(3, sentences.length);
  const chunkSize = Math.ceil(sentences.length / paragraphCount);
  return Array.from({ length: paragraphCount }, (_, index) =>
    sentences.slice(index * chunkSize, (index + 1) * chunkSize).join(''),
  ).filter(Boolean);
}

function Stat({
  count,
  label,
  accent,
  selected,
  onPress,
}: {
  count: number;
  label: string;
  accent?: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${count}封`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        {
          backgroundColor: selected ? colors.surfaceAged : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.statNumber,
          { color: accent ? colors.accent : colors.text },
        ]}
      >
        {count}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <View
        style={[
          styles.sectionTitleLine,
          { backgroundColor: colors.surfaceAged },
        ]}
      />
      <Text style={[styles.sectionTitle, { color: colors.textSoft }]}>
        {children}
      </Text>
    </View>
  );
}

function ArrivingLetter({
  item,
  now,
  onPress,
}: {
  item: LetterWithMemory;
  now: Date;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const entry = useSharedValue(reduceMotion ? 1 : 0);
  const linePulse = useSharedValue(reduceMotion ? 1 : 0.3);
  const elapsedYears = Math.max(
    0,
    now.getFullYear() - item.letter.sentAt.getFullYear(),
  );

  useEffect(() => {
    entry.value = withTiming(1, { duration: reduceMotion ? 1 : 500 });
    if (!reduceMotion) {
      linePulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 }),
        ),
        3,
        false,
      );
    }
  }, [entry, linePulse, reduceMotion]);

  const entryStyle = useAnimatedStyle(() => ({ opacity: entry.value }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: linePulse.value }));

  return (
    <Animated.View style={entryStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`拆开${letterTitle(item)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.letterStrip,
          styles.arrivingStrip,
          {
            backgroundColor: colors.surfaceAged,
            borderLeftColor: colors.line,
            opacity: pressed ? 0.82 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.arrivingLine,
            { backgroundColor: colors.accent },
            lineStyle,
          ]}
        />
        <View style={styles.arrivingTop}>
          <Text style={[styles.arrivingWhen, { color: colors.accent }]}>
            ARRIVED
          </Text>
          <Text style={[styles.arrivingProgress, { color: colors.textMuted }]}>
            100%
          </Text>
        </View>
        <Text style={[styles.arrivingTitle, { color: colors.text }]}>
          {letterTitle(item)}
        </Text>
        <Text style={[styles.arrivingMeta, { color: colors.textMuted }]}>
          写于 {formatDate(item.letter.sentAt)}
          {elapsedYears ? ` · ${elapsedYears}年前` : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function TravelingLetter({
  item,
  now,
  onPress,
  onLongPress,
}: {
  item: LetterWithMemory;
  now: Date;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const days = Math.max(1, daysUntil(item.letter.arriveDate, now));
  const progress = Math.round(getLetterProgress(item.letter, now) * 100);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${letterTitle(item)}，还有${days}天到达`}
      accessibilityHint="轻触查看旅程，长按删除"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.letterStrip,
        styles.travelingStrip,
        {
          backgroundColor: colors.surfaceWarm,
          borderLeftColor: colors.surfaceAged,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.travelDot}>
        <View
          style={[
            styles.travelDotCore,
            { backgroundColor: colors.surfaceAged },
          ]}
        />
        <View
          style={[styles.travelDotRing, { borderColor: colors.surfaceAged }]}
        />
      </View>
      <View style={styles.travelBody}>
        <Text style={[styles.travelTitle, { color: colors.textSoft }]}>
          {letterTitle(item)}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.line }]}>
          <View
            style={[
              styles.progressValue,
              {
                backgroundColor: colors.accent,
                transform: [{ scaleX: progress / 100 }],
              },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.travelDate, { color: colors.textMuted }]}>
        {days} days
      </Text>
    </Pressable>
  );
}

function OpenedLetter({
  item,
  onPress,
}: {
  item: LetterWithMemory;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const isReply = item.letter.status === 'reply';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isReply ? '查看回信' : '查看原信'}，${letterTitle(
        item,
      )}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.letterStrip,
        styles.openedStrip,
        {
          backgroundColor: colors.surfaceWarm,
          borderLeftColor: colors.surfaceAged,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.openQuote, { color: colors.surfaceAged }]}>“</Text>
      <Text style={[styles.openDate, { color: colors.textMuted }]}>
        {formatDate(item.letter.openedAt ?? item.letter.arriveDate)}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.openPreview, { color: colors.textSoft }]}
      >
        {item.memory.content}
      </Text>
      <Text style={[styles.openMeta, { color: colors.textMuted }]}>
        {isReply ? '回于' : '写于'} {formatDate(item.letter.sentAt)}
      </Text>
      <Text style={[styles.openAction, { color: colors.accent }]}>
        {isReply ? '读回信' : '查看原信'}
      </Text>
    </Pressable>
  );
}

function TravelingLetterSheet({
  item,
  now,
  onClose,
}: {
  item?: LetterWithMemory;
  now: Date;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!item) {
    return null;
  }
  const days = Math.max(1, daysUntil(item.letter.arriveDate, now));
  const progress = Math.round(getLetterProgress(item.letter, now) * 100);
  const totalDays = Math.max(
    1,
    Math.round(
      (item.letter.arriveDate.getTime() - item.letter.sentAt.getTime()) /
        86_400_000,
    ),
  );
  const elapsedDays = Math.max(0, totalDays - days);
  const fromPlace = item.memory.placeDetail?.trim() || '出发地';

  return (
    <OverlayPortal
      name="letters-traveling"
      onRequestClose={onClose}
      visible={Boolean(item)}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          accessibilityLabel="收起在途信预览"
          onPress={onClose}
          style={styles.sheetBackdrop}
        />
        <ScrollView
          accessibilityLabel="在途信详情"
          accessibilityViewIsModal
          contentContainerStyle={styles.travelSheetContent}
          showsVerticalScrollIndicator={false}
          style={[
            styles.travelSheet,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <View
            style={[styles.sheetHandle, { backgroundColor: colors.line }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收起在途信预览"
            onPress={onClose}
            style={styles.sheetClose}
          >
            <Text style={styles.sheetCloseText}>×</Text>
          </Pressable>
          <View style={styles.travelEnvelopeWrap}>
            <View style={styles.windLineOne} />
            <View style={styles.windLineTwo} />
            <View style={styles.windLineThree} />
            <View style={styles.travelEnvelope}>
              <View style={styles.travelEnvelopeFlap} />
              <View style={styles.travelEnvelopeSeal} />
            </View>
          </View>
          <Text style={styles.travelSheetTitle}>信在途中</Text>
          <Text style={styles.travelSheetSubtitle}>
            「{letterTitle(item)}」尚在山水间跋涉
          </Text>
          <View style={styles.routeTimeline}>
            <View style={styles.routeNode}>
              <View style={[styles.routeDot, styles.routeDotStart]} />
              <Text numberOfLines={1} style={styles.routeCity}>
                {fromPlace}
              </Text>
              <Text style={styles.routeLabel}>寄出日</Text>
            </View>
            <View style={styles.routeLine}>
              <View
                style={[
                  styles.routeProgress,
                  { width: `${Math.min(progress * 2, 100)}%` },
                ]}
              />
            </View>
            <View style={styles.routeNode}>
              <View style={[styles.routeDot, styles.routeDotCurrent]} />
              <Text style={styles.routeCity}>途中</Text>
              <Text style={styles.routeLabel}>已行 {elapsedDays} 日</Text>
            </View>
            <View style={styles.routeLine}>
              <View style={[styles.routeProgress, styles.routeProgressEmpty]} />
            </View>
            <View style={styles.routeNode}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <Text style={styles.routeCity}>彼岸</Text>
              <Text style={styles.routeLabel}>约 {days} 日</Text>
            </View>
          </View>
          <Text style={styles.travelMeta}>
            全程约 {totalDays} 天 · 已行 {progress}%
          </Text>
          <Text style={styles.travelPoem}>山水迢迢，信在路上</Text>
          <View style={styles.sheetActionDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="知道了"
            onPress={onClose}
            style={styles.letterSheetButton}
          >
            <Text style={styles.letterSheetButtonText}>知道了</Text>
          </Pressable>
        </ScrollView>
      </View>
    </OverlayPortal>
  );
}

function OpenedLetterSheet({
  item,
  onClose,
  onDelete,
  onReply,
}: {
  item?: LetterWithMemory;
  onClose: () => void;
  onDelete: () => void;
  onReply: () => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [readProgress, setReadProgress] = useState(0);
  const [ruleCount, setRuleCount] = useState(OPENED_LETTER_MIN_RULES);
  if (!item) {
    return null;
  }
  const date = item.letter.sentAt;
  const hasPhoto = Boolean(item.memory.imagePath || item.memory.photoTone);
  const hasAttachments = Boolean(
    hasPhoto || item.memory.audioPath || item.memory.inkImagePath,
  );
  const isReply = item.letter.status === 'reply';
  const paragraphs = splitLetterParagraphs(item.memory.content);
  const hasWrittenSalutation = startsWithLetterSalutation(item.memory.content);

  return (
    <OverlayPortal
      name="letters-opened"
      onRequestClose={onClose}
      visible={Boolean(item)}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          accessibilityLabel="合上信件"
          onPress={onClose}
          style={styles.sheetBackdrop}
        />
        <ScrollView
          accessibilityLabel="已拆信详情"
          accessibilityViewIsModal
          contentContainerStyle={styles.openedSheetContent}
          onScroll={event => {
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            const scrollable = Math.max(
              1,
              contentSize.height - layoutMeasurement.height,
            );
            setReadProgress(
              Math.min(1, Math.max(0, contentOffset.y / scrollable)),
            );
          }}
          scrollEventThrottle={80}
          showsVerticalScrollIndicator={false}
          style={[styles.openedSheet, { backgroundColor: colors.surface }]}
        >
          <View style={styles.readProgressTrack}>
            <View
              style={[
                styles.readProgressValue,
                { width: `${readProgress * 100}%` },
              ]}
            />
          </View>
          <View
            style={[styles.sheetHandle, { backgroundColor: colors.line }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="合上信件"
            onPress={onClose}
            style={styles.sheetClose}
          >
            <Text style={styles.sheetCloseText}>×</Text>
          </Pressable>
          <Text style={styles.openedCapsule}>
            ◷ 写于 {formatDate(item.letter.sentAt)}
          </Text>
          <View pointerEvents="none" style={styles.openedTopRule} />
          <View style={styles.openedHead}>
            <View style={styles.openedFrom}>
              <View style={styles.openedAvatar}>
                <Text style={styles.openedAvatarText}>
                  {isReply ? '回' : '旧'}
                  {'\n'}
                  {isReply ? '信' : '我'}
                </Text>
              </View>
              <View>
                <Text style={styles.openedFromName}>
                  {isReply ? '后来写下的回信' : '那时的自己'}
                </Text>
                <Text style={styles.openedFromPlace}>
                  {item.memory.placeDetail
                    ? `写于${item.memory.placeDetail}`
                    : '写于此地'}
                </Text>
              </View>
            </View>
            <View style={styles.openedPostmark}>
              <Text style={styles.postmarkSmall}>DU</Text>
              <Text style={styles.postmarkDay}>{date.getDate()}</Text>
              <Text style={styles.postmarkSmall}>
                {date
                  .toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                  .toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.openedFold} />
          <View
            onLayout={event => {
              const nextCount = getOpenedLetterRuleCount(
                event.nativeEvent.layout.height,
              );
              setRuleCount(current =>
                current === nextCount ? current : nextCount,
              );
            }}
            style={styles.openedBody}
            testID="opened-letter-body"
          >
            <View
              pointerEvents="none"
              style={styles.openedRules}
              testID="opened-letter-rules"
            >
              {Array.from({ length: ruleCount }, (_, index) => (
                <View key={index} style={styles.openedRule} />
              ))}
            </View>
            <View style={styles.openedRedLine} />
            <View style={styles.inkBlobOne} />
            <View style={styles.inkBlobTwo} />
            <View style={styles.inkBlobThree} />
            {!hasWrittenSalutation ? (
              <Text style={styles.openedGreeting}>
                {isReply ? '那时的我：' : '展信安：'}
              </Text>
            ) : null}
            {paragraphs.map((paragraph, index) => (
              <Text
                key={`${index}-${paragraph}`}
                style={[
                  styles.openedParagraph,
                  index > 0 && styles.openedParagraphGap,
                ]}
              >
                {paragraph}
              </Text>
            ))}
            <View style={styles.openedSignature}>
              <Text style={styles.openedSignatureText}>那时的你</Text>
              <View style={styles.openedSignatureSeal}>
                <Text style={styles.openedSignatureSealText}>渡</Text>
              </View>
            </View>
          </View>
          {hasAttachments ? (
            <View
              accessibilityLabel="信件附件"
              style={styles.openedAttachments}
            >
              {hasPhoto ? <Polaroid memory={item.memory} /> : null}
              {item.memory.audioPath ? (
                <AudioStrip memory={item.memory} onError={toast.show} />
              ) : null}
              {item.memory.inkImagePath ? (
                <HandwritingAttachment path={item.memory.inkImagePath} />
              ) : null}
            </View>
          ) : null}
          <View style={styles.openedActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.openedAction}
            >
              <Text style={styles.openedActionText}>← 合上</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onReply}
              style={[styles.openedAction, styles.openedReplyAction]}
            >
              <Text style={styles.openedReplyText}>回 信</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="删除这封信"
            onPress={onDelete}
            style={styles.sheetDelete}
          >
            <Text style={styles.openedDeleteText}>删除这封信</Text>
          </Pressable>
        </ScrollView>
      </View>
    </OverlayPortal>
  );
}

export function LettersScreen() {
  const navigation = useNavigation<LettersNavigation>();
  const route = useRoute<LettersRoute>();
  const { colors } = useTheme();
  const toast = useToast();
  const { trigger: triggerHaptic } = useHaptics();
  const announcedArrivals = useRef(new Set<string>());
  const [sections, setSections] = useState(emptySections);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [filter, setFilter] = useState<LetterFilter>('all');
  const [selectedTraveling, setSelectedTraveling] =
    useState<LetterWithMemory>();
  const [selectedOpened, setSelectedOpened] = useState<LetterWithMemory>();

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      }
      const current = new Date();
      setNow(current);
      try {
        const next = await getLettersData(current);
        const newArrival = next.arriving.find(
          item => !announcedArrivals.current.has(item.letter.id),
        );
        next.arriving.forEach(item =>
          announcedArrivals.current.add(item.letter.id),
        );
        if (newArrival) {
          triggerHaptic('letterArrived');
        }
        setSections(next);
        const requestedLetterId = route.params?.openArrivedLetterId;
        if (requestedLetterId) {
          const requested = next.arriving.find(
            item => item.letter.id === requestedLetterId,
          );
          if (requested) {
            navigation.navigate('Unseal', {
              letterId: requested.letter.id,
              source: 'letters',
            });
          }
          navigation.setParams({ openArrivedLetterId: undefined });
        }
        setError(false);
      } catch (loadError) {
        console.error('读取信箱失败', loadError);
        setError(true);
      } finally {
        setRefreshing(false);
      }
    },
    [navigation, route.params?.openArrivedLetterId, triggerHaptic],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totalCount = useMemo(
    () =>
      sections.arriving.length +
      sections.traveling.length +
      sections.opened.length,
    [sections],
  );

  const {
    arriving: visibleArriving,
    traveling: visibleTraveling,
    opened: visibleOpened,
  } = useMemo(
    () => filterLetterSections(sections, filter, now),
    [filter, now, sections],
  );
  const visibleCount =
    visibleArriving.length + visibleTraveling.length + visibleOpened.length;

  const toggleFilter = (next: LetterFilter) => {
    setFilter(current => (current === next ? 'all' : next));
  };

  const openTravelingLetter = (item: LetterWithMemory) => {
    setSelectedTraveling(item);
  };

  const confirmDeleteTravelingLetter = (item: LetterWithMemory) => {
    Alert.alert('删除这封在途信？', '删除后，信纸和附件也会从本机移除。', [
      { text: '继续等待', style: 'cancel' },
      {
        text: '删除信件',
        style: 'destructive',
        onPress: () => {
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
              setSelectedTraveling(undefined);
              toast.show('信件已删除');
              return load();
            })
            .catch(deleteError => {
              console.error('删除在途信件失败', deleteError);
              toast.show('信件没有删除，请再试一次');
            });
        },
      },
    ]);
  };
  const confirmDeleteOpenedLetter = (item: LetterWithMemory) => {
    Alert.alert('删除这封信？', '信件内容和附件会从本机永久移除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除信件',
        style: 'destructive',
        onPress: () => {
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
              setSelectedOpened(undefined);
              toast.show('信件已删除');
              return load();
            })
            .catch(deleteError => {
              console.error('删除已拆信件失败', deleteError);
              toast.show('信件没有删除，请再试一次');
            });
        },
      },
    ]);
  };
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => load(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>信箱</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            寄给未来自己的那些时刻
          </Text>
          <View style={styles.stats}>
            <Stat
              accent
              count={sections.tomorrowCount}
              label="明日到"
              onPress={() => toggleFilter('tomorrow')}
              selected={filter === 'tomorrow'}
            />
            <View
              style={[styles.statDot, { backgroundColor: colors.surfaceAged }]}
            />
            <Stat
              count={sections.traveling.length}
              label="在途中"
              onPress={() => toggleFilter('traveling')}
              selected={filter === 'traveling'}
            />
            <View
              style={[styles.statDot, { backgroundColor: colors.surfaceAged }]}
            />
            <Stat
              count={sections.opened.length}
              label="已拆"
              onPress={() => toggleFilter('opened')}
              selected={filter === 'opened'}
            />
          </View>
          {filter !== 'all' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消信箱筛选"
              onPress={() => setFilter('all')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: colors.surfaceAged,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: colors.textSoft }]}>
                {filter === 'tomorrow'
                  ? '只看明日到'
                  : filter === 'traveling'
                  ? '只看在途中'
                  : '只看已拆'}{' '}
                ×
              </Text>
            </Pressable>
          ) : null}
        </View>

        {visibleArriving.length ? (
          <View style={styles.section}>
            <SectionTitle>即将靠岸</SectionTitle>
            {visibleArriving.map(item => (
              <ArrivingLetter
                item={item}
                key={item.letter.id}
                now={now}
                onPress={() =>
                  navigation.navigate('Unseal', {
                    letterId: item.letter.id,
                    source: 'letters',
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {visibleTraveling.length ? (
          <View style={styles.section}>
            <SectionTitle>
              {filter === 'tomorrow' ? '明日靠岸' : '在途中'}
            </SectionTitle>
            {visibleTraveling.map(item => (
              <TravelingLetter
                item={item}
                key={item.letter.id}
                now={now}
                onPress={() => openTravelingLetter(item)}
                onLongPress={() => confirmDeleteTravelingLetter(item)}
              />
            ))}
          </View>
        ) : null}

        {visibleOpened.length ? (
          <View style={styles.section}>
            <SectionTitle>已拆</SectionTitle>
            {visibleOpened.map(item => (
              <OpenedLetter
                item={item}
                key={item.letter.id}
                onPress={() => setSelectedOpened(item)}
              />
            ))}
          </View>
        ) : null}

        {!totalCount && !error ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            还没有信漂在时间里
          </Text>
        ) : null}
        {totalCount > 0 && !visibleCount && !error ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            这一栏还没有信
          </Text>
        ) : null}
        {error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新读取信箱"
            onPress={() => load(true)}
            style={styles.empty}
          >
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              河面起了雾，轻触再读一次
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <TravelingLetterSheet
        item={selectedTraveling}
        now={now}
        onClose={() => setSelectedTraveling(undefined)}
      />
      <OpenedLetterSheet
        item={selectedOpened}
        onClose={() => setSelectedOpened(undefined)}
        onDelete={() => {
          if (selectedOpened) {
            confirmDeleteOpenedLetter(selectedOpened);
          }
        }}
        onReply={() => {
          setSelectedOpened(undefined);
          navigation.navigate('Write');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingBottom: spacing.pageBottom },
  header: {
    paddingHorizontal: spacing.greeting,
    paddingTop: spacing.cardGap,
    paddingBottom: spacing.gap,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    fontWeight: '400',
    letterSpacing: 3,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  stat: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    paddingHorizontal: spacing.card,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 24,
    lineHeight: 24,
  },
  statLabel: {
    fontFamily: fontFamilies.serif,
    fontSize: 9,
    letterSpacing: 1,
  },
  statDot: { width: 3, height: 3, borderRadius: radius.round },
  filterChip: {
    alignSelf: 'center',
    minHeight: 30,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  filterChipText: {
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitleLine: { width: spacing.gap, height: 0.5 },
  sectionTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 3,
  },
  letterStrip: {
    position: 'relative',
    marginBottom: spacing.sm,
    paddingTop: spacing.md,
    paddingRight: spacing.gap,
    paddingBottom: spacing.md,
    paddingLeft: spacing.lg,
    borderLeftWidth: 2,
    borderRadius: 2,
  },
  arrivingStrip: {},
  arrivingLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -2,
    width: 2,
    borderRadius: 1,
  },
  arrivingTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  arrivingWhen: {
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 10,
    letterSpacing: 2,
  },
  arrivingProgress: {
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 11,
  },
  arrivingTitle: {
    marginBottom: spacing.xxs,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 21,
  },
  arrivingMeta: {
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  travelingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
  },
  travelDot: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelDotCore: {
    width: 5,
    height: 5,
    borderRadius: radius.round,
  },
  travelDotRing: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderWidth: 0.5,
    borderRadius: radius.round,
    opacity: 0.5,
  },
  travelBody: { minWidth: 0, flex: 1 },
  travelTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 19.6,
  },
  travelDate: {
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 1,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressValue: {
    width: '100%',
    height: 1,
    transformOrigin: 'left',
  },
  openedStrip: { paddingRight: 76, paddingLeft: 30 },
  openQuote: {
    position: 'absolute',
    top: spacing.cardGap,
    left: spacing.cardGap,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 20,
    lineHeight: 20,
  },
  openDate: {
    marginBottom: spacing.xxs,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 9,
    letterSpacing: 1,
  },
  openPreview: {
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 23.4,
  },
  openMeta: {
    marginTop: 3,
    fontFamily: fontFamilies.serif,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  openAction: {
    position: 'absolute',
    right: spacing.gap,
    bottom: spacing.md,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
  },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(48,38,30,0.44)',
  },
  travelSheet: {
    maxHeight: '78%',
    borderTopWidth: 0.5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    boxShadow: '0 -8px 30px rgba(58,42,30,0.14)',
  },
  travelSheetContent: {
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 6,
    borderRadius: radius.round,
  },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58,51,45,0.15)',
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  sheetCloseText: {
    color: '#3A332D',
    fontFamily: fontFamilies.sans,
    fontSize: 16,
  },
  travelEnvelopeWrap: {
    alignSelf: 'center',
    width: 100,
    height: 80,
    marginTop: 20,
    marginBottom: 24,
  },
  travelEnvelope: {
    width: 100,
    height: 72,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(58,51,45,0.08)',
    borderRadius: 4,
    backgroundColor: '#F5EDE0',
    boxShadow: '0 6px 20px rgba(58,42,30,0.15)',
  },
  travelEnvelopeFlap: {
    position: 'absolute',
    top: 0,
    left: 15,
    width: 70,
    height: 70,
    backgroundColor: 'rgba(184,122,98,0.2)',
    transform: [{ translateY: -46 }, { rotate: '45deg' }],
  },
  travelEnvelopeSeal: {
    position: 'absolute',
    top: 26,
    left: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(184,92,56,0.35)',
  },
  windLineOne: {
    position: 'absolute',
    top: 15,
    left: -40,
    width: 30,
    height: 1,
    backgroundColor: 'rgba(139,115,85,0.3)',
  },
  windLineTwo: {
    position: 'absolute',
    top: 35,
    left: -30,
    width: 20,
    height: 1,
    backgroundColor: 'rgba(139,115,85,0.24)',
  },
  windLineThree: {
    position: 'absolute',
    top: 55,
    left: -35,
    width: 25,
    height: 1,
    backgroundColor: 'rgba(139,115,85,0.2)',
  },
  travelSheetTitle: {
    textAlign: 'center',
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 18,
    letterSpacing: 2,
  },
  travelSheetSubtitle: {
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
    color: '#8B7355',
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 20.8,
  },
  routeTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  routeNode: {
    width: 58,
    alignItems: 'center',
    gap: 6,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeDotStart: { backgroundColor: '#8FAA95' },
  routeDotCurrent: {
    backgroundColor: '#B85C38',
    boxShadow: '0 0 0 4px rgba(184,122,98,0.15)',
  },
  routeDotEnd: { backgroundColor: '#C9B99E' },
  routeCity: {
    width: 72,
    textAlign: 'center',
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  routeLabel: {
    color: '#8B7355',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  routeLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    marginTop: -28,
    backgroundColor: '#DED3C0',
  },
  routeProgress: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: '#B85C38',
  },
  routeProgressEmpty: { width: 0 },
  travelMeta: {
    marginTop: 8,
    textAlign: 'center',
    color: '#B4A58F',
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 21.6,
  },
  travelPoem: {
    marginTop: 16,
    textAlign: 'center',
    color: '#5C4F42',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  sheetActionDivider: {
    height: 0.5,
    marginTop: 28,
    backgroundColor: 'rgba(58,51,45,0.08)',
  },
  sheetDelete: {
    alignSelf: 'center',
    minHeight: 44,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  sheetDeleteText: { fontFamily: fontFamilies.serif, fontSize: 11 },
  letterSheetButton: {
    minHeight: 44,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(58,51,45,0.12)',
    borderRadius: 4,
    backgroundColor: '#FBF8F0',
  },
  letterSheetButtonText: {
    color: '#5C4F42',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 2,
  },
  openedSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    boxShadow: '0 -8px 30px rgba(58,42,30,0.14)',
  },
  openedSheetContent: {
    paddingTop: 12,
    paddingHorizontal: 26,
    paddingBottom: 36,
  },
  readProgressTrack: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 2,
    backgroundColor: 'rgba(58,51,45,0.05)',
  },
  readProgressValue: {
    height: '100%',
    backgroundColor: '#B85C38',
  },
  openedCapsule: {
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(184,92,56,0.25)',
    borderRadius: 2,
    color: 'rgba(184,92,56,0.6)',
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 1,
  },
  openedTopRule: {
    position: 'absolute',
    top: 12,
    right: 20,
    left: 20,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(184,92,56,0.10)',
  },
  openedHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(58,51,45,0.08)',
  },
  openedFrom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  openedAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(58,51,45,0.08)',
    borderRadius: 20,
    backgroundColor: '#F5EDE0',
  },
  openedAvatarText: {
    textAlign: 'center',
    color: '#B85C38',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    lineHeight: 13.2,
  },
  openedFromName: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 15,
  },
  openedFromPlace: {
    marginTop: 2,
    color: '#B4A58F',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  openedPostmark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(184,92,56,0.35)',
    borderRadius: 27,
    transform: [{ rotate: '-8deg' }],
  },
  postmarkSmall: {
    color: 'rgba(184,92,56,0.65)',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 8,
    lineHeight: 10,
  },
  postmarkDay: {
    color: 'rgba(184,92,56,0.8)',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 15,
  },
  openedFold: {
    height: 12,
    marginTop: 8,
    marginHorizontal: -26,
    marginBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(180,140,100,0.15)',
    borderBottomColor: 'rgba(180,140,100,0.08)',
  },
  openedBody: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 320,
    paddingTop: 16,
    paddingRight: 8,
    paddingBottom: 48,
    paddingLeft: 16,
    backgroundColor: 'rgba(255,252,243,0.48)',
  },
  openedRules: {
    position: 'absolute',
    top: 9,
    right: 0,
    bottom: 0,
    left: 0,
  },
  openedRule: {
    height: 1,
    marginTop: 31,
    backgroundColor: 'rgba(112,88,65,0.105)',
  },
  openedRedLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 9,
    width: 1,
    backgroundColor: 'rgba(200,80,60,0.17)',
  },
  inkBlobOne: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 14,
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(58,51,45,0.07)',
  },
  inkBlobTwo: {
    position: 'absolute',
    bottom: 120,
    left: 22,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(184,92,56,0.10)',
  },
  inkBlobThree: {
    position: 'absolute',
    top: 130,
    left: 50,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(58,51,45,0.12)',
  },
  openedGreeting: {
    ...handwrittenLetterGreeting,
  },
  openedParagraph: {
    ...handwrittenLetterText,
  },
  openedParagraphGap: {
    marginTop: LETTER_TEXT_LINE_HEIGHT,
  },
  openedSignature: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 32,
    paddingRight: 8,
  },
  openedSignatureText: {
    color: '#8B7355',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    fontStyle: 'italic',
  },
  openedSignatureSeal: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    backgroundColor: '#B85C38',
    transform: [{ rotate: '-3deg' }],
  },
  openedSignatureSealText: {
    color: '#FFF',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  openedAttachments: {
    marginTop: 24,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(58,51,45,0.08)',
  },
  openedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(58,51,45,0.08)',
  },
  openedAction: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(58,51,45,0.12)',
    borderRadius: 4,
    backgroundColor: '#FBF8F0',
  },
  openedReplyAction: {
    backgroundColor: '#B85C38',
    borderColor: '#B85C38',
  },
  openedActionText: {
    color: '#5C4F42',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 2,
  },
  openedReplyText: {
    color: '#FFF',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 4,
  },
  openedDeleteText: {
    color: '#B4A58F',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  empty: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
  },
});
