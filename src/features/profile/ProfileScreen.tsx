import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import {useToast} from '../../components/Toast';
import {useHaptics} from '../../hooks/useHaptics';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {ThemeMode, useSettingsStore} from '../../store/useSettingsStore';
import {useTheme} from '../../theme/useTheme';
import {primitiveColors} from '../../tokens/colors';
import {radius} from '../../tokens/radius';
import {shadows} from '../../tokens/shadows';
import {spacing} from '../../tokens/spacing';
import {fontFamilies, fontSizes, lineHeights} from '../../tokens/typography';
import {formatReminderTime, reminderTimeToDate} from './reminderTimeLogic';

const themeOptions: Array<{label: string; value: ThemeMode}> = [
  {label: '跟随系统', value: 'system'},
  {label: '浅色', value: 'light'},
  {label: '深色', value: 'dark'},
];

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {colors, isDark, mode, setMode} = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const [letterTimePickerOpen, setLetterTimePickerOpen] = useState(false);
  const duNumber = useSettingsStore(state => state.duNumber);
  const dailyReminderOn = useSettingsStore(state => state.dailyReminderOn);
  const dailyReminderTime = useSettingsStore(state => state.dailyReminderTime);
  const letterReminderOn = useSettingsStore(state => state.letterReminderOn);
  const letterReminderTime = useSettingsStore(
    state => state.letterReminderTime,
  );
  const defaultCity = useSettingsStore(state => state.defaultCity);
  const setDailyReminderOn = useSettingsStore(
    state => state.setDailyReminderOn,
  );
  const setLetterReminderOn = useSettingsStore(
    state => state.setLetterReminderOn,
  );
  const setLetterReminderTime = useSettingsStore(
    state => state.setLetterReminderTime,
  );

  const selectMode = (nextMode: ThemeMode) => {
    haptics.trigger('selection');
    setMode(nextMode);
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, {backgroundColor: colors.background}]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, {color: colors.textMuted}]}>渡 · DU</Text>
        <Text style={[styles.title, {color: colors.text}]}>我</Text>

        <View
          style={[
            styles.identityCard,
            shadows.paper,
            {backgroundColor: colors.surface, borderColor: colors.line},
          ]}
        >
          <View
            style={[styles.avatar, {backgroundColor: primitiveColors.wood}]}
          >
            <Text style={[styles.avatarText, {color: colors.textSoft}]}>
              渡
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={[styles.nickname, {color: colors.text}]}>渡河人</Text>
            <Text style={[styles.duNumber, {color: colors.textMuted}]}>
              渡号 {duNumber ?? '准备中'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="登录以同步"
            onPress={() => {
              haptics.trigger('button');
              toast.show('v2 开放');
            }}
            style={({pressed}) => [
              styles.syncButton,
              {
                borderColor: colors.accent,
                opacity: pressed ? 0.92 : 1,
                transform: [{scale: pressed ? 0.98 : 1}],
              },
            ]}
          >
            <Text style={[styles.syncText, {color: colors.accent}]}>
              登录以同步
            </Text>
          </Pressable>
        </View>

        <SectionTitle label="皮肤" />
        <View
          style={[
            styles.themeGroup,
            shadows.paper,
            {backgroundColor: colors.surface, borderColor: colors.line},
          ]}
        >
          {themeOptions.map(option => {
            const selected = option.value === mode;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{checked: selected}}
                accessibilityLabel={option.label}
                key={option.value}
                onPress={() => selectMode(option.value)}
                style={({pressed}) => [
                  styles.themeOption,
                  {
                    backgroundColor: selected
                      ? colors.surfaceAged
                      : colors.surface,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{scale: pressed ? 0.98 : 1}],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    {color: selected ? colors.accent : colors.textSoft},
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle label="提醒与隐私" />
        <View
          style={[
            styles.list,
            shadows.paper,
            {backgroundColor: colors.surface, borderColor: colors.line},
          ]}
        >
          <SettingsToggleRow
            label="每日提醒"
            detail={dailyReminderTime}
            value={dailyReminderOn}
            onValueChange={value => {
              haptics.trigger('selection');
              setDailyReminderOn(value);
            }}
          />
          <Divider />
          <SettingsToggleRow
            label="靠岸提醒"
            detail="信件到达时"
            value={letterReminderOn}
            onValueChange={value => {
              haptics.trigger('selection');
              setLetterReminderOn(value);
            }}
          />
          <Divider />
          <SettingsLinkRow
            label="新信提醒时间"
            detail={letterReminderTime}
            onPress={() => setLetterTimePickerOpen(true)}
          />
          <Divider />
          <SettingsLinkRow
            label="面容 ID"
            detail="Stage 8 开启"
            onPress={() => toast.show('后续阶段开放')}
          />
          <Divider />
          <SettingsLinkRow
            label="默认城市"
            detail={defaultCity}
            onPress={() => toast.show('城市选择即将上线')}
          />
        </View>

        <SectionTitle label="其他" />
        <View
          style={[
            styles.list,
            shadows.paper,
            {backgroundColor: colors.surface, borderColor: colors.line},
          ]}
        >
          <SettingsLinkRow
            label="关于"
            onPress={() => navigation.navigate('About')}
          />
        </View>
      </ScrollView>
      <DatePicker
        modal
        cancelText="取消"
        confirmText="设为提醒时间"
        date={reminderTimeToDate(letterReminderTime)}
        locale="zh-CN"
        mode="time"
        onCancel={() => setLetterTimePickerOpen(false)}
        onConfirm={date => {
          const nextTime = formatReminderTime(date);
          setLetterTimePickerOpen(false);
          setLetterReminderTime(nextTime);
          haptics.trigger('selection');
          toast.show(`新寄出的信将在 ${nextTime} 提醒`);
        }}
        open={letterTimePickerOpen}
        theme={isDark ? 'dark' : 'light'}
        title="信件在几点靠岸"
      />
    </SafeAreaView>
  );
}

function SectionTitle({label}: {label: string}) {
  const {colors} = useTheme();
  return (
    <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>
      {label}
    </Text>
  );
}

function Divider() {
  const {colors} = useTheme();
  return <View style={[styles.divider, {backgroundColor: colors.line}]} />;
}

function SettingsToggleRow({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const {colors} = useTheme();
  return (
    <View style={styles.row}>
      <View>
        <Text style={[styles.rowLabel, {color: colors.text}]}>{label}</Text>
        <Text style={[styles.rowDetail, {color: colors.textMuted}]}>
          {detail}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{false: colors.surfaceAged, true: colors.accentSoft}}
        thumbColor={value ? colors.seal : colors.textFaint}
      />
    </View>
  );
}

function SettingsLinkRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  const {colors} = useTheme();
  const haptics = useHaptics();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.trigger('button');
        onPress();
      }}
      style={({pressed}) => [
        styles.row,
        {
          opacity: pressed ? 0.92 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
        },
      ]}
    >
      <Text style={[styles.rowLabel, {color: colors.text}]}>{label}</Text>
      <View style={styles.rowEnd}>
        {detail ? (
          <Text style={[styles.rowDetail, {color: colors.textMuted}]}>
            {detail}
          </Text>
        ) : null}
        <Text style={[styles.chevron, {color: colors.textMuted}]}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl,
    paddingBottom: spacing.pageBottom,
  },
  eyebrow: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.h1,
    lineHeight: lineHeights.h1,
  },
  identityCard: {
    marginTop: spacing.xl,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: radius.cardLarge,
    padding: spacing.card,
  },
  avatar: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
  },
  avatarText: {
    fontFamily: fontFamilies.serif,
    fontSize: 32,
  },
  identityText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nickname: {
    fontFamily: fontFamilies.serif,
    fontSize: 20,
  },
  duNumber: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  syncButton: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.gap,
    paddingVertical: spacing.sm,
  },
  syncText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  sectionTitle: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  themeGroup: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  themeOptionText: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
  },
  list: {
    borderWidth: 0.5,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.card,
  },
  rowLabel: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
  },
  rowDetail: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chevron: {
    fontSize: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
});
