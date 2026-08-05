import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Letter } from '../../db/models';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes, lineHeights } from '../../tokens/typography';
import { detailColors } from './MemoryDetailParts';

const stampOptions = [
  { months: 3, title: '三个月后', subtitle: '等季节轻轻转身' },
  { months: 6, title: '半年后', subtitle: '隔着一场冷暖' },
  { months: 12, title: '一年后', subtitle: '在同一天重逢' },
  { months: 24, title: '两年后', subtitle: '让时间多走一程' },
];

export function ReplySheet({
  onClose,
  onSend,
  submitting,
}: {
  onClose: () => void;
  onSend: (content: string) => void;
  submitting: boolean;
}) {
  const [content, setContent] = useState('');
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.sheetLayer}
    >
      <Pressable
        accessibilityLabel="关闭回信浮层"
        onPress={onClose}
        style={styles.sheetBackdrop}
      />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetEyebrow}>REPLY TO THIS MOMENT</Text>
        <Text style={styles.sheetTitle}>写给那时的你</Text>
        <TextInput
          accessibilityLabel="回信内容"
          autoFocus
          defaultValue=""
          multiline
          onChangeText={setContent}
          placeholder="隔着时间，说一句想说的话……"
          placeholderTextColor={detailColors.inkFaint}
          style={styles.replyInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="夹进这页"
          disabled={!content.trim() || submitting}
          onPress={() => onSend(content)}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              opacity: !content.trim() || submitting ? 0.4 : pressed ? 0.78 : 1,
            },
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? '正在夹入……' : '夹进这页'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export function StampSheet({
  currentStamp,
  onClose,
  onPick,
  onRemove,
  onCustom,
  submitting,
}: {
  currentStamp: Letter | null;
  onClose: () => void;
  onPick: (months: number) => void;
  onRemove: () => void;
  onCustom: () => void;
  submitting: boolean;
}) {
  return (
    <View style={styles.sheetLayer}>
      <Pressable
        accessibilityLabel="关闭邮票浮层"
        onPress={onClose}
        style={styles.sheetBackdrop}
      />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetEyebrow}>STAMP FOR THE FUTURE</Text>
        <Text style={styles.sheetTitle}>
          {currentStamp ? '换一个到达日' : '让这一刻再次抵达'}
        </Text>
        <View style={styles.stampGrid}>
          {stampOptions.map(option => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`寄到${option.title}`}
              disabled={submitting}
              key={option.months}
              onPress={() => onPick(option.months)}
              style={({ pressed }) => [
                styles.stampOption,
                { opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <View style={styles.stampEdge}>
                <Text style={styles.stampMonth}>{option.months}</Text>
                <Text style={styles.stampUnit}>MONTHS</Text>
              </View>
              <Text style={styles.stampTitle}>{option.title}</Text>
              <Text style={styles.stampSubtitle}>{option.subtitle}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={onCustom}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>另选一天</Text>
        </Pressable>
        {currentStamp ? (
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={onRemove}
            style={styles.removeStamp}
          >
            <Text style={styles.removeStampText}>撕下现在的邮票</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(59,50,42,0.26)',
  },
  sheet: {
    maxHeight: '82%',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.xl,
    backgroundColor: detailColors.note,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    boxShadow: '0 -8px 28px rgba(59,50,42,0.18)',
  },
  sheetHandle: {
    width: 36,
    height: 3,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    borderRadius: radius.round,
    backgroundColor: 'rgba(154,139,123,0.35)',
  },
  sheetEyebrow: {
    color: detailColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 11,
    letterSpacing: 2,
  },
  sheetTitle: {
    color: detailColors.ink,
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h2,
  },
  replyInput: {
    minHeight: 140,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: detailColors.ink,
    backgroundColor: detailColors.slip,
    borderWidth: 0.7,
    borderColor: 'rgba(91,79,68,0.12)',
    textAlignVertical: 'top',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    backgroundColor: detailColors.accent,
    borderRadius: 2,
  },
  primaryButtonText: {
    color: detailColors.note,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    letterSpacing: 2,
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  stampOption: {
    width: '47%',
    minHeight: 132,
    padding: spacing.md,
    backgroundColor: detailColors.slip,
    borderWidth: 0.7,
    borderColor: 'rgba(192,112,74,0.20)',
  },
  stampEdge: {
    width: 46,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: detailColors.accent,
    borderStyle: 'dashed',
  },
  stampMonth: {
    color: detailColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 21,
    lineHeight: 22,
  },
  stampUnit: {
    color: detailColors.accent,
    fontFamily: fontFamilies.sans,
    fontSize: 6,
    letterSpacing: 0.5,
  },
  stampTitle: {
    color: detailColors.ink,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.meta,
  },
  stampSubtitle: {
    color: detailColors.inkLight,
    marginTop: spacing.xxs,
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  textButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  textButtonLabel: {
    color: detailColors.accent,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
  },
  removeStamp: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0.6,
    borderTopColor: 'rgba(91,79,68,0.10)',
  },
  removeStampText: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
  },
});
