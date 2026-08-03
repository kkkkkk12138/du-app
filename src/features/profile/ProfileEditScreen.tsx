import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '../../components/Toast';
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
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getProfileData(anonymousId ?? undefined)
      .then(profile => {
        setNickname(profile.nickname);
        setAvatarChar(profile.avatarChar);
        setLoaded(true);
      })
      .catch(() => toast.show('个人资料暂时没有准备好'));
  }, [anonymousId, toast]);

  const save = async () => {
    if (!nickname.trim() || !avatarChar.trim()) {
      toast.show('昵称和头像不能为空');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        anonymousId: anonymousId ?? undefined,
        nickname,
        avatarChar,
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

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
          选择头像
        </Text>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <View style={styles.avatarRow}>
            {avatarChoices.map(choice => {
              const selected = avatarChar === choice;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={`头像 ${choice}`}
                  accessibilityState={{ selected }}
                  key={choice}
                  onPress={() => setAvatarChar(choice)}
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
            <Text style={[styles.rowLabel, { color: colors.text }]}>昵称</Text>
            <TextInput
              accessibilityLabel="昵称"
              editable={loaded && !saving}
              maxLength={12}
              onChangeText={setNickname}
              placeholder="写下你的名字"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              style={[styles.nameInput, { color: colors.text }]}
              value={nickname}
            />
          </View>
        </View>
        <Text style={[styles.note, { color: colors.textFaint }]}>
          修改后会立即显示在个人页。
        </Text>
      </View>
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
  avatarRow: {
    minHeight: 58,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
});
