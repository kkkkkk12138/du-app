import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet,  View } from 'react-native';
import {AppText as Text} from "../../components/AppText";

import type { LetterWithMemory } from '../letters/lettersRepository';
import {
  AudioStrip,
  detailColors,
  HandwritingAttachment,
  PaperTexture,
  Polaroid,
} from '../daily/MemoryDetailParts';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes } from '../../tokens/typography';
import {
  handwrittenLetterGreeting,
  handwrittenLetterText,
  LETTER_TEXT_LINE_HEIGHT,
  startsWithLetterSalutation,
} from '../letters/letterTextStyle';

type LetterReadingViewProps = {
  item: LetterWithMemory;
  sourceLabel: string;
  onBack: () => void;
  onReply: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
};

const LETTER_LINE_HEIGHT = LETTER_TEXT_LINE_HEIGHT;
const LETTER_MIN_RULES = 16;
const LETTER_RULE_TOP = 9;

function formatDate(date: Date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}.${String(date.getDate()).padStart(2, '0')}`;
}

function splitLetter(content: string) {
  const paragraphs = content
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs : [content];
}

export function LetterReadingView({
  item,
  sourceLabel,
  onBack,
  onReply,
  onArchive,
  onDelete,
  onError,
}: LetterReadingViewProps) {
  const isReply = item.letter.status === 'reply';
  const paragraphs = splitLetter(item.memory.content);
  const hasWrittenSalutation = startsWithLetterSalutation(item.memory.content);
  const hasPhoto = Boolean(item.memory.imagePath || item.memory.photoTone);
  const [ruleCount, setRuleCount] = useState(LETTER_MIN_RULES);

  return (
    <View style={styles.screen}>
      <PaperTexture />
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`返回${sourceLabel}`}
          hitSlop={12}
          onPress={onBack}
          testID="letter-reading-collapse"
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Text style={styles.backLabel}>收起</Text>
        </Pressable>
        <Text style={styles.toolbarTitle}>{isReply ? '回信' : '原信'}</Text>
        <View style={styles.toolbarBalance} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.letterContent}>
          <View style={styles.letterHead}>
            <Text style={styles.eyebrow}>
              {isReply ? 'A REPLY KEPT IN TIME' : 'A LETTER ACROSS TIME'}
            </Text>
            <Text style={styles.title}>
              {isReply ? '回给那一天的自己' : `写给${item.letter.toName}`}
            </Text>
            <Text style={styles.meta}>
              {formatDate(item.letter.sentAt)}
              {item.memory.placeDetail ? ` · ${item.memory.placeDetail}` : ''}
            </Text>
          </View>

          <View
            onLayout={event => {
              const count = Math.max(
                LETTER_MIN_RULES,
                Math.ceil(event.nativeEvent.layout.height / LETTER_LINE_HEIGHT),
              );
              setRuleCount(current => (current === count ? current : count));
            }}
            style={styles.letterPaper}
            testID="full-letter-paper"
          >
            <View
              pointerEvents="none"
              style={styles.paperRules}
              testID="full-letter-rules"
            >
              {Array.from({ length: ruleCount }, (_, index) => (
                <View key={index} style={styles.paperRule} />
              ))}
            </View>
            <View style={styles.redThread} />
            {!hasWrittenSalutation ? (
              <Text style={styles.salute}>
                {isReply ? '那时的我，' : `${item.letter.toName}，`}
              </Text>
            ) : null}
            {paragraphs.map((paragraph, index) => (
              <Text key={`${index}-${paragraph}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {hasPhoto ? <Polaroid memory={item.memory} /> : null}
            {item.memory.audioPath ? (
              <AudioStrip memory={item.memory} onError={onError} />
            ) : null}
            {item.memory.inkImagePath ? (
              <HandwritingAttachment path={item.memory.inkImagePath} />
            ) : null}
            <View style={styles.signatureRow}>
              <View style={styles.signatureLine} />
              <Text style={styles.signature}>
                {isReply ? '此刻的你' : '那时的你'}
              </Text>
            </View>
          </View>

          <View style={styles.journey}>
            <View style={styles.journeyDot} />
            <View style={styles.journeyLine} />
            <View style={styles.journeyDot} />
            <View style={styles.journeyCopy}>
              <Text style={styles.journeyDate}>
                {formatDate(item.letter.sentAt)}
              </Text>
              <Text style={styles.journeyLabel}>
                {isReply
                  ? '这封回信已收进信箱'
                  : `于 ${formatDate(item.letter.arriveDate)} 抵达`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="写封回信"
            onPress={onReply}
            style={({ pressed }) => [
              styles.primaryAction,
              { opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <Text style={styles.primaryMark}>＋</Text>
            <Text style={styles.primaryText}>写封回信</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="放回日迹"
            onPress={onArchive}
            style={({ pressed }) => [
              styles.archiveAction,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.archiveText}>放回日迹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="删除这封信"
            onPress={onDelete}
            style={({ pressed }) => [
              styles.deleteAction,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.deleteText}>删除这封信</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: detailColors.note },
  toolbar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.cardGap,
    zIndex: 50,
    elevation: 8,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    zIndex: 51,
    elevation: 9,
  },
  backLabel: {
    color: detailColors.inkSoft,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    letterSpacing: 1,
  },
  toolbarTitle: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
  },
  toolbarBalance: { width: 44 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingBottom: spacing.sm,
  },
  letterContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  letterHead: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    color: detailColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 2.2,
  },
  title: {
    color: detailColors.ink,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: 27,
    letterSpacing: 1,
  },
  meta: {
    color: detailColors.inkLight,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 0.8,
  },
  letterPaper: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: LETTER_LINE_HEIGHT * LETTER_MIN_RULES,
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: spacing.xxl,
    backgroundColor: 'rgba(255,252,243,0.42)',
  },
  paperRules: {
    position: 'absolute',
    top: LETTER_RULE_TOP,
    right: 0,
    bottom: 0,
    left: 0,
  },
  paperRule: {
    height: 1,
    marginTop: LETTER_LINE_HEIGHT - 1,
    backgroundColor: 'rgba(112,88,65,0.105)',
  },
  redThread: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 9,
    width: 1,
    backgroundColor: 'rgba(192,112,74,0.16)',
  },
  salute: {
    ...handwrittenLetterGreeting,
  },
  paragraph: {
    ...handwrittenLetterText,
    marginBottom: LETTER_LINE_HEIGHT,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: LETTER_LINE_HEIGHT,
  },
  signatureLine: {
    width: 24,
    height: 0.7,
    backgroundColor: detailColors.accentSoft,
  },
  signature: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
  },
  journey: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  journeyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: detailColors.accent,
  },
  journeyLine: {
    width: 42,
    height: 0.7,
    backgroundColor: detailColors.accentSoft,
  },
  journeyCopy: { marginLeft: spacing.md },
  journeyDate: {
    color: detailColors.inkSoft,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.meta,
    letterSpacing: 0.8,
  },
  journeyLabel: {
    color: detailColors.inkLight,
    marginTop: spacing.xxs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
  },
  actions: {
    marginTop: spacing.xxl,
    marginHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(114, 86, 62, 0.18)',
  },
  primaryAction: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: detailColors.ink,
    borderRadius: 3,
  },
  primaryMark: {
    color: detailColors.accentSoft,
    fontFamily: fontFamilies.sans,
    fontSize: 19,
  },
  primaryText: {
    color: detailColors.note,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    letterSpacing: 2,
  },
  archiveAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  archiveText: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
  },
  deleteAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  deleteText: {
    color: '#A24A3B',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
});
