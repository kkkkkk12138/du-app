import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useHaptics} from '../hooks/useHaptics';
import {radius} from '../tokens/radius';
import {shadows} from '../tokens/shadows';
import {spacing} from '../tokens/spacing';
import {fontFamilies} from '../tokens/typography';
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
        <Path
          d="M4 4h11a3 3 0 0 1 3 3v13l-4-2-4 2-3-2-3 2V4z"
          stroke={color}
          fill="none"
          strokeWidth={1.3}
        />
        <Path d="M4 8h14" stroke={color} fill="none" strokeWidth={1.3} />
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
        <Path
          d="m3 19 5-7 4 5 3-4 6 6H3z"
          stroke={color}
          fill="none"
          strokeWidth={1.3}
        />
        <Path
          d="M18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"
          stroke={color}
          fill="none"
          strokeWidth={1.3}
        />
      </Svg>
    );
  }

  if (name === 'Profile') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Rect
          x={6}
          y={3}
          width={12}
          height={18}
          rx={1}
          stroke={color}
          fill="none"
          strokeWidth={1.3}
        />
        <Path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth={1.3} />
      </Svg>
    );
  }

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M12 3c-1 4-3 8-5 11l5-2 5 2c-2-3-4-7-5-11z"
        stroke={color}
        fill="none"
        strokeWidth={1.8}
      />
      <Path d="M12 12v8" stroke={color} fill="none" strokeWidth={1.8} />
    </Svg>
  );
}

export function TabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  if (state.routes[state.index].name === 'Write') {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        {
          height: spacing.tabBar,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          backgroundColor: colors.tabBar,
          borderTopColor: colors.line,
        },
      ]}>
      <Svg
        height="100%"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width="100%">
        <Defs>
          <LinearGradient id="tabPaper" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={
                isDark ? 'rgba(42,37,32,0.6)' : 'rgba(245,240,228,0.6)'
              }
            />
            <Stop
              offset="0.3"
              stopColor={
                isDark ? 'rgba(42,37,32,0.98)' : 'rgba(245,240,228,0.98)'
              }
            />
            <Stop offset="1" stopColor={colors.tabBar} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tabPaper)" />
      </Svg>
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
    borderTopWidth: 0.5,
    paddingTop: spacing.sm,
  },
  tab: {
    minWidth: 58,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 1,
  },
  writeTab: {
    width: 48,
    height: 48,
    minWidth: 48,
    justifyContent: 'center',
    borderRadius: radius.seal,
    marginTop: -16,
  },
});
