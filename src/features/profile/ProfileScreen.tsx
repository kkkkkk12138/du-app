import React, { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '../../components/Toast';
import { appMetadata } from '../../config/appMetadata';
import { useHaptics } from '../../hooks/useHaptics';
import { RootStackParamList } from '../../navigation/RootNavigator';
import {
  disableBiometricLock,
  enableBiometricLock,
  getBiometricLabel,
} from '../../services/biometricLock';
import {
  cancelDailyReminder,
  requestNotificationAccess,
  scheduleDailyReminder,
} from '../../services/dailyNotifications';
import { cancelAllLetterArrivalNotifications } from '../../services/letterNotifications';
import { ThemeMode, useSettingsStore } from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { primitiveColors } from '../../tokens/colors';
import { fontFamilies } from '../../tokens/typography';
import { ProfileIcon, ProfileIconName } from './ProfileIcon';
import { getProfileData, ProfileData } from './profileRepository';
import { formatReminderTime, reminderTimeToDate } from './reminderTimeLogic';

const emptyProfile: ProfileData = {
  nickname: '渡河人',
  avatarChar: '渡',
  daysSinceJoining: 1,
  memoryCount: 0,
  placeCount: 0,
  letterCount: 0,
};

const themeLabels: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

const iconTones: Record<
  ProfileIconName,
  { backgroundColor: string; color: string }
> = {
  user: { backgroundColor: 'rgba(58,51,45,0.06)', color: '#6B5F55' },
  year: { backgroundColor: 'rgba(201,155,146,0.15)', color: '#A07068' },
  palette: { backgroundColor: 'rgba(184,92,56,0.10)', color: '#B85C38' },
  collage: { backgroundColor: 'rgba(154,184,200,0.10)', color: '#6B5F55' },
  bell: { backgroundColor: 'rgba(154,184,200,0.12)', color: '#5A7B8A' },
  mail: { backgroundColor: 'rgba(201,155,146,0.12)', color: '#A07068' },
  lock: { backgroundColor: 'rgba(58,51,45,0.06)', color: '#6B5F55' },
  moon: { backgroundColor: 'rgba(139,115,85,0.08)', color: '#8B7355' },
  message: { backgroundColor: 'rgba(184,92,56,0.08)', color: '#B85C38' },
  star: { backgroundColor: 'rgba(217,162,107,0.12)', color: '#B8864B' },
  info: { backgroundColor: 'rgba(139,115,85,0.08)', color: '#8B7355' },
};

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors, isDark, mode, setMode } = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const settings = useSettingsStore();
  const [profile, setProfile] = useState(emptyProfile);
  const [dailyPickerOpen, setDailyPickerOpen] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('面容 ID');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getProfileData(settings.anonymousId ?? undefined)
        .then(value => active && setProfile(value))
        .catch(() => undefined);
      getBiometricLabel()
        .then(value => active && setBiometricLabel(value ?? '面容 ID'))
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [settings.anonymousId]),
  );

  const selectAppearance = () => {
    const options: Array<{ label: string; value: ThemeMode }> = [
      { label: '跟随系统', value: 'system' },
      { label: '浅色', value: 'light' },
      { label: '深色', value: 'dark' },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map(item => item.label), '取消'],
          cancelButtonIndex: options.length,
          title: '深色外观',
        },
        index => {
          if (index < options.length) {
            setMode(options[index].value);
          }
        },
      );
      return;
    }
    Alert.alert(
      '深色外观',
      undefined,
      options
        .map(item => ({
          text: item.label,
          onPress: () => setMode(item.value),
        }))
        .concat([{ text: '取消', onPress: () => undefined }]),
    );
  };

  const toggleDailyReminder = async () => {
    haptics.trigger('selection');
    if (settings.dailyReminderOn) {
      await cancelDailyReminder();
      settings.setDailyReminderOn(false);
      return;
    }
    if (!(await requestNotificationAccess())) {
      toast.show('没有通知权限，未开启每日提醒');
      return;
    }
    setDailyPickerOpen(true);
  };

  const toggleLetterReminder = async () => {
    haptics.trigger('selection');
    if (settings.letterReminderOn) {
      await cancelAllLetterArrivalNotifications();
      settings.setLetterReminderOn(false);
      return;
    }
    if (!(await requestNotificationAccess())) {
      toast.show('没有通知权限，未开启靠岸提醒');
      return;
    }
    settings.setLetterReminderOn(true);
    toast.show('信件靠岸时会提醒你');
  };

  const openLockSettings = () => {
    const enabled = settings.biometricLockOn;
    Alert.alert(
      '密码与锁定',
      enabled
        ? `当前已使用${biometricLabel}保护日迹`
        : `开启后，冷启动和离开应用后需要${biometricLabel}验证`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: enabled ? '关闭锁定' : `开启${biometricLabel}`,
          style: enabled ? 'destructive' : 'default',
          onPress: () => {
            const action = enabled
              ? disableBiometricLock()
              : enableBiometricLock();
            action
              .then(label => {
                settings.setBiometricLockOn(!enabled);
                if (typeof label === 'string') {
                  setBiometricLabel(label);
                }
              })
              .catch(() => toast.show('生物识别验证未完成'));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="编辑个人资料"
          onPress={() => navigation.navigate('ProfileEdit')}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.textSoft }]}>
              {profile.avatarChar}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={[styles.name, { color: colors.text }]}>
              {profile.nickname}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textFaint }]}>
              已渡过 {profile.daysSinceJoining} 天 · 渡号{' '}
              {settings.duNumber ?? '准备中'}
            </Text>
          </View>
          <Chevron />
        </Pressable>

        <Section>
          <SettingRow
            icon="user"
            label="个人资料"
            onPress={() => navigation.navigate('ProfileEdit')}
          />
          <SettingRow
            icon="year"
            label="我的年度"
            value={String(new Date().getFullYear())}
            onPress={() => navigation.navigate('AnnualSummary')}
          />
          <SettingRow
            icon="palette"
            label="艺术皮肤"
            badge="待开发"
            onPress={() => toast.show('更多艺术皮肤正在设计中')}
          />
          <SettingRow
            icon="collage"
            label="拼贴本"
            badge="即将上线"
            last
            onPress={() => toast.show('即将上线')}
          />
        </Section>

        <Section title="偏好">
          <SettingRow
            icon="bell"
            label="每日提醒"
            value={settings.dailyReminderTime}
            toggle={settings.dailyReminderOn}
            onPress={() =>
              toggleDailyReminder().catch(() => toast.show('提醒设置失败'))
            }
          />
          <SettingRow
            icon="mail"
            label="信件靠岸提醒"
            toggle={settings.letterReminderOn}
            onPress={() =>
              toggleLetterReminder().catch(() => toast.show('提醒设置失败'))
            }
          />
          <SettingRow
            icon="lock"
            label="密码与锁定"
            value={biometricLabel}
            onPress={openLockSettings}
          />
          <SettingRow
            icon="moon"
            label="深色外观"
            last
            value={themeLabels[mode]}
            onPress={selectAppearance}
          />
        </Section>

        <Section>
          <SettingRow
            icon="message"
            label="意见反馈"
            onPress={() => navigation.navigate('Feedback')}
          />
          {appMetadata.appStoreId ? (
            <SettingRow
              icon="star"
              label="给渡评分"
              onPress={() => toast.show('感谢支持')}
            />
          ) : null}
          <SettingRow
            icon="info"
            label="关于渡"
            value={`v${appMetadata.version}`}
            onPress={() => navigation.navigate('About')}
          />
        </Section>
        <Text style={[styles.footer, { color: colors.textFaint }]}>
          渡 · DU
        </Text>
      </ScrollView>

      <DatePicker
        modal
        cancelText="取消"
        confirmText="设为提醒时间"
        date={reminderTimeToDate(settings.dailyReminderTime)}
        locale="zh-CN"
        mode="time"
        onCancel={() => setDailyPickerOpen(false)}
        onConfirm={date => {
          const time = formatReminderTime(date);
          setDailyPickerOpen(false);
          settings.setDailyReminderTime(time);
          scheduleDailyReminder(time)
            .then(() => settings.setDailyReminderOn(true))
            .catch(() => toast.show('提醒设置失败'));
        }}
        open={dailyPickerOpen}
        theme={isDark ? 'dark' : 'light'}
        title="每天几点提醒落笔"
      />
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {children}
      </View>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  badge,
  last,
  toggle,
  onPress,
}: {
  icon: ProfileIconName;
  label: string;
  value?: string;
  badge?: string;
  last?: boolean;
  toggle?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tone = iconTones[icon];
  return (
    <Pressable
      accessibilityRole={toggle === undefined ? 'button' : 'switch'}
      accessibilityLabel={label}
      accessibilityState={
        toggle === undefined ? undefined : { checked: toggle }
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.line, borderBottomWidth: last ? 0 : 0.3 },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tone.backgroundColor }]}>
        <ProfileIcon color={tone.color} name={icon} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value ? (
        <Text
          numberOfLines={1}
          style={[styles.rowValue, { color: colors.textFaint }]}
        >
          {value}
        </Text>
      ) : null}
      {badge ? (
        <Text
          style={[
            styles.badge,
            styles.badgeBackground,
            { color: colors.accent },
          ]}
        >
          {badge}
        </Text>
      ) : null}
      {toggle === undefined ? <Chevron /> : <CompactToggle value={toggle} />}
    </Pressable>
  );
}

function Chevron() {
  const { colors } = useTheme();
  return <Text style={[styles.chevron, { color: colors.textFaint }]}>›</Text>;
}

function CompactToggle({ value }: { value: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.toggle,
        { backgroundColor: value ? colors.accent : colors.line },
      ]}
    >
      <View
        style={[
          styles.toggleThumb,
          { transform: [{ translateX: value ? 14 : 0 }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingBottom: 10 },
  identity: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamilies.serif, fontSize: 16 },
  identityText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fontFamilies.serif,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  section: { marginHorizontal: 16, marginBottom: 10 },
  sectionTitle: {
    paddingLeft: 4,
    paddingBottom: 4,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  group: { borderRadius: 9, overflow: 'hidden' },
  row: {
    height: 35,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  rowValue: {
    maxWidth: 130,
    fontFamily: fontFamilies.sans,
    fontSize: 10.5,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    fontFamily: fontFamilies.sans,
    fontSize: 7,
    letterSpacing: 0.2,
  },
  badgeBackground: { backgroundColor: 'rgba(184,92,56,0.08)' },
  chevron: {
    marginLeft: 2,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    opacity: 0.3,
  },
  toggle: {
    width: 32,
    height: 18,
    borderRadius: 9,
    padding: 1.5,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#FEFCF5',
    shadowColor: primitiveColors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  footer: {
    paddingTop: 6,
    textAlign: 'center',
    fontFamily: fontFamilies.sans,
    fontSize: 7.5,
    letterSpacing: 2,
    opacity: 0.5,
  },
  pressed: { opacity: 0.72 },
});
