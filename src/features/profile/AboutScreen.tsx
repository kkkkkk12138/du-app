import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appMetadata } from '../../config/appMetadata';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/useTheme';
import { fontFamilies } from '../../tokens/typography';

export function AboutScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useTheme();

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>关于渡</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.mark, { borderColor: colors.seal }]}>
          <Text style={[styles.markText, { color: colors.seal }]}>渡</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>
          {appMetadata.name}
        </Text>
        <Text style={[styles.version, { color: colors.textFaint }]}>
          版本 {appMetadata.version}（{appMetadata.build}）
        </Text>
        <Text style={[styles.slogan, { color: colors.textSoft }]}>
          把此刻落下，等时间寄回来。
        </Text>

        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <AboutRow
            label="隐私政策"
            onPress={() =>
              navigation.navigate('LegalDocument', { type: 'privacy' })
            }
          />
          <AboutRow
            label="服务条款"
            onPress={() =>
              navigation.navigate('LegalDocument', { type: 'terms' })
            }
          />
          <AboutRow
            label="意见反馈"
            last
            onPress={() => navigation.navigate('Feedback')}
          />
        </View>

        <Text style={[styles.localFirst, { color: colors.textMuted }]}>
          本地优先 · 不出售个人数据
        </Text>
        <Text style={[styles.copyright, { color: colors.textFaint }]}>
          {appMetadata.copyright}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function AboutRow({
  label,
  last,
  onPress,
}: {
  label: string;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last ? styles.lastRow : null,
        { borderBottomColor: colors.line, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Text style={[styles.rowText, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.chevron, { color: colors.textFaint }]}>›</Text>
    </Pressable>
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
  headerTitle: {
    position: 'absolute',
    left: 80,
    right: 80,
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  mark: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  markText: { fontFamily: fontFamilies.serif, fontSize: 28 },
  name: { marginTop: 12, fontFamily: fontFamilies.serif, fontSize: 18 },
  version: {
    marginTop: 2,
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  slogan: { marginTop: 14, fontFamily: fontFamilies.serif, fontSize: 12 },
  group: {
    width: '100%',
    marginTop: 28,
    borderRadius: 9,
    overflow: 'hidden',
  },
  row: {
    height: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.3,
  },
  lastRow: { borderBottomWidth: 0 },
  rowText: { flex: 1, fontFamily: fontFamilies.sans, fontSize: 12 },
  chevron: { fontFamily: fontFamilies.sans, fontSize: 13, opacity: 0.3 },
  localFirst: {
    marginTop: 18,
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
  },
  copyright: {
    marginTop: 'auto',
    marginBottom: 24,
    fontFamily: fontFamilies.sans,
    fontSize: 9.5,
  },
});
