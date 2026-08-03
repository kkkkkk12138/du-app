import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/useTheme';
import { fontFamilies } from '../../tokens/typography';

type LegalRoute = RouteProp<RootStackParamList, 'LegalDocument'>;

const privacySections = [
  {
    title: '我们处理的数据',
    body: '你写下的文字、照片、录音、手书、地点标签、信件和个人资料默认保存在本机数据库与应用沙盒中。渡不要求注册实名账号。',
  },
  {
    title: '权限使用',
    body: '相机、相册、麦克风、位置、通知和生物识别权限只在你主动使用对应功能时申请。位置只用于你选择添加的日迹标记；生物识别凭据由系统安全区管理，渡无法读取你的面容或指纹。',
  },
  {
    title: '诊断信息',
    body: '应用集成 Firebase Crashlytics，用于收集崩溃堆栈、设备与系统版本、应用版本等诊断信息，以修复稳定性问题。诊断信息不应包含你的日记正文。',
  },
  {
    title: '本地数据',
    body: '当前版本尚未提供账号同步。卸载应用或清除应用数据会移除保存在本机的内容；在账号同步正式上线并完成恢复验证前，渡不会宣称内容已保存到云端。',
  },
  {
    title: '数据共享',
    body: '渡不出售你的个人数据，不将日记内容用于广告画像或模型训练。只有当你主动调用系统分享时，所选内容才会交给你选择的目标应用。',
  },
];

const termsSections = [
  {
    title: '本地服务',
    body: '渡是一款本地优先的日记与未来信应用。当前版本尚未提供账号同步，卸载应用或清除应用数据可能造成内容丢失。',
  },
  {
    title: '未来信提醒',
    body: '未来信依赖本机数据库、系统时间和通知能力。卸载应用、清除数据、关闭通知或系统限制都可能导致提醒无法按时出现，因此到达时间不构成绝对送达承诺。',
  },
  {
    title: '内容责任',
    body: '你保留自己创作内容的权利，并应确保录入、拍摄或分享的内容不侵犯他人合法权益。',
  },
  {
    title: '功能变更',
    body: '为改进安全性、稳定性和体验，应用功能可能随版本更新调整。涉及数据处理方式的重大变化会更新隐私说明。',
  },
];

export function LegalDocumentScreen() {
  const navigation = useNavigation();
  const route = useRoute<LegalRoute>();
  const { colors } = useTheme();
  const privacy = route.params.type === 'privacy';
  const title = privacy ? '隐私政策' : '服务条款';
  const sections = privacy ? privacySections : termsSections;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回关于渡"
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textSoft }]}>‹ 关于</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: colors.textFaint }]}>
          生效日期：2026 年 8 月 3 日
        </Text>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.body, { color: colors.textSoft }]}>
              {section.body}
            </Text>
          </View>
        ))}
        <Text style={[styles.notice, { color: colors.textMuted }]}>
          上架前仍需将同版隐私政策发布到可公开访问的 HTTPS
          地址，并在商店后台填写该地址。
        </Text>
      </ScrollView>
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
  },
  back: { fontFamily: fontFamilies.sans, fontSize: 14 },
  title: {
    position: 'absolute',
    left: 80,
    right: 80,
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
  },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 44 },
  updated: { fontFamily: fontFamilies.sans, fontSize: 9.5 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 14 },
  body: {
    marginTop: 6,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 22,
  },
  notice: {
    marginTop: 28,
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
    lineHeight: 17,
  },
});
