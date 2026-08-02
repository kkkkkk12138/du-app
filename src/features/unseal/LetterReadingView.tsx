import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

type LetterReadingViewProps = {
  item: LetterWithMemory;
  sourceLabel: string;
  onBack: () => void;
  onReply: () => void;
  onArchive: () => void;
  onError: (message: string) => void;
};

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
  onError,
}: LetterReadingViewProps) {
  const isReply = item.letter.status === 'reply';
  const paragraphs = splitLetter(item.memory.content);
  const hasPhoto = Boolean(item.memory.imagePath || item.memory.photoTone);

  return (
    <View style={styles.screen}>
      <PaperTexture />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`返回${sourceLabel}`}
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.backGlyph}>‹</Text>
            <Text style={styles.backLabel}>{sourceLabel}</Text>
          </Pressable>
          <Text style={styles.toolbarTitle}>{isReply ? '回信' : '原信'}</Text>
          <View style={styles.toolbarBalance} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.letterPaper}>
            <View style={styles.tape} />
            <View style={styles.redThread} />
            <Text style={styles.salute}>
              {isReply ? '那时的我，' : `${item.letter.toName}，`}
            </Text>
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: detailColors.background },
  safeArea: { flex: 1 },
  toolbar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    zIndex: 50,
  },
  backButton: {
    minWidth: 88,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  backGlyph: {
    color: detailColors.ink,
    marginTop: -2,
    fontFamily: fontFamilies.sans,
    fontSize: 30,
    lineHeight: 32,
  },
  backLabel: {
    color: detailColors.inkSoft,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
  },
  toolbarTitle: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
  },
  toolbarBalance: { width: 88 },
  content: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: 46,
  },
  letterHead: { paddingHorizontal: spacing.xs, marginBottom: spacing.xl },
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
    paddingHorizontal: spacing.xl,
    paddingTop: 38,
    paddingBottom: spacing.xxl,
    backgroundColor: detailColors.note,
    borderRadius: 3,
    boxShadow: '0 8px 26px rgba(72,53,38,0.11)',
  },
  tape: {
    position: 'absolute',
    top: -9,
    left: '39%',
    width: 82,
    height: 21,
    backgroundColor: 'rgba(221,199,159,0.53)',
    transform: [{ rotate: '-2deg' }],
  },
  redThread: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 13,
    width: 1,
    backgroundColor: 'rgba(192,112,74,0.12)',
  },
  salute: {
    color: detailColors.ink,
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
  },
  paragraph: {
    color: detailColors.ink,
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.serif,
    fontSize: 17,
    lineHeight: 32,
    letterSpacing: 0.35,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xl,
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
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
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
});
