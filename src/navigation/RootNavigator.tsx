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
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabBar } from '../components/TabBar';
import { AccountAccessScreen } from '../features/account/AccountAccessScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { DailyScreen } from '../features/daily/DailyScreen';
import { FarawayScreen } from '../features/faraway/FarawayScreen';
import { LettersScreen } from '../features/letters/LettersScreen';
import { NewLetterScreen } from '../features/newLetter/NewLetterScreen';
import { AboutScreen } from '../features/profile/AboutScreen';
import { ArtSkinScreen } from '../features/profile/ArtSkinScreen';
import { AnnualSummaryScreen } from '../features/profile/AnnualSummaryScreen';
import { AuthorLetterScreen } from '../features/profile/AuthorLetterScreen';
import { BookshelfScreen } from '../features/profile/BookshelfScreen';
import { DataPrivacyScreen } from '../features/profile/DataPrivacyScreen';
import { FeedbackScreen } from '../features/profile/FeedbackScreen';
import { LegalDocumentScreen } from '../features/profile/LegalDocumentScreen';
import { ProfileEditScreen } from '../features/profile/ProfileEditScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { ScrapsScreen } from '../features/profile/ScrapsScreen';
import { UnsealScreen } from '../features/unseal/UnsealScreen';
import { WriteScreen } from '../features/write/WriteScreen';
import { useTheme } from '../theme/useTheme';
import { linking } from './linking';
import type {RecognizedCity} from '../services/placeRecognition';

export type MainTabParamList = {
  Daily: { newMemoryId?: string } | undefined;
  Letters: { openArrivedLetterId?: string } | undefined;
  Write: undefined;
  Faraway: undefined;
  Profile: undefined;
};

export type FutureLetterDraft = {
  draftId?: string;
  content: string;
  type: string;
  customTags: string[];
  imagePath?: string;
  audioPath?: string;
  audioDuration?: number;
  inkImagePath?: string;
  placeDetail?: string;
  placeCity?: RecognizedCity;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Unseal: { letterId?: string; source?: 'daily' | 'letters' } | undefined;
  NewLetter: { draft: FutureLetterDraft };
  About: undefined;
  AuthorLetter: undefined;
  ProfileEdit: undefined;
  AnnualSummary: undefined;
  Bookshelf: undefined;
  Scraps: undefined;
  ArtSkin: undefined;
  DataPrivacy: undefined;
  Feedback: undefined;
  LegalDocument: { type: 'privacy' | 'terms' };
  AccountAccess: {initialChannel?: 'email' | 'phone'} | undefined;
  Account: undefined;
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
      screenOptions={{ headerShown: false }}
      tabBar={renderTabBar}
    >
      <Tab.Screen name="Daily" component={DailyScreen} />
      <Tab.Screen name="Letters" component={LettersScreen} />
      <Tab.Screen name="Write" component={WriteScreen} />
      <Tab.Screen name="Faraway" component={FarawayScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors, isDark } = useTheme();
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
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
          orientation: 'portrait',
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Unseal"
          component={UnsealScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="NewLetter"
          component={NewLetterScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="AuthorLetter" component={AuthorLetterScreen} />
        <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
        <Stack.Screen name="AnnualSummary" component={AnnualSummaryScreen} />
        <Stack.Screen name="Bookshelf" component={BookshelfScreen} />
        <Stack.Screen name="Scraps" component={ScrapsScreen} />
        <Stack.Screen name="ArtSkin" component={ArtSkinScreen} />
        <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
        <Stack.Screen name="AccountAccess" component={AccountAccessScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
