import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appMetadata } from '../../config/appMetadata';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { fontFamilies } from '../../tokens/typography';

export function FeedbackScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [sharing, setSharing] = useState(false);

  const submit = async () => {
    const message = content.trim();
    if (message.length < 5) {
      toast.show('请至少写下 5 个字');
      return;
    }
    if (message.length > 2000) {
      toast.show('反馈内容最多 2000 个字');
      return;
    }
    setSharing(true);
    try {
      await Share.share({
        title: '渡 · 使用反馈',
        message: [
          message,
          '',
          `渡 ${appMetadata.version} (${appMetadata.build})`,
          `${Platform.OS} ${String(Platform.Version)}`,
        ].join('\n'),
      });
    } catch {
      toast.show('暂时无法打开系统分享');
    } finally {
      setSharing(false);
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
          accessibilityLabel="返回个人页"
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textSoft }]}>‹ 我</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>意见反馈</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="发送反馈"
          disabled={sharing}
          onPress={() => submit().catch(() => undefined)}
        >
          <Text
            style={[
              styles.send,
              sharing ? styles.sendDisabled : null,
              { color: colors.accent },
            ]}
          >
            发送
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={[styles.prompt, { color: colors.textSoft }]}>
          告诉我们发生了什么，或你希望渡变得怎样。不会自动附带任何日记内容。
        </Text>
        <TextInput
          accessibilityLabel="反馈内容"
          defaultValue=""
          multiline
          onChangeText={setContent}
          placeholder="写下问题、建议，或复现步骤…"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.text },
          ]}
          textAlignVertical="top"
        />
        <Text style={[styles.count, { color: colors.textFaint }]}>
          {content.length} / 2000
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
  back: { minWidth: 44, fontFamily: fontFamilies.sans, fontSize: 14 },
  title: {
    position: 'absolute',
    left: 80,
    right: 80,
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
  },
  send: {
    minWidth: 44,
    textAlign: 'right',
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  sendDisabled: { opacity: 0.4 },
  content: { paddingHorizontal: 16, paddingTop: 14 },
  prompt: { fontFamily: fontFamilies.serif, fontSize: 11, lineHeight: 19 },
  input: {
    minHeight: 220,
    marginTop: 14,
    borderRadius: 9,
    padding: 14,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 24,
  },
  count: {
    marginTop: 6,
    textAlign: 'right',
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
  },
});
