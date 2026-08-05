import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { Memory } from '../../db/models';
import { useHaptics } from '../../hooks/useHaptics';
import { MainTabParamList } from '../../navigation/RootNavigator';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { shadows } from '../../tokens/shadows';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes, lineHeights } from '../../tokens/typography';
import { MemoryDetailModal } from '../daily/MemoryDetailModal';
import { FarawayViewData, PlaceSummary } from './farawayLogic';
import { FARAWAY_VIEWS, FarawayView } from './farawayNavigation';
import { getFarawayData, getFarawayMemory } from './farawayRepository';
import { getQuestAggregates } from './questRepository';
import { QuestSection } from './QuestSection';
import { getWishes } from './wishRepository';
import { WishSection } from './WishSection';

type FarawayNavigation = BottomTabNavigationProp<MainTabParamList, 'Faraway'>;

const emptyData: FarawayViewData = {
  visited: [],
  cityCount: 0,
  locatedMemoryCount: 0,
};
function formatMemoryDate(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
        {children}
      </Text>
      <View style={[styles.sectionLine, { backgroundColor: colors.line }]} />
    </View>
  );
}

function FootprintChapter() {
  return (
    <View style={styles.chapter}>
      <View style={styles.chapterEyebrow}>
        <Svg
          height={16}
          viewBox="0 0 24 24"
          width={16}
          fill="none"
          stroke="#B85C38"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        >
          <Circle cx={12} cy={10} r={3} />
          <Path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
        </Svg>
        <Text style={styles.chapterEyebrowText}>CHAPTER II</Text>
      </View>
      <Text style={styles.chapterTitle}>
        纸上的<Text style={styles.chapterAccent}>足迹</Text>
      </Text>
      <Text style={styles.chapterSubtitle}>每到一处，便落几笔</Text>
      <View style={styles.chapterLine}>
        <View style={styles.chapterLineAccent} />
      </View>
    </View>
  );
}

function CurrentPlaceCard({
  place,
  onPress,
}: {
  place: NonNullable<FarawayViewData['current']>;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看当前停驻城市${place.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.currentCard,
        {
          backgroundColor: colors.surfaceAged,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.currentHeader}>
        <View
          style={[styles.currentDot, { backgroundColor: place.colorHex }]}
        />
        <Text style={[styles.currentName, { color: colors.text }]}>
          {place.name}
        </Text>
        {place.stayedDays !== undefined ? (
          <Text style={[styles.currentSince, { color: colors.textMuted }]}>
            已停驻 {place.stayedDays} 天
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.currentQuote,
          { color: colors.textSoft, borderLeftColor: colors.accentSoft },
        ]}
      >
        {place.latestMemory?.content ?? '还没有在这里落下日迹。'}
      </Text>
      <View style={[styles.currentStats, { borderTopColor: colors.line }]}>
        <Text style={[styles.currentStat, { color: colors.textMuted }]}>
          <Text style={[styles.currentStatNumber, { color: colors.text }]}>
            {place.memories.length}
          </Text>
          笔
        </Text>
        <Text style={[styles.currentStat, { color: colors.textMuted }]}>
          <Text style={[styles.currentStatNumber, { color: colors.text }]}>
            {place.visitCount}
          </Text>
          次到访
        </Text>
      </View>
    </Pressable>
  );
}

function HometownCard({
  place,
  onOpen,
  onWrite,
}: {
  place: NonNullable<FarawayViewData['hometown']>;
  onOpen: () => void;
  onWrite: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.hometownCard,
        {
          backgroundColor: `${colors.sky}12`,
          borderLeftColor: `${colors.sky}66`,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看故乡${place.name}`}
        onPress={onOpen}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <Text style={[styles.hometownMark, { color: colors.textFaint }]}>
          HOMETOWN
        </Text>
        <Text style={[styles.hometownName, { color: colors.text }]}>
          {place.name}
        </Text>
        <Text style={[styles.hometownMeta, { color: colors.textMuted }]}>
          故乡
          {place.awayDays !== undefined
            ? ` · 已经 ${place.awayDays} 天没回去了`
            : ''}
        </Text>
        <Text style={[styles.hometownQuote, { color: colors.textSoft }]}>
          {place.latestMemory?.content ?? '还没有把故乡写进日迹。'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`寄封信回${place.name}`}
        onPress={onWrite}
        style={({ pressed }) => [
          styles.writeHome,
          { borderTopColor: colors.line, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.writeHomeText, { color: colors.accent }]}>
          寄封信回去 →
        </Text>
      </Pressable>
    </View>
  );
}

function PlaceCard({
  place,
  onPress,
}: {
  place: PlaceSummary;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tags = [
    `${place.visitCount}次`,
    ...(place.memories.length ? [`${place.memories.length}笔`] : []),
    ...place.tags,
  ].slice(0, 4);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${place.name}的日迹`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.placeCard,
        shadows.paper,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.placeMark}>
        <Text style={[styles.placeCharacter, { color: place.colorHex }]}>
          {place.chChar}
        </Text>
        <Text style={[styles.placePinyin, { color: colors.textFaint }]}>
          {place.pinyin}
        </Text>
        <View style={[styles.placeDot, { backgroundColor: place.colorHex }]} />
      </View>
      <View style={[styles.placeBody, { borderLeftColor: colors.line }]}>
        <View style={styles.placeTop}>
          <Text style={[styles.placeName, { color: colors.text }]}>
            {place.name}
          </Text>
          <Text style={[styles.placeDate, { color: colors.textFaint }]}>
            {place.dateRange}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.placeQuote, { color: colors.textMuted }]}
        >
          {place.latestMemory?.content ?? '还没有在这里写过。'}
        </Text>
        <View style={styles.placeTags}>
          {tags.map(tag => (
            <Text
              key={tag}
              style={[
                styles.placeTag,
                {
                  backgroundColor: colors.surfaceWarm,
                  color: colors.textMuted,
                },
              ]}
            >
              {tag}
            </Text>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function PlaceDetailModal({
  place,
  onClose,
  onOpenMemory,
}: {
  place?: PlaceSummary;
  onClose: () => void;
  onOpenMemory: (memoryId: string) => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const minimumHeight = Math.max(280, windowHeight * 0.5);
  const defaultHeight = windowHeight * 0.82;
  const maximumHeight = windowHeight * 0.92;
  const sheetHeight = useSharedValue(defaultHeight);
  const gestureStartHeight = useSharedValue(defaultHeight);

  useEffect(() => {
    if (place) {
      sheetHeight.value = defaultHeight;
    }
  }, [defaultHeight, place, sheetHeight]);

  const settleHeight = (nextHeight: number) => {
    const lowerBoundary = (minimumHeight + defaultHeight) / 2;
    const upperBoundary = (defaultHeight + maximumHeight) / 2;
    const target =
      nextHeight < lowerBoundary
        ? minimumHeight
        : nextHeight > upperBoundary
        ? maximumHeight
        : defaultHeight;
    sheetHeight.value = reduceMotion
      ? target
      : withSpring(target, {
          damping: 24,
          stiffness: 240,
        });
  };

  const dragGesture = Gesture.Pan()
    .onBegin(() => {
      gestureStartHeight.value = sheetHeight.value;
    })
    .onUpdate(event => {
      sheetHeight.value = Math.min(
        maximumHeight,
        Math.max(minimumHeight, gestureStartHeight.value - event.translationY),
      );
    })
    .onEnd(event => {
      const projectedHeight = sheetHeight.value - event.velocityY * 0.12;
      const lowerBoundary = (minimumHeight + defaultHeight) / 2;
      const upperBoundary = (defaultHeight + maximumHeight) / 2;
      const target =
        projectedHeight < lowerBoundary
          ? minimumHeight
          : projectedHeight > upperBoundary
          ? maximumHeight
          : defaultHeight;
      sheetHeight.value = reduceMotion
        ? target
        : withSpring(target, {
            damping: 24,
            stiffness: 240,
          });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const adjustHeight = (direction: 'increase' | 'decrease') => {
    const nextHeight =
      direction === 'increase'
        ? sheetHeight.value + windowHeight * 0.2
        : sheetHeight.value - windowHeight * 0.2;
    settleHeight(nextHeight);
  };

  return (
    <OverlayPortal
      name="faraway-place-detail"
      onRequestClose={onClose}
      visible={Boolean(place)}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="收起地点详情"
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        {place ? (
          <Animated.View
            style={[
              styles.sheet,
              shadows.deep,
              { backgroundColor: colors.background },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={dragGesture}>
              <Animated.View
                accessibilityActions={[
                  { name: 'increment', label: '展开地点详情' },
                  { name: 'decrement', label: '收起地点详情' },
                ]}
                accessibilityLabel="拖动调整地点详情高度"
                accessibilityRole="adjustable"
                accessible
                onAccessibilityAction={event => {
                  if (event.nativeEvent.actionName === 'increment') {
                    adjustHeight('increase');
                  } else if (event.nativeEvent.actionName === 'decrement') {
                    adjustHeight('decrease');
                  }
                }}
                style={styles.sheetHandleArea}
              >
                <View
                  style={[styles.sheetHandle, { backgroundColor: colors.line }]}
                />
              </Animated.View>
            </GestureDetector>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭地点详情"
              hitSlop={10}
              onPress={onClose}
              style={styles.sheetClose}
            >
              <Text
                style={[styles.sheetCloseText, { color: colors.textMuted }]}
              >
                ×
              </Text>
            </Pressable>
            <View
              style={[styles.sheetHeader, { borderBottomColor: colors.line }]}
            >
              <Text style={[styles.sheetCharacter, { color: place.colorHex }]}>
                {place.chChar}
              </Text>
              <Text style={[styles.sheetInfo, { color: colors.textMuted }]}>
                {place.dateRange || place.name} · 在此写了
                <Text style={{ color: colors.accent }}>
                  {place.memories.length}
                </Text>
                笔
              </Text>
              <Text style={[styles.sheetInfo, { color: colors.textMuted }]}>
                {place.visitCount}次到访
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.fragments}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.fragmentScroll}
            >
              {place.memories.length ? (
                place.memories.map(memory => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`查看${formatMemoryDate(
                      memory.writtenAt,
                    )}的日迹详情`}
                    key={memory.id}
                    onPress={() => onOpenMemory(memory.id)}
                    style={[
                      styles.fragment,
                      { borderBottomColor: colors.line },
                    ]}
                  >
                    <Text
                      style={[styles.fragmentTime, { color: colors.textFaint }]}
                    >
                      {formatMemoryDate(memory.writtenAt)}
                    </Text>
                    <Text style={[styles.fragmentText, { color: colors.text }]}>
                      {memory.content}
                    </Text>
                    <Text
                      style={[
                        styles.fragmentArrow,
                        { color: colors.textFaint },
                      ]}
                    >
                      →
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.sheetEmpty, { color: colors.textMuted }]}>
                  还没有在这里写过
                </Text>
              )}
            </ScrollView>
          </Animated.View>
        ) : null}
      </View>
    </OverlayPortal>
  );
}

export function FarawayScreen() {
  const navigation = useNavigation<FarawayNavigation>();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const anonymousId = useSettingsStore(state => state.anonymousId);
  const toast = useToast();
  const [data, setData] = useState<FarawayViewData>(emptyData);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSummary>();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<FarawayView>('places');
  const [wishCount, setWishCount] = useState(0);
  const [questCount, setQuestCount] = useState(0);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [questFocus, setQuestFocus] = useState<{
    questId: string;
    nodeId: string;
    revision: number;
  }>();
  const updateWishCount = useCallback(
    (count: number) => setWishCount(count),
    [],
  );
  const updateQuestCount = useCallback(
    (count: number) => setQuestCount(count),
    [],
  );

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const userId = anonymousId ?? undefined;
      const nextData = await getFarawayData(userId);
      setData(nextData);
      const [wishes, quests] = await Promise.allSettled([
        getWishes(userId),
        getQuestAggregates(userId),
      ]);
      if (wishes.status === 'fulfilled') {
        setWishCount(wishes.value.length);
      }
      if (quests.status === 'fulfilled') {
        setQuestCount(quests.value.length);
      }
    } catch (error) {
      console.error('远方数据读取失败', error);
      setLoadError(true);
    }
  }, [anonymousId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshRevision(current => current + 1);
    setRefreshing(false);
  }, [load]);

  const openPlace = (place: PlaceSummary) => {
    haptics.trigger('card');
    setSelectedPlace(place);
  };

  const openMemory = async (memoryId: string) => {
    haptics.trigger('card');
    try {
      const memory = await getFarawayMemory(memoryId);
      setSelectedPlace(undefined);
      setSelectedMemory(memory);
    } catch {
      toast.show('这条日迹暂时无法打开');
    }
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
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.viewTabs, { borderBottomColor: colors.line }]}>
          {FARAWAY_VIEWS.map(([value, label]) => {
            const count =
              value === 'places'
                ? data.cityCount
                : value === 'wishes'
                ? wishCount
                : questCount;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={`远方${label}`}
                accessibilityState={{ selected: view === value }}
                key={value}
                onPress={() => setView(value)}
                style={styles.viewTab}
              >
                <Text
                  style={[
                    styles.viewTabText,
                    { color: view === value ? colors.text : colors.textMuted },
                  ]}
                >
                  {label}
                  {count !== undefined ? (
                    <Text
                      style={[
                        styles.viewTabCount,
                        {
                          color:
                            view === value ? colors.accent : colors.textFaint,
                        },
                      ]}
                    >
                      {' '}
                      {count}
                    </Text>
                  ) : null}
                </Text>
                {view === value ? (
                  <View
                    style={[
                      styles.viewTabIndicator,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {view === 'quests' ? (
          <QuestSection
            focusTarget={questFocus}
            onCountChange={updateQuestCount}
            refreshRevision={refreshRevision}
            userId={anonymousId ?? undefined}
          />
        ) : view === 'wishes' ? (
          <WishSection
            onCountChange={updateWishCount}
            onOpenQuests={() => setView('quests')}
            onAttachedToQuest={(questId, nodeId) => {
              setQuestFocus({
                questId,
                nodeId,
                revision: Date.now(),
              });
              setView('quests');
              setRefreshRevision(current => current + 1);
            }}
            refreshRevision={refreshRevision}
            userId={anonymousId ?? undefined}
          />
        ) : loadError ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              暂时没能翻开旅途记录，下拉再试一次。
            </Text>
          </View>
        ) : data.cityCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              还没去过什么地方
            </Text>
          </View>
        ) : (
          <>
            <FootprintChapter />
            {data.current ? (
              <>
                <SectionTitle>现在停驻</SectionTitle>
                <CurrentPlaceCard
                  place={data.current}
                  onPress={() => openPlace(data.current!)}
                />
              </>
            ) : null}

            {data.hometown ? (
              <>
                <SectionTitle>最久未归</SectionTitle>
                <HometownCard
                  place={data.hometown}
                  onOpen={() => openPlace(data.hometown!)}
                  onWrite={() => {
                    haptics.trigger('button');
                    navigation.navigate('Write');
                  }}
                />
              </>
            ) : null}

            {data.visited.length ? (
              <>
                <SectionTitle>去过的地方</SectionTitle>
                <View style={styles.placeList}>
                  {data.visited.map(place => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      onPress={() => openPlace(place)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <PlaceDetailModal
        place={selectedPlace}
        onClose={() => setSelectedPlace(undefined)}
        onOpenMemory={openMemory}
      />
      <MemoryDetailModal
        memory={selectedMemory}
        onDeleted={() => load()}
        onDismiss={() => setSelectedMemory(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.pageBottom + spacing.xxl,
  },
  chapter: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 14,
  },
  chapterEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chapterEyebrowText: {
    color: '#B85C38',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 2.4,
  },
  chapterTitle: {
    marginTop: 6,
    color: '#3A332D',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 2,
  },
  chapterAccent: {
    color: '#B85C38',
  },
  chapterSubtitle: {
    marginTop: 3,
    color: '#8B7355',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  chapterLine: {
    height: 1,
    marginTop: 12,
    backgroundColor: 'rgba(58,51,45,0.1)',
  },
  chapterLineAccent: {
    width: 40,
    height: 1.5,
    backgroundColor: '#B85C38',
  },
  viewTabs: {
    minHeight: 46,
    paddingHorizontal: spacing.greeting,
    marginBottom: spacing.lg,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    gap: 28,
  },
  viewTab: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  viewTabText: {
    fontFamily: fontFamilies.serif,
    fontSize: 15,
    letterSpacing: 1,
  },
  viewTabCount: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 0,
  },
  viewTabIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -0.5,
    height: 1.5,
  },
  sectionHeading: {
    marginTop: spacing.xxl,
    marginBottom: spacing.gap,
    paddingHorizontal: spacing.greeting,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 3,
  },
  sectionLine: {
    flex: 1,
    height: 0.5,
  },
  currentCard: {
    marginHorizontal: spacing.page,
    borderRadius: radius.paper,
    padding: spacing.xl,
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
    marginBottom: spacing.cardGap,
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: radius.round,
  },
  currentName: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
  },
  currentSince: {
    marginLeft: 'auto',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  currentQuote: {
    borderLeftWidth: 1.5,
    paddingLeft: spacing.card,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    fontStyle: 'italic',
    lineHeight: 24.7,
  },
  currentStats: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  currentStat: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  currentStatNumber: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 14,
  },
  hometownCard: {
    marginHorizontal: spacing.page,
    borderLeftWidth: 2,
    borderRadius: radius.paper,
    padding: spacing.card,
  },
  hometownMark: {
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 2,
  },
  hometownName: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.bodyLarge,
  },
  hometownMeta: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  hometownQuote: {
    marginTop: spacing.cardGap,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    fontStyle: 'italic',
    lineHeight: lineHeights.secondary,
  },
  writeHome: {
    marginTop: spacing.md,
    paddingTop: spacing.cardGap,
    borderTopWidth: 0.5,
    borderStyle: 'dashed',
  },
  writeHomeText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  placeList: {
    paddingHorizontal: spacing.page,
  },
  placeCard: {
    marginBottom: spacing.cardGap,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderRadius: radius.paper,
    flexDirection: 'row',
    gap: spacing.gap,
  },
  placeMark: {
    width: 40,
    alignItems: 'center',
    paddingTop: spacing.xxs,
  },
  placeCharacter: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 20,
    lineHeight: 22,
  },
  placePinyin: {
    marginTop: 3,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  placeDot: {
    width: 4,
    height: 4,
    marginTop: 6,
    borderRadius: radius.round,
  },
  placeBody: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 0.5,
    paddingLeft: spacing.gap,
  },
  placeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  placeName: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.body,
  },
  placeDate: {
    flexShrink: 0,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 1,
  },
  placeQuote: {
    marginTop: 6,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 21.6,
  },
  placeTags: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  placeTag: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  emptyState: {
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 25,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(30,25,20,0.5)',
  },
  sheet: {
    minHeight: 280,
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    overflow: 'hidden',
  },
  sheetHandleArea: {
    height: 38,
    marginHorizontal: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 3,
    alignSelf: 'center',
    borderRadius: radius.round,
  },
  sheetClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  sheetCloseText: {
    fontFamily: fontFamilies.sans,
    fontSize: 24,
    lineHeight: 28,
  },
  sheetHeader: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  sheetCharacter: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 32,
  },
  sheetInfo: {
    marginTop: 6,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 0.5,
  },
  fragments: {
    paddingBottom: spacing.xxxl,
  },
  fragmentScroll: {
    flex: 1,
  },
  fragment: {
    paddingVertical: spacing.gap,
    borderBottomWidth: 0.5,
  },
  fragmentTime: {
    marginBottom: 6,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 2,
  },
  fragmentText: {
    paddingRight: spacing.xl,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 26.6,
  },
  fragmentArrow: {
    position: 'absolute',
    top: spacing.gap,
    right: 2,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  sheetEmpty: {
    paddingVertical: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
});
