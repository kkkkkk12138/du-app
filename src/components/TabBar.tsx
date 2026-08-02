import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useHaptics} from '../hooks/useHaptics';
import {radius} from '../tokens/radius';
import {shadows} from '../tokens/shadows';
import {spacing} from '../tokens/spacing';
import {fontFamilies, fontSizes} from '../tokens/typography';
import {useTheme} from '../theme/useTheme';

const labels: Record<string, string> = {
  Daily: '日迹',
  Letters: '信',
  Write: '落笔',
  Faraway: '远方',
  Profile: '我',
};

type TabIconProps = {
  name: string;
  color: string;
};

function TabIcon({name, color}: TabIconProps) {
  if (name === 'Daily') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M4 5.5C7 4.5 9.5 5 12 7v13c-2.5-2-5-2.5-8-1.5z" stroke={color} fill="none" strokeWidth={1.3} />
        <Path d="M20 5.5C17 4.5 14.5 5 12 7v13c2.5-2 5-2.5 8-1.5z" stroke={color} fill="none" strokeWidth={1.3} />
      </Svg>
    );
  }

  if (name === 'Letters') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Rect x={3} y={5} width={18} height={14} rx={1.5} stroke={color} fill="none" strokeWidth={1.3} />
        <Path d="m4 7 8 6 8-6" stroke={color} fill="none" strokeWidth={1.3} />
      </Svg>
    );
  }

  if (name === 'Faraway') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={17.5} cy={6.5} r={2.5} stroke={color} fill="none" strokeWidth={1.3} />
        <Path d="m2.5 19 6-9 4 5 2.5-3 6.5 7z" stroke={color} fill="none" strokeWidth={1.3} />
      </Svg>
    );
  }

  if (name === 'Profile') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Rect x={4} y={3} width={16} height={18} rx={1.5} stroke={color} fill="none" strokeWidth={1.3} />
        <Line x1={8} y1={8} x2={16} y2={8} stroke={color} strokeWidth={1.3} />
        <Line x1={8} y1={12} x2={16} y2={12} stroke={color} strokeWidth={1.3} />
        <Line x1={8} y1={16} x2={13} y2={16} stroke={color} strokeWidth={1.3} />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M5 19c4-1 7-4 9-8l4-7c1 5-1 10-5 13-2 1.5-5 2-8 2Z" stroke={color} fill="none" strokeWidth={1.7} />
      <Path d="m6 18 8-8" stroke={color} fill="none" strokeWidth={1.7} />
    </Svg>
  );
}

export function TabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  return (
    <View
      style={[
        styles.bar,
        {
          height: 54 + Math.max(insets.bottom, spacing.sm),
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          backgroundColor: colors.tabBar,
          borderTopColor: colors.line,
        },
      ]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const isWrite = route.name === 'Write';
        const color = isFocused ? colors.seal : colors.textMuted;
        const options = descriptors[route.key].options;

        const onPress = () => {
          haptics.trigger('button');
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            accessibilityLabel={options.tabBarAccessibilityLabel ?? labels[route.name]}
            accessibilityRole="button"
            accessibilityState={isFocused ? {selected: true} : {}}
            key={route.key}
            onPress={onPress}
            style={({pressed}) => [
              styles.tab,
              isWrite && [
                styles.writeTab,
                shadows.seal,
                {backgroundColor: colors.seal},
              ],
              {
                opacity: pressed ? 0.92 : 1,
                transform: [
                  {rotate: isWrite ? '-3deg' : '0deg'},
                  {scale: pressed ? 0.98 : 1},
                ],
              },
            ]}>
            <TabIcon
              color={isWrite ? '#FFF8F0' : color}
              name={route.name}
            />
            {!isWrite && (
              <Text style={[styles.label, {color}]}>{labels[route.name]}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  tab: {
    minWidth: 58,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
  },
  writeTab: {
    width: 48,
    height: 48,
    minWidth: 48,
    justifyContent: 'center',
    borderRadius: radius.seal,
    marginTop: -24,
  },
});
