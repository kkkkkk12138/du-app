import React, { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
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
  avatarPath: undefined,
  daysSinceJoining: 1,
  memoryCount: 0,
  placeCount: 0,
  letterCount: 0,
  questCount: 0,
  wishCount: 0,
};

const themeLabels: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

const skinLabels = {
  paper: '素纸',
  moss: '苔痕',
  dusk: '暮霞',
  indigo: '靛青',
} as const;

const iconTones: Record<
  ProfileIconName,
  { backgroundColor: string; color: string }
> = {
  user: { backgroundColor: 'rgba(58,51,45,0.06)', color: '#6B5F55' },
  year: { backgroundColor: 'rgba(201,155,146,0.15)', color: '#A07068' },
  palette: { backgroundColor: 'rgba(184,92,56,0.10)', color: '#B85C38' },
  book: { backgroundColor: 'rgba(196,167,125,0.15)', color: '#8B7355' },
  scraps: { backgroundColor: 'rgba(155,176,196,0.13)', color: '#647F91' },
  bell: { backgroundColor: 'rgba(154,184,200,0.12)', color: '#5A7B8A' },
  mail: { backgroundColor: 'rgba(201,155,146,0.12)', color: '#A07068' },
  lock: { backgroundColor: 'rgba(58,51,45,0.06)', color: '#6B5F55' },
  moon: { backgroundColor: 'rgba(139,115,85,0.08)', color: '#8B7355' },
  message: { backgroundColor: 'rgba(184,92,56,0.08)', color: '#B85C38' },
  star: { backgroundColor: 'rgba(217,162,107,0.12)', color: '#B8864B' },
  tea: { backgroundColor: 'rgba(212,165,116,0.18)', color: '#B8864B' },
  info: { backgroundColor: 'rgba(139,115,85,0.08)', color: '#8B7355' },
};

const rowRotations: Record<ProfileIconName, string> = {
  user: '-0.6deg',
  year: '0.5deg',
  palette: '-0.8deg',
  book: '0.4deg',
  scraps: '-0.5deg',
  bell: '0.6deg',
  mail: '-0.5deg',
  lock: '0.4deg',
  moon: '-0.7deg',
  message: '0.6deg',
  star: '-0.6deg',
  tea: '0.5deg',
  info: '-0.8deg',
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
        <View style={styles.hero}>
          <View style={[styles.heroSeal, { backgroundColor: colors.seal }]}>
            <Text style={styles.heroSealText}>渡</Text>
          </View>
          <View
            pointerEvents="none"
            style={[styles.inkDot, styles.inkDotOne]}
          />
          <View
            pointerEvents="none"
            style={[styles.inkDot, styles.inkDotTwo]}
          />
          <View
            pointerEvents="none"
            style={[styles.inkDot, styles.inkDotThree]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="编辑个人资料"
            onPress={() => navigation.navigate('ProfileEdit')}
            style={({ pressed }) => [
              styles.avatar,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            {profile.avatarPath ? (
              <Image
                accessibilityLabel={`${profile.nickname}的头像`}
                resizeMode="cover"
                source={{ uri: `file://${profile.avatarPath}` }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Text style={[styles.avatarText, { color: colors.textSoft }]}>
                {profile.avatarChar}
              </Text>
            )}
          </Pressable>
          <Text style={[styles.name, { color: colors.text }]}>
            {profile.nickname}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textFaint }]}>
            No.{settings.duNumber ?? '准备中'} · 已渡过{' '}
            {profile.daysSinceJoining} 天
          </Text>
          <View style={[styles.heroRule, { borderBottomColor: colors.line }]} />
        </View>

        <View style={styles.stamps}>
          <StatStamp
            label="信·已拆"
            value={profile.letterCount}
            onPress={() => navigation.navigate('Main', { screen: 'Letters' })}
          />
          <StatStamp
            label="念想"
            value={profile.wishCount}
            onPress={() => navigation.navigate('Main', { screen: 'Faraway' })}
          />
          <StatStamp
            label="副本"
            value={profile.questCount}
            onPress={() => navigation.navigate('Main', { screen: 'Faraway' })}
          />
          <StatStamp
            label="城·足迹"
            value={profile.placeCount}
            onPress={() => navigation.navigate('Main', { screen: 'Faraway' })}
          />
        </View>

        <Section english="notes" title="手记">
          <SettingRow
            icon="user"
            label="个人资料"
            large
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
            large
            value={skinLabels[settings.artSkin]}
            onPress={() => navigation.navigate('ArtSkin')}
          />
          <SettingRow
            icon="book"
            label="书架"
            onPress={() => navigation.navigate('Bookshelf')}
          />
          <SettingRow
            icon="scraps"
            label="散页"
            onPress={() => navigation.navigate('Scraps')}
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

        <Section title="支持与关于">
          <SettingRow
            icon="message"
            label="意见反馈"
            onPress={() => navigation.navigate('Feedback')}
          />
          <SettingRow
            icon="star"
            label="给渡评分"
            value={appMetadata.appStoreId ? undefined : '上架后开放'}
            onPress={() =>
              toast.show(
                appMetadata.appStoreId ? '感谢支持' : 'App Store 上架后开放',
              )
            }
          />
          <SettingRow
            badge="暂未开放"
            icon="tea"
            label="给渡添一杯茶"
            onPress={() => toast.show('支持入口尚未开放')}
          />
          <SettingRow
            icon="mail"
            label="作者的信"
            onPress={() => navigation.navigate('AuthorLetter')}
          />
          <SettingRow
            icon="info"
            label="关于渡"
            value={`v${appMetadata.version}`}
            onPress={() => navigation.navigate('About')}
          />
        </Section>
        <View style={styles.footer}>
          <View style={[styles.footerSeal, { borderColor: colors.accent }]}>
            <Text style={[styles.footerSealText, { color: colors.accent }]}>
              渡
            </Text>
          </View>
          <Text style={[styles.footerText, { color: colors.textFaint }]}>
            made with paper & ink
          </Text>
        </View>
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

function StatStamp({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.statStamp,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.statNumber, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textFaint }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  english,
  children,
}: {
  title?: string;
  english?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeading}>
          <View
            style={[styles.sectionRule, { backgroundColor: colors.line }]}
          />
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {title}
          </Text>
          {english ? (
            <Text style={[styles.sectionEnglish, { color: colors.textFaint }]}>
              {english}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  badge,
  last,
  large,
  toggle,
  onPress,
}: {
  icon: ProfileIconName;
  label: string;
  value?: string;
  badge?: string;
  last?: boolean;
  large?: boolean;
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
        large && styles.rowLarge,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          marginBottom: last ? 0 : 12,
          transform: [{ rotate: rowRotations[icon] }],
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.tape, { backgroundColor: colors.accentSoft }]}
      />
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
  content: { paddingBottom: 110 },
  hero: {
    paddingTop: 38,
    paddingHorizontal: 28,
    paddingBottom: 28,
    alignItems: 'center',
    position: 'relative',
  },
  heroSeal: {
    position: 'absolute',
    top: 34,
    right: 28,
    width: 36,
    height: 36,
    borderRadius: 3,
    transform: [{ rotate: '-5deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSealText: {
    color: '#F5EDE0',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 17,
  },
  inkDot: { position: 'absolute', borderRadius: 20 },
  inkDotOne: {
    top: 74,
    left: '34%',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(58,51,45,0.1)',
  },
  inkDotTwo: {
    top: 126,
    left: '64%',
    width: 7,
    height: 7,
    backgroundColor: 'rgba(184,92,56,0.07)',
  },
  inkDotThree: {
    top: 166,
    left: '29%',
    width: 3,
    height: 3,
    backgroundColor: 'rgba(139,115,85,0.12)',
  },
  avatar: {
    width: 76,
    height: 76,
    marginBottom: 18,
    borderRadius: 38,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontFamily: fontFamilies.serif, fontSize: 30 },
  name: {
    fontFamily: fontFamilies.serif,
    fontSize: 24,
    letterSpacing: 5,
    fontWeight: '400',
  },
  subtitle: {
    marginTop: 7,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  heroRule: {
    width: '76%',
    marginTop: 24,
    borderBottomWidth: 0.5,
    borderStyle: 'dashed',
  },
  stamps: {
    paddingHorizontal: 28,
    paddingBottom: 22,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  statStamp: {
    minHeight: 62,
    flex: 1,
    maxWidth: 76,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 21,
    lineHeight: 23,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: fontFamilies.serif,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  section: { marginHorizontal: 28, marginBottom: 16 },
  sectionHeading: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionRule: { width: 20, height: 0.5 },
  sectionTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 5,
  },
  sectionEnglish: {
    marginLeft: 'auto',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 10,
    letterSpacing: 2,
  },
  group: { overflow: 'visible' },
  row: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    shadowColor: primitiveColors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 6,
    elevation: 1,
  },
  rowLarge: {
    minHeight: 60,
    paddingHorizontal: 18,
  },
  tape: {
    position: 'absolute',
    top: -6,
    left: '44%',
    width: 38,
    height: 12,
    borderRadius: 1,
    opacity: 0.24,
    transform: [{ rotate: '-1deg' }],
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  rowValue: {
    maxWidth: 130,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
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
    paddingTop: 28,
    paddingBottom: 10,
    alignItems: 'center',
  },
  footerSeal: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 3,
    transform: [{ rotate: '-4deg' }],
  },
  footerSealText: {
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  footerText: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 7.5,
    letterSpacing: 2,
    opacity: 0.5,
  },
  pressed: { opacity: 0.72 },
});
