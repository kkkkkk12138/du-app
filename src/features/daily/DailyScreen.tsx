import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  SectionList,
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
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Memory } from '../../db/models';
import {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/RootNavigator';
import { primitiveColors } from '../../tokens/colors';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes, lineHeights } from '../../tokens/typography';
import { useTheme } from '../../theme/useTheme';
import {
  getDailyContext,
  getSeasonalDistance,
  getSimilarityReason,
  groupMemoriesByDate,
  parseMemoryTags,
} from './dailyContext';
import { ArrivedLetter, getDailyData } from './dailyRepository';
import { MemoryCard } from './MemoryCard';
import { MemoryDetailModal } from './MemoryDetailModal';
import { useDailyClock } from './useDailyClock';

type DailyNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Daily'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type DailyRoute = RouteProp<MainTabParamList, 'Daily'>;

function PhenologyBackground() {
  return (
    <Svg
      pointerEvents="none"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
    >
      <Defs>
        <LinearGradient id="phenologyGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#8FAA95" stopOpacity={0.08} />
          <Stop offset="1" stopColor="#C99B92" stopOpacity={0.06} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} fill="url(#phenologyGlow)" />
    </Svg>
  );
}

function ArrivedLetterNudge({
  item,
  onOpen,
}: {
  item: ArrivedLetter;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);

  return (
    <View
      accessibilityLabel={`${item.yearsAgo}年前寄来的信，今天到了`}
      style={[styles.letterNudge, { borderColor: colors.line }]}
    >
      <Animated.View
        style={[
          styles.letterDot,
          { backgroundColor: colors.seal, opacity: pulse },
        ]}
      />
      <Text style={[styles.letterNudgeText, { color: colors.textMuted }]}>
        {item.yearsAgo}年前的你
        <Text style={[styles.letterNudgeAccent, { color: colors.accent }]}>
          寄来一封信
        </Text>
        ，今天到了
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="拆开来信"
        hitSlop={10}
        onPress={onOpen}
      >
        <Text style={[styles.letterOpen, { color: colors.accent }]}>拆 →</Text>
      </Pressable>
    </View>
  );
}

export function DailyScreen() {
  const navigation = useNavigation<DailyNavigation>();
  const route = useRoute<DailyRoute>();
  const { colors } = useTheme();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [arrivedLetter, setArrivedLetter] = useState<ArrivedLetter | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [entryMemoryId, setEntryMemoryId] = useState<string | undefined>(
    route.params?.newMemoryId,
  );
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [detailContext, setDetailContext] = useState<string>();
  const now = useDailyClock();
  const reduceMotion = useReducedMotion();
  const loadedDay = useRef(
    `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
  );
  const computedContext = useMemo(() => getDailyContext(now), [now]);
  const [context, setContext] = useState(computedContext);
  const contextOpacity = useRef(new Animated.Value(1)).current;
  const contextTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const nextId = route.params?.newMemoryId;
    if (!nextId) {
      return;
    }
    setEntryMemoryId(nextId);
    navigation.setParams({ newMemoryId: undefined });
  }, [navigation, route.params?.newMemoryId]);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }
    try {
      const data = await getDailyData();
      setMemories(data.memories);
      setArrivedLetter(data.arrivedLetter);
      setError(false);
    } catch (loadError) {
      console.error('读取日迹失败', loadError);
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const currentDay = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (currentDay === loadedDay.current) {
      setContext(computedContext);
      return;
    }
    loadedDay.current = currentDay;
    if (reduceMotion) {
      setContext(computedContext);
      load();
      return;
    }
    const exit = Animated.parallel([
      Animated.timing(contextOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(contextTranslate, {
        toValue: -20,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);
    let enter: Animated.CompositeAnimation | undefined;
    exit.start(({ finished }) => {
      if (!finished) {
        return;
      }
      setContext(computedContext);
      load();
      contextTranslate.setValue(20);
      enter = Animated.parallel([
        Animated.timing(contextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(contextTranslate, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]);
      enter.start();
    });
    return () => {
      exit.stop();
      enter?.stop();
    };
  }, [
    computedContext,
    contextOpacity,
    contextTranslate,
    load,
    now,
    reduceMotion,
  ]);

  const oldMemory = useMemo(() => {
    const monthAgo = now.getTime() - 30 * 86_400_000;
    return (
      memories
        .filter(memory => memory.writtenAt.getTime() < monthAgo)
        .sort(
          (left, right) =>
            getSeasonalDistance(left.writtenAt, now) -
            getSeasonalDistance(right.writtenAt, now),
        )[0] ?? null
    );
  }, [memories, now]);
  const timelineMemories = useMemo(() => {
    const timeline = oldMemory
      ? memories.filter(memory => memory.id !== oldMemory.id)
      : [...memories];
    if (!entryMemoryId) {
      return timeline;
    }
    return [...timeline].sort((left, right) => {
      if (left.id === entryMemoryId) {
        return -1;
      }
      if (right.id === entryMemoryId) {
        return 1;
      }
      return right.writtenAt.getTime() - left.writtenAt.getTime();
    });
  }, [entryMemoryId, memories, oldMemory]);
  const sections = useMemo(
    () => groupMemoriesByDate(timelineMemories, now),
    [timelineMemories, now],
  );
  useEffect(() => {
    const currentTime = Date.now();
    const expiries = memories
      .filter(memory => !memory.id.startsWith('seed-'))
      .map(memory => memory.createdAt.getTime() + 86_400_000)
      .filter(expiry => expiry > currentTime);
    if (!expiries.length) {
      return;
    }
    const timer = setTimeout(
      () => setFreshnessNow(Date.now()),
      Math.min(...expiries) - currentTime + 1000,
    );
    return () => clearTimeout(timer);
  }, [freshnessNow, memories]);
  const anchorSummaries = useMemo(() => {
    const summaries = new Map<string, string>();
    const dayCounts = new Map<string, number>();
    for (const memory of memories) {
      const date = memory.writtenAt;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }
    const monthlyMaximums = new Map<string, number>();
    for (const [dayKey, count] of dayCounts) {
      const monthKey = dayKey.split('-').slice(0, 2).join('-');
      monthlyMaximums.set(
        monthKey,
        Math.max(monthlyMaximums.get(monthKey) ?? 0, count),
      );
    }
    for (const memory of memories.filter(item => item.type === 'anchor')) {
      const date = memory.writtenAt;
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const count = dayCounts.get(dayKey) ?? 1;
      const isMonthlyMaximum = count === monthlyMaximums.get(monthKey);
      summaries.set(
        memory.id,
        `${date.getMonth() + 1}月${date.getDate()}日${
          memory.placeDetail ? ` · ${memory.placeDetail}` : ''
        } · 这一天你写了 ${count} 条${isMonthlyMaximum ? '，是本月最多' : ''}`,
      );
    }
    return summaries;
  }, [memories]);
  const openMemory = useCallback((memory: Memory, contextLabel?: string) => {
    setDetailContext(contextLabel);
    setSelectedMemory(memory);
  }, []);
  const renderMemory = useCallback(
    ({ item }: { item: Memory }) => {
      const tags = parseMemoryTags(item.customTags);
      const isContextualOld = tags.includes('一个人') && tags.includes('晚饭');

      return (
        <MemoryCard
          isFresh={
            !item.id.startsWith('seed-') &&
            freshnessNow - item.createdAt.getTime() < 86_400_000
          }
          isNew={entryMemoryId === item.id}
          memory={item}
          anchorSummary={anchorSummaries.get(item.id)}
          oldReason={isContextualOld ? '也是一个人吃饭' : undefined}
          variant={isContextualOld ? 'old' : undefined}
          onPress={() => openMemory(item)}
        />
      );
    },
    [anchorSummaries, entryMemoryId, freshnessNow, openMemory],
  );

  const header = (
    <>
      <Animated.View
        style={[
          styles.greetingBlock,
          {
            opacity: contextOpacity,
            transform: [{ translateY: contextTranslate }],
          },
        ]}
      >
        <Text style={[styles.date, { color: colors.textFaint }]}>
          {context.headerDate.toUpperCase()}
        </Text>
        <Text style={[styles.greeting, { color: colors.text }]}>
          {context.greeting.prefix}
          <Text style={{ color: colors.accent }}>
            {context.greeting.accent}
          </Text>
          {context.greeting.suffix}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {context.subtitle}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.phenology,
          styles.phenologyLightBorder,
          {
            opacity: contextOpacity,
            transform: [{ translateY: contextTranslate }],
          },
        ]}
      >
        <PhenologyBackground />
        <Text style={[styles.phenologyIcon, { color: primitiveColors.sage }]}>
          {context.phenology.icon}
        </Text>
        <View style={styles.phenologyBody}>
          <Text style={[styles.phenologyTitle, { color: colors.text }]}>
            {context.phenology.detail}
          </Text>
          <Text style={[styles.phenologyDetail, { color: colors.textMuted }]}>
            {context.phenology.yi}
          </Text>
        </View>
      </Animated.View>

      {arrivedLetter ? (
        <ArrivedLetterNudge
          item={arrivedLetter}
          onOpen={() =>
            navigation.navigate('Letters', {
              openArrivedLetterId: arrivedLetter.letter.id,
            })
          }
        />
      ) : null}

      {oldMemory ? (
        <MemoryCard
          memory={oldMemory}
          oldReason={getSimilarityReason(oldMemory.writtenAt, now)}
          variant="old"
          onPress={() => openMemory(oldMemory, '旧日回声')}
        />
      ) : null}

      {error ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重新读取日迹"
          onPress={() => load(true)}
          style={styles.errorState}
        >
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            河面起了雾，轻触再读一次
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <SectionList
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderMemory}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
              {section.title}
            </Text>
            <View
              style={[styles.sectionLine, { backgroundColor: colors.line }]}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !error ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              河面很静，落下第一笔吧
            </Text>
          ) : null
        }
        ListFooterComponent={
          sections.length ? (
            <Text style={[styles.endText, { color: colors.textFaint }]}>
              —— {memories.length} 个此刻 ——
            </Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => load(true)}
          />
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
      <MemoryDetailModal
        contextLabel={detailContext}
        memory={selectedMemory}
        onDismiss={() => {
          setSelectedMemory(null);
          setDetailContext(undefined);
        }}
        onDeleted={() => load()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingBottom: spacing.pageBottom },
  greetingBlock: {
    paddingHorizontal: spacing.greeting,
    paddingTop: spacing.md,
    paddingBottom: spacing.cardGap,
  },
  date: {
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
  },
  greeting: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    lineHeight: 39,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  phenology: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
    marginHorizontal: spacing.greeting,
    marginTop: spacing.gap,
    paddingHorizontal: spacing.gap,
    paddingVertical: spacing.md,
    borderLeftWidth: 2,
    borderTopRightRadius: radius.paper,
    borderBottomRightRadius: radius.paper,
    overflow: 'hidden',
  },
  phenologyLightBorder: {
    borderLeftColor: 'rgba(143,170,149,0.4)',
  },
  phenologyIcon: {
    width: 28,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 20,
  },
  phenologyBody: { flex: 1 },
  phenologyTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
    letterSpacing: 1,
  },
  phenologyDetail: {
    marginTop: spacing.xxs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 0.3,
  },
  letterNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.greeting,
    marginTop: spacing.gap,
    paddingVertical: spacing.cardGap,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    gap: spacing.sm,
  },
  letterDot: { width: 5, height: 5, borderRadius: radius.round },
  letterNudgeText: {
    flex: 1,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  letterNudgeAccent: {
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  letterOpen: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
    paddingHorizontal: spacing.greeting,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.cardGap,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
  },
  sectionLine: { height: 0.5, flex: 1 },
  errorState: { alignItems: 'center', paddingVertical: spacing.xl },
  errorText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
  },
  emptyText: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  endText: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.cardGap,
    textAlign: 'center',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
  },
});
