import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';

import { useToast } from '../../components/Toast';
import { removeMediaFile } from '../../services/mediaStorage';
import { pickPhotoFromLibrary } from '../../services/photoLibrary';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { fontFamilies } from '../../tokens/typography';
import { getProfileData, updateProfile } from './profileRepository';

const avatarChoices = ['渡', '舟', '河', '月', '山', '风'];

export function ProfileEditScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const toast = useToast();
  const anonymousId = useSettingsStore(state => state.anonymousId);
  const [nickname, setNickname] = useState('');
  const [avatarChar, setAvatarChar] = useState('');
  const [avatarPath, setAvatarPath] = useState<string>();
  const [birthday, setBirthday] = useState<Date>();
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const originalAvatarPath = useRef<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadFailed(false);
    try {
      const profile = await getProfileData(anonymousId ?? undefined);
      setNickname(profile.nickname);
      setAvatarChar(profile.avatarChar);
      setAvatarPath(profile.avatarPath);
      setBirthday(profile.birthday);
      originalAvatarPath.current = profile.avatarPath;
      setLoaded(true);
    } catch {
      setLoadFailed(true);
      toast.show('个人资料暂时没有准备好');
    }
  }, [anonymousId, toast]);

  useEffect(() => {
    loadProfile().catch(() => undefined);
  }, [loadProfile]);

  useEffect(
    () => () => {
      if (avatarPath && avatarPath !== originalAvatarPath.current) {
        removeMediaFile(avatarPath).catch(() => undefined);
      }
    },
    [avatarPath],
  );

  const chooseAvatar = async () => {
    const result = await pickPhotoFromLibrary();
    if (result.status === 'error') {
      toast.show(result.message);
      return;
    }
    if (result.status !== 'selected') {
      return;
    }
    const previousPath = avatarPath;
    setAvatarPath(result.path);
    if (previousPath && previousPath !== originalAvatarPath.current) {
      await removeMediaFile(previousPath).catch(() => undefined);
    }
  };

  const chooseTextAvatar = async (choice: string) => {
    const previousPath = avatarPath;
    setAvatarChar(choice);
    setAvatarPath(undefined);
    if (previousPath && previousPath !== originalAvatarPath.current) {
      await removeMediaFile(previousPath).catch(() => undefined);
    }
  };

  const save = async () => {
    if (!nickname.trim() || !avatarChar.trim()) {
      toast.show('昵称和头像不能为空');
      return;
    }
    if (nickname.trim().length > 12) {
      toast.show('昵称最多 12 个字');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        anonymousId: anonymousId ?? undefined,
        nickname,
        avatarChar,
        avatarPath,
        birthday,
      });
      toast.show('个人资料已更新');
      navigation.goBack();
    } catch {
      toast.show('个人资料保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消编辑个人资料"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[styles.headerAction, { color: colors.textSoft }]}>
            取消
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          个人资料
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存个人资料"
          disabled={!loaded || saving}
          onPress={() => save().catch(() => undefined)}
          style={({ pressed }) => ({
            opacity: !loaded || saving ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={[styles.headerAction, { color: colors.accent }]}>
            保存
          </Text>
        </Pressable>
      </View>

      {loadFailed ? (
        <View style={styles.retryState}>
          <Text style={[styles.retryTitle, { color: colors.text }]}>
            个人资料暂时没有准备好
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新读取个人资料"
            onPress={() => loadProfile().catch(() => undefined)}
          >
            <Text style={[styles.retryAction, { color: colors.accent }]}>
              轻触重试
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
            头像
          </Text>
          <View style={[styles.group, { backgroundColor: colors.surface }]}>
            <View style={styles.photoRow}>
              <View
                style={[
                  styles.photoPreview,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.line,
                  },
                ]}
              >
                {avatarPath ? (
                  <Image
                    accessibilityLabel="当前头像照片"
                    resizeMode="cover"
                    source={{ uri: `file://${avatarPath}` }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <Text
                    style={[styles.photoFallback, { color: colors.textSoft }]}
                  >
                    {avatarChar}
                  </Text>
                )}
              </View>
              <View style={styles.photoCopy}>
                <Text style={[styles.photoTitle, { color: colors.text }]}>
                  上传自己的照片
                </Text>
                <Text style={[styles.photoNote, { color: colors.textFaint }]}>
                  使用系统相册选择，原照片不会被修改
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="从相册选择头像"
                disabled={!loaded || saving}
                onPress={() =>
                  chooseAvatar().catch(() => toast.show('头像没有更新'))
                }
                style={({ pressed }) => [
                  styles.photoButton,
                  { borderColor: colors.line, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text
                  style={[styles.photoButtonText, { color: colors.accent }]}
                >
                  选择
                </Text>
              </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
            <View style={styles.avatarRow}>
              {avatarChoices.map(choice => {
                const selected = !avatarPath && avatarChar === choice;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={`头像 ${choice}`}
                    accessibilityState={{ selected }}
                    key={choice}
                    onPress={() =>
                      chooseTextAvatar(choice).catch(() => undefined)
                    }
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: selected
                          ? colors.surfaceAged
                          : colors.surface,
                        borderColor: selected ? colors.accent : colors.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: selected ? colors.accent : colors.textSoft },
                      ]}
                    >
                      {choice}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
            资料
          </Text>
          <View style={[styles.group, { backgroundColor: colors.surface }]}>
            <View style={styles.inputRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                昵称
              </Text>
              <TextInput
                accessibilityLabel="昵称"
                defaultValue={nickname}
                editable={loaded && !saving}
                key={`nickname-${loaded ? 'loaded' : 'loading'}`}
                onChangeText={setNickname}
                placeholder="写下你的名字"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.accent}
                style={[styles.nameInput, { color: colors.text }]}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
            <View style={styles.inputRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                生日
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="设置生日"
                disabled={!loaded || saving}
                onPress={() => setBirthdayPickerOpen(true)}
                style={styles.birthdayValue}
              >
                <Text
                  style={[
                    styles.birthdayText,
                    { color: birthday ? colors.textSoft : colors.textFaint },
                  ]}
                >
                  {birthday
                    ? `${birthday.getFullYear()}年${
                        birthday.getMonth() + 1
                      }月${birthday.getDate()}日`
                    : '未设置'}
                </Text>
              </Pressable>
              {birthday ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="清除生日"
                  onPress={() => setBirthday(undefined)}
                >
                  <Text
                    style={[styles.clearBirthday, { color: colors.textFaint }]}
                  >
                    清除
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={[styles.note, { color: colors.textFaint }]}>
            修改后会立即显示在个人页。
          </Text>
        </View>
      )}
      <DatePicker
        modal
        cancelText="取消"
        confirmText="设为生日"
        date={birthday ?? new Date(1995, 0, 1)}
        locale="zh-CN"
        maximumDate={new Date()}
        mode="date"
        open={birthdayPickerOpen}
        title="设置生日"
        onCancel={() => setBirthdayPickerOpen(false)}
        onConfirm={date => {
          setBirthdayPickerOpen(false);
          setBirthday(date);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    minWidth: 44,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  headerTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    paddingLeft: 4,
    paddingBottom: 4,
    marginTop: 10,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  group: {
    borderRadius: 9,
    overflow: 'hidden',
  },
  birthdayValue: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  birthdayText: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  clearBirthday: {
    marginLeft: 12,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  avatarRow: {
    minHeight: 58,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoRow: {
    minHeight: 74,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoFallback: {
    fontFamily: fontFamilies.serif,
    fontSize: 19,
  },
  photoCopy: { flex: 1, minWidth: 0 },
  photoTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  photoNote: {
    marginTop: 3,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    lineHeight: 13,
  },
  photoButton: {
    minWidth: 46,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderRadius: 6,
  },
  photoButtonText: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 69 },
  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 0.5,
  },
  avatarText: {
    fontFamily: fontFamilies.serif,
    fontSize: 16,
  },
  rowLabel: {
    width: 48,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  inputRow: {
    height: 44,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    padding: 0,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    textAlign: 'left',
  },
  note: {
    marginTop: 6,
    paddingHorizontal: 4,
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
  },
  retryState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  retryTitle: { fontFamily: fontFamilies.serif, fontSize: 14 },
  retryAction: {
    marginTop: 14,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
});
