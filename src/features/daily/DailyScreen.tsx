import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {PlaceholderScreen} from '../../components/PlaceholderScreen';
import {useToast} from '../../components/Toast';
import {getRecentMemories} from '../../db/memoryRepository';
import {Memory} from '../../db/models';
import {useHaptics} from '../../hooks/useHaptics';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {fontFamilies, fontSizes} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';

export function DailyScreen() {
  const {colors} = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const [memories, setMemories] = useState<Memory[]>([]);
  const now = useMemo(() => new Date(), []);
  const greeting =
    now.getHours() < 6
      ? '夜深了'
      : now.getHours() < 12
        ? '早上好'
        : now.getHours() < 18
          ? '下午好'
          : '晚上好';
  const dateText = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);

  useEffect(() => {
    let active = true;
    getRecentMemories()
      .then(records => {
        if (active) {
          setMemories(records);
        }
      })
      .catch(error => console.error('读取日迹失败', error));
    return () => {
      active = false;
    };
  }, []);

  return (
    <PlaceholderScreen title="日迹">
      <Text style={[styles.date, {color: colors.textMuted}]}>{dateText}</Text>
      <Text style={[styles.greeting, {color: colors.text}]}>{greeting}</Text>
      {__DEV__ ? (
        <View style={[styles.seedCard, {backgroundColor: colors.surface, borderColor: colors.line}]}>
          <Text style={[styles.seedLabel, {color: colors.accent}]}>开发期数据</Text>
          <Text style={[styles.seedText, {color: colors.textSoft}]}>已从本地数据库读到 {memories.length} 个此刻</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="显示提示"
        onPress={() => {
          haptics.trigger('button');
          toast.show('此刻不落，就散了');
        }}
        style={[styles.button, {backgroundColor: colors.surface, borderColor: colors.line}]}>
        <Text style={[styles.buttonText, {color: colors.textSoft}]}>试试提示</Text>
      </Pressable>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  date: {fontFamily: fontFamilies.sans, fontSize: fontSizes.caption, marginBottom: spacing.xs},
  greeting: {fontFamily: fontFamilies.serif, fontSize: fontSizes.title, marginBottom: spacing.lg},
  seedCard: {width: '100%', borderWidth: 0.5, borderRadius: radius.paper, padding: spacing.lg, marginBottom: spacing.lg},
  seedLabel: {fontFamily: fontFamilies.sans, fontSize: fontSizes.caption, letterSpacing: 1},
  seedText: {marginTop: spacing.sm, fontFamily: fontFamilies.serif, fontSize: fontSizes.secondary},
  button: {borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md},
  buttonText: {fontFamily: fontFamilies.serif, fontSize: fontSizes.body},
});
