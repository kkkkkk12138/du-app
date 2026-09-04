import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';

import {AppText as Text} from '../../components/AppText';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {useTheme} from '../../theme/useTheme';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {
  fontFamilies,
  fontSizes,
  lineHeights,
} from '../../tokens/typography';
import type {AuthProvider} from './AuthProvider';
import {getAccountAuthProvider} from './accountAuthProvider';
import type {VerificationChallenge} from './authTypes';
import {useAccountStore} from './useAccountStore';

type Channel = 'email' | 'phone';

type Props = {
  authProvider?: AuthProvider;
};

export function AccountAccessScreen({authProvider}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'AccountAccess'>>();
  const {colors} = useTheme();
  const provider = useMemo(
    () => authProvider ?? getAccountAuthProvider(),
    [authProvider],
  );
  const [channel, setChannel] = useState<Channel>(
    route.params?.initialChannel ?? 'email',
  );
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] =
    useState<VerificationChallenge | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const selectChannel = (nextChannel: Channel) => {
    if (nextChannel === channel || submitting) {
      return;
    }
    setChannel(nextChannel);
    setDestination('');
    setCode('');
    setChallenge(null);
    setCooldown(0);
    setError(null);
  };

  const requestCode = async () => {
    if (submitting || (challenge && cooldown > 0)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextChallenge =
        channel === 'email'
          ? await provider.requestEmailCode(destination)
          : await provider.requestPhoneCode(destination);
      setChallenge(nextChallenge);
      setDestination(nextChallenge.destination);
      setCooldown(30);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '验证码暂时无法发送，请稍后再试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!challenge || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session =
        challenge.channel === 'email'
          ? await provider.verifyEmailCode(challenge, code)
          : await provider.verifyPhoneCode(challenge, code);
      useAccountStore.getState().setSignedIn(session, false);
      navigation.replace('Account');
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : '登录暂时无法完成，请稍后再试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isVerificationStep = challenge !== null;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="收回账号登录"
          hitSlop={10}
          onPress={() => navigation.goBack()}
          style={styles.headerAction}>
          <Text style={[styles.backText, {color: colors.textMuted}]}>
            收回
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, {color: colors.text}]}>
          注册或登录
        </Text>
        <View style={styles.headerAction} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.mark, {borderColor: colors.seal}]}>
            <Text style={[styles.markText, {color: colors.seal}]}>渡</Text>
          </View>
          <Text style={[styles.title, {color: colors.text}]}>
            {isVerificationStep ? '输入验证码' : '建立你的账号'}
          </Text>
          <Text style={[styles.intro, {color: colors.textSoft}]}>
            {isVerificationStep
              ? `验证码已发送至 ${challenge.destination}`
              : '登录只用于确认账号归属，不会改变或删除这台设备上的内容。'}
          </Text>

          {!isVerificationStep ? (
            <>
              <View
                accessibilityRole="tablist"
                style={[
                  styles.segmented,
                  {
                    backgroundColor: colors.surfaceAged,
                    borderColor: colors.line,
                  },
                ]}>
                {(['email', 'phone'] as const).map(value => {
                  const selected = channel === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="tab"
                      accessibilityLabel={
                        value === 'email' ? '邮箱登录' : '手机号登录'
                      }
                      accessibilityState={{selected}}
                      onPress={() => selectChannel(value)}
                      style={[
                        styles.segment,
                        selected
                          ? {backgroundColor: colors.surface}
                          : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: selected
                              ? colors.text
                              : colors.textMuted,
                          },
                        ]}>
                        {value === 'email' ? '邮箱' : '手机号'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, {color: colors.textMuted}]}>
                {channel === 'email' ? '邮箱地址' : '中国大陆手机号'}
              </Text>
              <TextInput
                accessibilityLabel={
                  channel === 'email' ? '邮箱地址' : '手机号'
                }
                autoCapitalize="none"
                autoComplete={channel === 'email' ? 'email' : 'tel'}
                autoCorrect={false}
                keyboardType={
                  channel === 'email' ? 'email-address' : 'phone-pad'
                }
                onChangeText={setDestination}
                placeholder={
                  channel === 'email'
                    ? 'name@example.com'
                    : '138 0000 0000'
                }
                placeholderTextColor={colors.textFaint}
                style={[
                  styles.input,
                  {
                    borderColor: colors.line,
                    color: colors.text,
                    backgroundColor: colors.surface,
                  },
                ]}
                textContentType={
                  channel === 'email' ? 'emailAddress' : 'telephoneNumber'
                }
                value={destination}
              />
            </>
          ) : (
            <>
              <Text style={[styles.label, {color: colors.textMuted}]}>
                六位验证码
              </Text>
              <TextInput
                accessibilityLabel="六位验证码"
                autoComplete="sms-otp"
                autoFocus
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={value =>
                  setCode(value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                placeholderTextColor={colors.textFaint}
                style={[
                  styles.input,
                  styles.codeInput,
                  {
                    borderColor: colors.line,
                    color: colors.text,
                    backgroundColor: colors.surface,
                  },
                ]}
                textContentType="oneTimeCode"
                value={code}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="重新获取验证码"
                disabled={cooldown > 0 || submitting}
                onPress={() => requestCode().catch(() => undefined)}
                style={styles.resend}>
                <Text
                  style={[
                    styles.resendText,
                    {
                      color:
                        cooldown > 0 ? colors.textFaint : colors.accent,
                    },
                  ]}>
                  {cooldown > 0
                    ? `${cooldown} 秒后可重新获取`
                    : '重新获取验证码'}
                </Text>
              </Pressable>
            </>
          )}

          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, {color: colors.seal}]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isVerificationStep ? '登录' : '获取验证码'
            }
            disabled={submitting}
            onPress={() =>
              (isVerificationStep ? verifyCode() : requestCode()).catch(
                () => undefined,
              )
            }
            style={({pressed}) => [
              styles.primary,
              {
                backgroundColor: colors.seal,
                opacity: submitting ? 0.5 : pressed ? 0.86 : 1,
              },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#FFF8F0" />
            ) : (
              <Text style={styles.primaryText}>
                {isVerificationStep ? '登录' : '获取验证码'}
              </Text>
            )}
          </Pressable>

          {isVerificationStep ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="修改邮箱或手机号"
              onPress={() => {
                setChallenge(null);
                setCode('');
                setCooldown(0);
                setError(null);
              }}
              style={styles.secondaryAction}>
              <Text
                style={[styles.secondaryText, {color: colors.textMuted}]}>
                修改{channel === 'email' ? '邮箱' : '手机号'}
              </Text>
            </Pressable>
          ) : null}

          <View style={[styles.privacyRule, {borderTopColor: colors.line}]} />
          <Text style={[styles.privacy, {color: colors.textMuted}]}>
            新设备登录后，仍需恢复凭证或旧设备批准，才能读取已同步的加密内容。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  flex: {flex: 1},
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
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 34,
    paddingBottom: 40,
  },
  mark: {
    width: 48,
    height: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.seal,
    transform: [{rotate: '-3deg'}],
  },
  markText: {
    fontFamily: fontFamilies.serif,
    fontSize: 24,
  },
  title: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.h2,
  },
  intro: {
    maxWidth: 330,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    lineHeight: lineHeights.secondary,
  },
  segmented: {
    height: 52,
    padding: 3,
    flexDirection: 'row',
    borderWidth: 0.5,
    borderRadius: radius.image,
  },
  segment: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.seal,
  },
  segmentText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  label: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  input: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 0.5,
    borderRadius: radius.image,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.bodyLarge,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 0,
  },
  resend: {
    minHeight: 44,
    alignSelf: 'flex-end',
    justifyContent: 'center',
  },
  resendText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  error: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
    lineHeight: lineHeights.secondary,
  },
  primary: {
    minHeight: 48,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.image,
  },
  primaryText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.body,
  },
  secondaryAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.secondary,
  },
  privacyRule: {
    marginTop: 36,
    paddingTop: spacing.lg,
    borderTopWidth: 0.5,
  },
  privacy: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.secondary,
    lineHeight: lineHeights.secondary,
  },
});
