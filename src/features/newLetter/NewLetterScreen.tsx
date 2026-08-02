import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {PlaceholderScreen} from '../../components/PlaceholderScreen';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {spacing} from '../../tokens/spacing';
import {fontFamilies} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';

export function NewLetterScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'NewLetter'>>();
  const {colors} = useTheme();

  return (
    <PlaceholderScreen eyebrow="寄给未来" title="选到达时间">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回此刻"
        onPress={() => navigation.goBack()}
        style={({pressed}) => [
          styles.back,
          {borderColor: colors.line, opacity: pressed ? 0.6 : 1},
        ]}>
        <Text style={[styles.backText, {color: colors.textSoft}]}>
          返回此刻
        </Text>
      </Pressable>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  back: {
    borderWidth: 0.5,
    borderRadius: 20,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
});
