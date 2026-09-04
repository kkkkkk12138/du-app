import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';

import {AppText as Text} from '../../components/AppText';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {useTheme} from '../../theme/useTheme';
import {spacing} from '../../tokens/spacing';
import {
  fontFamilies,
  fontSizes,
  lineHeights,
} from '../../tokens/typography';
import type {AuthProvider} from './AuthProvider';
import {getAccountAuthProvider} from './accountAuthProvider';
import type {AccountProvider} from './authTypes';
import {useAccountStore} from './useAccountStore';

const providerLabels: Record<AccountProvider, string> = {
  email: '邮箱',
  phone: '手机号',
  apple: 'Apple',
  wechat: '微信',
};

type Props = {
  authProvider?: AuthProvider;
};

export function AccountScreen({authProvider}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {colors} = useTheme();
  const account = useAccountStore(state => state.account);
  const provider = useMemo(
    () => authProvider ?? getAccountAuthProvider(),
    [authProvider],
  );
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    setError(null);
    try {
      await provider.signOut();
      useAccountStore.getState().setSignedOut();
      navigation.goBack();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : '暂时无法退出账号，请稍后再试',
      );
    } finally {
      setSigningOut(false);
    }
  };

  if (
    account.status !== 'signed_in_locked' &&
    account.status !== 'signed_in_unlocked'
  ) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, {backgroundColor: colors.background}]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收回账号页面"
            hitSlop={10}
            onPress={() => navigation.goBack()}
            style={styles.headerAction}>
            <Text style={[styles.backText, {color: colors.textMuted}]}>
              收回
            </Text>
          </Pressable>
          <Text style={[styles.headerTitle, {color: colors.text}]}>账号</Text>
          <View style={styles.headerAction} />
        </View>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>
            当前没有登录账号
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="前往注册或登录"
            onPress={() => navigation.replace('AccountAccess')}
            style={({pressed}) => [
              styles.compactAction,
              {
                borderColor: colors.line,
                opacity: pressed ? 0.68 : 1,
              },
            ]}>
            <Text style={[styles.compactActionText, {color: colors.accent}]}>
              注册或登录
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const {session} = account;
  const unlocked = account.status === 'signed_in_unlocked';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="收回账号页面"
          hitSlop={10}
          onPress={() => navigation.goBack()}
          style={styles.headerAction}>
          <Text style={[styles.backText, {color: colors.textMuted}]}>
            收回
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, {color: colors.text}]}>账号</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.statusMark,
            {
              borderColor: unlocked ? colors.sage : colors.dusk,
            },
          ]}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: unlocked ? colors.sage : colors.dusk,
              },
            ]}
          />
          <Text style={[styles.statusText, {color: colors.textMuted}]}>
            {unlocked ? '已登录 · 本机已解锁' : '已登录 · 等待解锁'}
          </Text>
        </View>

        <Text style={[styles.title, {color: colors.text}]}>
          {session.email ?? session.phone ?? 'DU 账号'}
        </Text>
        <Text
          accessibilityLabel={
            unlocked
              ? '账号已登录，本机加密密钥已解锁'
              : '账号已登录，需要恢复凭证或旧设备批准才能读取已同步内容'
          }
          style={[styles.statusDetail, {color: colors.textSoft}]}>
          {unlocked
            ? '账号已登录，本机加密密钥已解锁。'
            : '账号已登录，需要恢复凭证或旧设备批准才能读取已同步内容。'}
        </Text>

        <View style={[styles.section, {borderTopColor: colors.line}]}>
          <Text style={[styles.sectionLabel, {color: colors.textFaint}]}>
            登录身份
          </Text>
          {session.email ? (
            <IdentityRow label="邮箱" value={session.email} />
          ) : null}
          {session.phone ? (
            <IdentityRow label="手机号" value={session.phone} />
          ) : null}
          <IdentityRow
            label="已绑定"
            value={session.providers
              .map(item => providerLabels[item])
              .join('、')}
          />
        </View>

        <View style={[styles.notice, {borderTopColor: colors.line}]}>
          <Text style={[styles.noticeTitle, {color: colors.text}]}>
            本机内容不会因退出账号而删除
          </Text>
          <Text style={[styles.noticeBody, {color: colors.textMuted}]}>
            退出后仍可继续使用这台设备上的日迹与信件；未完成同步的内容不会自动出现在其他设备。
          </Text>
        </View>

        {error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, {color: colors.seal}]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="退出账号"
          disabled={signingOut}
          onPress={() => signOut().catch(() => undefined)}
          style={({pressed}) => [
            styles.signOut,
            {
              borderColor: colors.line,
              opacity: signingOut ? 0.48 : pressed ? 0.68 : 1,
            },
          ]}>
          {signingOut ? (
            <ActivityIndicator color={colors.textMuted} />
          ) : (
            <Text style={[styles.signOutText, {color: colors.textMuted}]}>
              退出账号
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function IdentityRow({label, value}: {label: string; value: string}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.identityRow, {borderBottomColor: colors.line}]}>
      <Text style={[styles.identityLabel, {color: colors.textMuted}]}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.identityValue, {color: colors.text}]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  header: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    width: 60,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  headerTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.body,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: 38,
    paddingBottom: 44,
  },
  statusMark: {
    minHeight: 32,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 0.5,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  title: {
    marginTop: spacing.xxl,
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.h2,
  },
  statusDetail: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  section: {
    marginTop: 36,
    paddingTop: spacing.lg,
    borderTopWidth: 0.5,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  identityRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
  },
  identityLabel: {
    width: 72,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  identityValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  notice: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 0.5,
  },
  noticeTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.body,
  },
  noticeBody: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    lineHeight: lineHeights.secondary,
  },
  error: {
    marginTop: spacing.lg,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  signOut: {
    minHeight: 48,
    marginTop: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderRadius: 8,
  },
  signOutText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.body,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  emptyTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.title,
  },
  compactAction: {
    minWidth: 160,
    minHeight: 48,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderRadius: 8,
  },
  compactActionText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.body,
  },
});
