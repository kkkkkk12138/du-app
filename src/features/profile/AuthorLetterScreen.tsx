import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appMetadata } from '../../config/appMetadata';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';

const paragraphs = [
  '你好，我是渡的作者。',
  '渡是一本小本子。它不催你打卡，不统计你写了多少字，也不会因为今天没有落笔，就用一个红点提醒你内疚。你打开，写两笔，合上，它就安静地留在那里。',
  '我想念纸的原因很简单：纸不发光，不震动，也不会突然推来另一件事。你写了，它便收好；你不写，它也不追问。我希望渡同样老实。',
  '日迹收下正在发生的片刻，信把一句话送往更远的时间，念想留住尚未出发的心愿，副本则把漫长的事拆成一页页可以抵达的小站。它们不是任务清单，只是给生活留下几处可以回望的折痕。',
  '以前我用过很多日记应用。它们都很好，好到每次打开，我先要决定写在哪里、选哪个模板、今天算不算坚持。想完这些，反而没有写下真正想说的话。',
  '所以渡不要求你坚持。写下来的日子有痕迹，没有写的日子也完整。记录不该成为另一份需要交付的功课。',
  '取名叫“渡”，是因为日子总要一程一程地过。有些日子轻，一划就到岸；有些日子沉，要慢慢划。真正能渡你的人还是你自己，我能做的，只是递来一张干净的纸。',
  '写这封信时，我坐在黄浦江边。几年前第一次来这里，抬头看那些高楼，觉得它们亮得与我没有关系。后来某个普通傍晚，我忽然想起当时的自己，才明白过去的时刻并没有消失，只是很少被认真回望。',
  '这是写给你的第一封信。以后也许还会有新的纸页，写渡的变化，也写一些无关紧要却舍不得忘的事。',
  '你可能不会每天打开渡。那就对了。',
  '谢谢你愿意坐下来，跟自己待一会儿。',
];

export function AuthorLetterScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回个人页"
          hitSlop={12}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textMuted }]}>收回</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          作者的信
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.paper, { backgroundColor: colors.surface }]}>
          <View style={[styles.seal, { backgroundColor: colors.seal }]}>
            <Text style={styles.sealText}>渡</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>为什么做渡</Text>
          <Text style={[styles.english, { color: colors.textFaint }]}>
            A LETTER FROM THE MAKER
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.accent }]} />
          {paragraphs.map(paragraph => (
            <Text
              key={paragraph}
              style={[styles.paragraph, { color: colors.textSoft }]}
            >
              {paragraph}
            </Text>
          ))}
          <Text style={[styles.sign, { color: colors.text }]}>—— 渡河人</Text>
          <Text style={[styles.meta, { color: colors.textFaint }]}>
            第一封 · 2026 年夏，于黄浦江畔
          </Text>
          <Text style={[styles.version, { color: colors.textFaint }]}>
            Version {appMetadata.version} · made with paper & ink
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontFamily: fontFamilies.serif, fontSize: 13 },
  headerTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 17 },
  headerSpacer: { width: 34 },
  content: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.pageBottom,
  },
  paper: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    borderRadius: 3,
  },
  seal: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    transform: [{ rotate: '-4deg' }],
  },
  sealText: { color: '#F5EDE0', fontFamily: fontFamilies.serif, fontSize: 21 },
  title: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 24,
    letterSpacing: 2,
  },
  english: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 2,
  },
  divider: {
    width: 44,
    height: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    opacity: 0.35,
  },
  paragraph: {
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 24,
    letterSpacing: 0.25,
  },
  sign: {
    marginTop: spacing.sm,
    textAlign: 'right',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  meta: {
    marginTop: spacing.sm,
    textAlign: 'right',
    fontFamily: fontFamilies.serif,
    fontSize: 9,
  },
  version: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 1,
  },
});
