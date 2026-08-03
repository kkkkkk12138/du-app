import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/useTheme';
import { fontFamilies } from '../../tokens/typography';
import { AnnualSummary, getAnnualSummary } from './annualSummaryRepository';

export function AnnualSummaryScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [summary, setSummary] = useState<AnnualSummary>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAnnualSummary()
      .then(setSummary)
      .catch(() => setFailed(true));
  }, []);

  const empty = summary?.memoryCount === 0 && summary.letterCount === 0;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回个人页"
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textSoft }]}>‹ 我</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          我的年度
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.year, { color: colors.text }]}>
          {summary?.year ?? new Date().getFullYear()}
        </Text>
        <Text style={[styles.kicker, { color: colors.textFaint }]}>
          这一年，时间在纸上留下的痕迹
        </Text>

        {failed ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            年度数据暂时无法读取
          </Text>
        ) : !summary ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            正在翻阅这一年的纸页…
          </Text>
        ) : empty ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            今年还没有落下日迹或寄出信件。
          </Text>
        ) : (
          <>
            <View style={[styles.stats, { backgroundColor: colors.surface }]}>
              <Stat label="落笔" value={summary.memoryCount} />
              <Divider />
              <Stat label="写过的日子" value={summary.activeDayCount} />
              <Divider />
              <Stat label="写信" value={summary.letterCount} />
            </View>

            <View style={[styles.group, { backgroundColor: colors.surface }]}>
              <Fact
                label="最常落笔"
                value={
                  summary.topMonth
                    ? `${summary.topMonth} 月 · ${summary.topMonthCount} 篇`
                    : '暂无'
                }
              />
              <Fact label="最常记起的地方" value={summary.topPlace ?? '暂无'} />
              <Fact
                label="收到的回信"
                value={`${summary.openedLetterCount} 封`}
                last
              />
            </View>

            {summary.firstEntryAt && summary.lastEntryAt ? (
              <Text style={[styles.range, { color: colors.textFaint }]}>
                从 {formatDate(summary.firstEntryAt)} 到{' '}
                {formatDate(summary.lastEntryAt)}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textFaint }]}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.line }]} />;
}

function Fact({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fact,
        last ? styles.lastFact : null,
        { borderBottomColor: colors.line },
      ]}
    >
      <Text style={[styles.factLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors.textMuted }]}>
        {value}
      </Text>
    </View>
  );
}

function formatDate(date: Date) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: { fontFamily: fontFamilies.sans, fontSize: 14 },
  headerTitle: {
    position: 'absolute',
    left: 80,
    right: 80,
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
  },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 },
  year: {
    textAlign: 'center',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 44,
  },
  kicker: {
    marginTop: 2,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  empty: {
    marginTop: 80,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  stats: {
    marginTop: 28,
    height: 76,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fontFamilies.englishSerif, fontSize: 24 },
  statLabel: { fontFamily: fontFamilies.sans, fontSize: 9.5 },
  divider: { width: 0.5, height: 30 },
  group: { marginTop: 14, borderRadius: 9, overflow: 'hidden' },
  fact: {
    height: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.3,
  },
  lastFact: { borderBottomWidth: 0 },
  factLabel: { flex: 1, fontFamily: fontFamilies.sans, fontSize: 12 },
  factValue: { fontFamily: fontFamilies.sans, fontSize: 10.5 },
  range: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
  },
});
