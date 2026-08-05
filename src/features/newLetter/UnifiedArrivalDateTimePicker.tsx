import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DatePicker from 'react-native-date-picker';

import { OverlayPortal } from '../../components/OverlayHost';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { shadows } from '../../tokens/shadows';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';
import {
  combineArrivalDateAndTime,
  formatArrivalDate,
} from './futureLetterLogic';

export function UnifiedArrivalDateTimePicker({
  date,
  minimumDate,
  name,
  onCancel,
  onConfirm,
  visible,
}: {
  date: Date;
  minimumDate: Date;
  name: string;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  visible: boolean;
}) {
  const { colors, isDark } = useTheme();
  const [draft, setDraft] = useState(date);
  const paperThemeStyle = {
    backgroundColor: isDark ? colors.surfaceWarm : '#FBF5E8',
    borderColor: colors.line,
  };

  useEffect(() => {
    if (visible) {
      setDraft(date);
    }
  }, [date, visible]);

  return (
    <OverlayPortal
      blurBackground
      name={name}
      onRequestClose={onCancel}
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="取消选择到达时刻"
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View
          accessibilityLabel="年月日时分选择器"
          accessibilityViewIsModal
          style={[styles.paper, shadows.deep, paperThemeStyle]}
        >
          <View style={styles.tape} />
          <Text style={[styles.title, { color: colors.text }]}>
            选择到达时刻
          </Text>
          <Text style={[styles.summary, { color: colors.accent }]}>
            {formatArrivalDate(draft)}
          </Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              年 · 月 · 日
            </Text>
            <View
              accessibilityLabel="选择到达年月日"
              style={styles.pickerFrame}
            >
              <DatePicker
                date={draft}
                locale="zh-CN"
                minimumDate={minimumDate}
                mode="date"
                onDateChange={selectedDate => {
                  setDraft(current =>
                    combineArrivalDateAndTime(selectedDate, current),
                  );
                }}
                style={styles.datePicker}
                theme={isDark ? 'dark' : 'light'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              时 · 分
            </Text>
            <View
              accessibilityLabel="选择到达时分"
              style={styles.timePickerFrame}
            >
              <DatePicker
                date={draft}
                is24hourSource="locale"
                locale="zh-CN"
                minuteInterval={1}
                mode="time"
                onDateChange={selectedTime => {
                  setDraft(current =>
                    combineArrivalDateAndTime(current, selectedTime),
                  );
                }}
                style={styles.timePicker}
                theme={isDark ? 'dark' : 'light'}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消年月日时分选择"
              onPress={onCancel}
              style={[styles.action, { borderColor: colors.line }]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="确定年月日时分"
              onPress={() => onConfirm(draft)}
              style={[styles.action, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.confirmText}>确定到达时刻</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </OverlayPortal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(38,31,25,0.3)',
  },
  paper: {
    width: '100%',
    maxWidth: 352,
    maxHeight: '92%',
    paddingTop: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.paper,
    overflow: 'hidden',
  },
  tape: {
    position: 'absolute',
    top: -6,
    left: '37%',
    width: 90,
    height: 22,
    backgroundColor: 'rgba(226,205,162,0.72)',
    transform: [{ rotate: '-1deg' }],
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
    letterSpacing: 1,
  },
  summary: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  section: {
    alignItems: 'center',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 2,
  },
  pickerFrame: {
    width: '100%',
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  timePickerFrame: {
    width: '100%',
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  datePicker: {
    width: 310,
    height: 150,
  },
  timePicker: {
    width: 230,
    height: 112,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.paper,
  },
  cancelText: {
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  confirmText: {
    color: '#FFF9EF',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 14,
  },
});
