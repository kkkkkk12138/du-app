import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '../../components/Toast';
import {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/RootNavigator';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes } from '../../tokens/typography';
import { useTheme } from '../../theme/useTheme';
import {
  daysUntil,
  getLetterProgress,
  getLettersData,
  LetterSections,
  LetterWithMemory,
} from './lettersRepository';

type LettersNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Letters'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const emptySections: LetterSections = {
  arriving: [],
  traveling: [],
  opened: [],
  tomorrowCount: 0,
};

function formatDate(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function letterTitle(item: LetterWithMemory) {
  return item.letter.toName
    ? `写给${item.letter.toName}`
    : item.memory.content.slice(0, 18);
}

function Stat({
  count,
  label,
  accent,
  onPress,
}: {
  count: number;
  label: string;
  accent?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${count}封`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, { opacity: pressed ? 0.6 : 1 }]}
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
  const elapsedYears = Math.max(
    0,
    now.getFullYear() - item.letter.sentAt.getFullYear(),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`拆开${letterTitle(item)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.letterStrip,
        styles.arrivingStrip,
        {
          backgroundColor: colors.surfaceAged,
          borderLeftColor: colors.accent,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
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
  );
}

function TravelingLetter({
  item,
  now,
  onPress,
}: {
  item: LetterWithMemory;
  now: Date;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const days = Math.max(1, daysUntil(item.letter.arriveDate, now));
  const progress = Math.round(getLetterProgress(item.letter, now) * 100);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${letterTitle(item)}，还有${days}天到达`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.letterStrip,
        styles.travelingStrip,
        {
          backgroundColor: colors.surfaceWarm,
          borderLeftColor: colors.surfaceAged,
          opacity: pressed ? 0.5 : 0.72,
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
          opacity: pressed ? 0.5 : 0.72,
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

export function LettersScreen() {
  const navigation = useNavigation<LettersNavigation>();
  const { colors } = useTheme();
  const toast = useToast();
  const [sections, setSections] = useState(emptySections);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    }
    const current = new Date();
    setNow(current);
    try {
      setSections(await getLettersData(current));
      setError(false);
    } catch (loadError) {
      console.error('读取信箱失败', loadError);
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

  const totalCount = useMemo(
    () =>
      sections.arriving.length +
      sections.traveling.length +
      sections.opened.length,
    [sections],
  );

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
              onPress={() => toast.show('明日到的信')}
            />
            <View
              style={[styles.statDot, { backgroundColor: colors.surfaceAged }]}
            />
            <Stat
              count={sections.traveling.length}
              label="在途中"
              onPress={() => toast.show('在途中的信')}
            />
            <View
              style={[styles.statDot, { backgroundColor: colors.surfaceAged }]}
            />
            <Stat
              count={sections.opened.length}
              label="已拆"
              onPress={() => toast.show('已拆的信')}
            />
          </View>
        </View>

        {sections.arriving.length ? (
          <View style={styles.section}>
            <SectionTitle>即将靠岸</SectionTitle>
            {sections.arriving.map(item => (
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

        {sections.traveling.length ? (
          <View style={styles.section}>
            <SectionTitle>在途中</SectionTitle>
            {sections.traveling.map(item => (
              <TravelingLetter
                item={item}
                key={item.letter.id}
                now={now}
                onPress={() => toast.show('信件在途中')}
              />
            ))}
          </View>
        ) : null}

        {sections.opened.length ? (
          <View style={styles.section}>
            <SectionTitle>已拆</SectionTitle>
            {sections.opened.map(item => (
              <OpenedLetter
                item={item}
                key={item.letter.id}
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

        {!totalCount && !error ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            还没有信漂在时间里
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
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    paddingHorizontal: spacing.card,
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
  empty: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
  },
});
