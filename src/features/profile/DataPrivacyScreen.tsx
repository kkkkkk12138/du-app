import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '../../components/Toast';
import {
  discardPickedBackup,
  pickAndInspectBackup,
  restoreFullBackup,
} from '../../services/dataRestore';
import { shareFullBackup, shareReadableData } from '../../services/dataExport';
import {
  ArtSkin,
  ThemeMode,
  useSettingsStore,
} from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';

type DataOperation = 'backup' | 'readable' | 'restore' | null;

const themeModes: ThemeMode[] = ['light', 'dark', 'system'];
const artSkins: ArtSkin[] = ['paper', 'moss', 'dusk', 'indigo'];

export function DataPrivacyScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const toast = useToast();
  const anonymousId = useSettingsStore(state => state.anonymousId);
  const [operation, setOperation] = useState<DataOperation>(null);

  const exportData = async (type: 'backup' | 'readable') => {
    if (operation) {
      return;
    }
    setOperation(type);
    try {
      if (type === 'backup') {
        await shareFullBackup();
        toast.show('完整备份已准备好');
      } else {
        await shareReadableData();
        toast.show('可读文稿已准备好');
      }
    } catch (error) {
      console.error('数据导出失败', error);
      toast.show('导出失败，内容仍保留在本机，可稍后重试');
    } finally {
      setOperation(null);
    }
  };

  const restoreData = async () => {
    if (operation || !anonymousId) {
      return;
    }
    setOperation('restore');
    try {
      const preview = await pickAndInspectBackup();
      setOperation(null);
      if (!preview) {
        return;
      }
      const exportedAt = preview.exportedAt.toLocaleString('zh-CN');
      const missingNotice = preview.missingAssetCount
        ? `\n其中 ${preview.missingAssetCount} 个附件在导出时已缺失，无法恢复。`
        : '';
      Alert.alert(
        '恢复这份完整备份？',
        `备份时间：${exportedAt}\n日迹 ${preview.memoryCount} · 信件 ${preview.letterCount} · 念想 ${preview.wishCount}\n副本 ${preview.questCount} · 书架 ${preview.bookCount} · 散页 ${preview.scrapCount}\n附件 ${preview.assetCount}${missingNotice}\n\n恢复会替换这台设备当前的渡数据。开始前会自动制作救援备份，失败时自动回滚。`,
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => {
              discardPickedBackup(preview.path).catch(() => undefined);
            },
          },
          {
            text: '确认恢复',
            style: 'destructive',
            onPress: () => {
              setOperation('restore');
              restoreFullBackup(preview.path, anonymousId)
                .then(result => {
                  const settings = result.settings;
                  useSettingsStore.setState({
                    duNumber: result.duNumber,
                    themeMode: themeModes.includes(
                      settings?.theme_mode as ThemeMode,
                    )
                      ? (settings?.theme_mode as ThemeMode)
                      : 'system',
                    artSkin: artSkins.includes(settings?.art_skin as ArtSkin)
                      ? (settings?.art_skin as ArtSkin)
                      : 'paper',
                    dailyReminderOn: Boolean(settings?.daily_reminder_on),
                    dailyReminderTime: String(
                      settings?.daily_reminder_time ?? '22:30',
                    ),
                    letterReminderOn: Boolean(settings?.letter_reminder_on),
                    letterReminderTime: String(
                      settings?.letter_reminder_time ?? '09:00',
                    ),
                    biometricLockOn: Boolean(settings?.biometric_lock_on),
                    defaultCity: String(settings?.default_city ?? '上海'),
                    onboardingCompleted: Boolean(
                      settings?.onboarding_completed,
                    ),
                    privacyAcceptedAt:
                      typeof settings?.privacy_accepted_at === 'number'
                        ? settings.privacy_accepted_at
                        : null,
                  });
                  toast.show('完整备份已恢复');
                  navigation.goBack();
                })
                .catch(error => {
                  console.error('数据恢复失败', error);
                  toast.show(
                    error instanceof Error
                      ? error.message
                      : '恢复失败，原有内容已保留',
                  );
                })
                .finally(() => setOperation(null));
            },
          },
        ],
      );
    } catch (error) {
      console.error('备份检查失败', error);
      toast.show(error instanceof Error ? error.message : '无法读取这份备份');
      setOperation(null);
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
          accessibilityLabel="返回关于渡"
          hitSlop={12}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textMuted }]}>收回</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          数据与隐私
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.localCard,
            { backgroundColor: colors.surfaceAged, borderColor: colors.line },
          ]}
        >
          <Text style={[styles.localTitle, { color: colors.text }]}>
            当前内容保存在这台设备
          </Text>
          <Text style={[styles.localBody, { color: colors.textMuted }]}>
            渡不会自动上传日迹、信件和附件。卸载前请主动导出完整备份，并保存到
            iCloud Drive、Google Drive 或你信任的位置。
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
          主动导出
        </Text>
        <ExportCard
          busy={operation === 'backup'}
          detail="版本化 JSON、完整数据库记录（含书架和散页）及全部可找到的日迹照片、拼贴照片、录音、手写和头像；附件以内嵌数据和 SHA-256 校验保存。"
          label="完整备份"
          onPress={() => exportData('backup').catch(() => undefined)}
        />
        <ExportCard
          busy={operation === 'readable'}
          detail="按时间整理日迹、未来信、念想、副本、拼贴、书架和散页数量，生成可直接阅读的 UTF-8 文本。"
          label="可读文稿"
          onPress={() => exportData('readable').catch(() => undefined)}
        />

        <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>
          从备份恢复
        </Text>
        <ExportCard
          action="选择文件"
          busy={operation === 'restore'}
          detail="选择由渡导出的 .du-backup.json。校验通过后会显示内容摘要，确认后替换本机数据；失败会自动回滚。"
          label="恢复完整备份"
          onPress={() => restoreData().catch(() => undefined)}
        />

        <Text style={[styles.notice, { color: colors.textMuted }]}>
          导出只在你主动操作时发生。系统分享面板打开后，文件只会交给你选择的目标应用。
          缺失或已被系统移除的附件会在备份清单中标记，不会伪装成已备份。恢复只接受当前版本生成且校验通过的完整备份。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExportCard({
  label,
  detail,
  busy,
  action = '导出',
  onPress,
}: {
  label: string;
  detail: string;
  busy: boolean;
  action?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exportCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed || busy ? 0.68 : 1,
        },
      ]}
    >
      <View style={styles.exportCopy}>
        <Text style={[styles.exportLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.exportDetail, { color: colors.textMuted }]}>
          {detail}
        </Text>
      </View>
      <Text style={[styles.exportAction, { color: colors.accent }]}>
        {busy ? '处理中…' : action}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontFamily: fontFamilies.serif, fontSize: 13 },
  headerTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 17 },
  headerSpacer: { width: 34 },
  content: { padding: spacing.page, paddingBottom: spacing.pageBottom },
  localCard: {
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.paper,
  },
  localTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 16 },
  localBody: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 21,
  },
  sectionTitle: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 2,
  },
  exportCard: {
    minHeight: 112,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.paper,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportCopy: { flex: 1, paddingRight: spacing.lg },
  exportLabel: { fontFamily: fontFamilies.serifMedium, fontSize: 15 },
  exportDetail: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    lineHeight: 18,
  },
  exportAction: { fontFamily: fontFamilies.sans, fontSize: 11 },
  notice: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    lineHeight: 18,
  },
});
