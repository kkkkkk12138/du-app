import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {AppText as Text} from "../../components/AppText";
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  legalMetadata,
  privacySections,
  termsSections,
} from '../../content/legalContent';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/useTheme';
import { fontFamilies } from '../../tokens/typography';

type LegalRoute = RouteProp<RootStackParamList, 'LegalDocument'>;

export function LegalDocumentScreen() {
  const navigation = useNavigation();
  const route = useRoute<LegalRoute>();
  const { colors } = useTheme();
  const privacy = route.params.type === 'privacy';
  const title = privacy ? '隐私政策' : '服务条款';
  const sections = privacy ? privacySections : termsSections;
  const publicUrl = privacy
    ? legalMetadata.privacyUrl
    : legalMetadata.termsUrl;

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
          生效日期：{legalMetadata.effectiveDate}
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
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`打开公开${title}`}
          onPress={() => Linking.openURL(publicUrl)}
        >
          <Text style={[styles.notice, { color: colors.accent }]}>
            查看公开网页版
          </Text>
        </Pressable>
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
