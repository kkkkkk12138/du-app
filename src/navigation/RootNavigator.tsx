import React from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {TabBar} from '../components/TabBar';
import {DailyScreen} from '../features/daily/DailyScreen';
import {FarawayScreen} from '../features/faraway/FarawayScreen';
import {LettersScreen} from '../features/letters/LettersScreen';
import {NewLetterScreen} from '../features/newLetter/NewLetterScreen';
import {AboutScreen} from '../features/profile/AboutScreen';
import {ProfileScreen} from '../features/profile/ProfileScreen';
import {UnsealScreen} from '../features/unseal/UnsealScreen';
import {WriteScreen} from '../features/write/WriteScreen';
import {useTheme} from '../theme/useTheme';
import {linking} from './linking';

export type MainTabParamList = {
  Daily: undefined;
  Letters: undefined;
  Write: undefined;
  Faraway: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Unseal: {letterId?: string} | undefined;
  NewLetter: undefined;
  About: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function renderTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Daily"
      screenOptions={{headerShown: false}}
      tabBar={renderTabBar}>
      <Tab.Screen name="Daily" component={DailyScreen} />
      <Tab.Screen name="Letters" component={LettersScreen} />
      <Tab.Screen name="Write" component={WriteScreen} />
      <Tab.Screen name="Faraway" component={FarawayScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const {colors, isDark} = useTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.line,
      notification: colors.seal,
    },
  };

  return (
    <NavigationContainer
      linking={linking}
      theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: {backgroundColor: colors.background},
          headerShown: false,
          orientation: 'portrait',
        }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Unseal"
          component={UnsealScreen}
          options={{presentation: 'fullScreenModal'}}
        />
        <Stack.Screen
          name="NewLetter"
          component={NewLetterScreen}
          options={{presentation: 'fullScreenModal'}}
        />
        <Stack.Screen name="About" component={AboutScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
