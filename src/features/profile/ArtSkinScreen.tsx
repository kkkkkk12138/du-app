import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ArtSkin} from '../../store/useSettingsStore';
import {useTheme} from '../../theme/useTheme';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {fontFamilies} from '../../tokens/typography';

const skins: Array<{
  id: ArtSkin;
  name: string;
  note: string;
  paper: string;
  ink: string;
  accent: string;
}> = [
  {
    id: 'paper',
    name: '素纸',
    note: '米白纸面与朱砂落印',
    paper: '#FBF6EC',
    ink: '#3A332D',
    accent: '#B85C38',
  },
  {
    id: 'moss',
    name: '苔痕',
    note: '旧书页上的浅绿与木色',
    paper: '#F3F4EA',
    ink: '#394239',
    accent: '#6F846F',
  },
  {
    id: 'dusk',
    name: '暮霞',
    note: '傍晚信纸的暖橙余光',
    paper: '#FBF1E8',
    ink: '#49362E',
    accent: '#AD6847',
  },
  {
    id: 'indigo',
    name: '靛青',
    note: '雨后薄雾与安静墨蓝',
    paper: '#F0F3F3',
    ink: '#303D42',
    accent: '#526F78',
  },
];

export function ArtSkinScreen() {
  const navigation = useNavigation();
  const {colors, artSkin, setArtSkin} = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回个人页"
          hitSlop={12}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.back, {color: colors.textMuted}]}>收回</Text>
        </Pressable>
        <Text style={[styles.headerTitle, {color: colors.text}]}>艺术皮肤</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, {color: colors.textMuted}]}>
          皮肤改变纸色与落印气质；浅色、深色仍跟随“深色外观”设置。
        </Text>
        {skins.map(skin => {
          const selected = artSkin === skin.id;
          const radioColor = {
            borderColor: selected ? skin.accent : '#BDB4A8',
          };
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{checked: selected}}
              accessibilityLabel={`使用${skin.name}皮肤`}
              key={skin.id}
              onPress={() => setArtSkin(skin.id)}
              style={({pressed}) => [
                styles.card,
                {
                  backgroundColor: skin.paper,
                  borderColor: selected ? skin.accent : colors.line,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}>
              <View style={styles.preview}>
                <View
                  style={[
                    styles.seal,
                    {backgroundColor: skin.accent},
                  ]}>
                  <Text style={styles.sealText}>渡</Text>
                </View>
                <View style={styles.previewCopy}>
                  <Text style={[styles.skinName, {color: skin.ink}]}>
                    {skin.name}
                  </Text>
                  <Text
                    style={[
                      styles.sample,
                      styles.sampleMuted,
                      {color: skin.ink},
                    ]}>
                    风从旧页间经过，留下一点颜色。
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    radioColor,
                  ]}>
                  {selected ? (
                    <View
                      style={[
                        styles.radioDot,
                        {backgroundColor: skin.accent},
                      ]}
                    />
                  ) : null}
                </View>
              </View>
              <Text
                style={[styles.note, styles.noteMuted, {color: skin.ink}]}>
                {skin.note}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  header: {
    height: 52,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {fontFamily: fontFamilies.serif, fontSize: 13},
  headerTitle: {fontFamily: fontFamilies.serifMedium, fontSize: 17},
  headerSpacer: {width: 34},
  content: {padding: spacing.page, paddingBottom: spacing.pageBottom},
  intro: {
    marginBottom: spacing.xl,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 20,
  },
  card: {
    minHeight: 126,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.paper,
  },
  preview: {flexDirection: 'row', alignItems: 'center'},
  seal: {
    width: 38,
    height: 38,
    borderRadius: radius.seal,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{rotate: '-4deg'}],
  },
  sealText: {
    color: '#FFF9ED',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 17,
  },
  previewCopy: {flex: 1, marginHorizontal: spacing.lg},
  skinName: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 17,
    letterSpacing: 2,
  },
  sample: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  sampleMuted: {opacity: 0.62},
  radio: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {width: 10, height: 10, borderRadius: radius.round},
  note: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(58,51,45,0.1)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  noteMuted: {opacity: 0.5},
});
