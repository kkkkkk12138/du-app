import cloudbase from '@cloudbase/js-sdk';

import type {CloudBaseConfig} from '../../config/cloudServiceConfig';
import type {AuthProvider} from './AuthProvider';
import {toAccountAuthError} from './authErrors';
import {
  ACCOUNT_PROVIDERS,
  type AccountProvider,
  type AccountSession,
  type VerificationChallenge,
} from './authTypes';

type CloudBaseUser = {
  uid?: string;
  sub?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  phone_number?: string;
  providers?: Array<{name?: string; id?: string}>;
};

type CloudBaseSessionPayload = {
  user?: CloudBaseUser;
  data?: {
    session?: CloudBaseSessionPayload | null;
    user?: CloudBaseUser;
  } | null;
};

type CloudBaseVerification = {
  verification_id?: string;
};

type CloudBaseAuthRuntime = {
  getVerification(input: {
    email?: string;
    phone_number?: string;
  }): Promise<CloudBaseVerification>;
  signInWithEmail(input: {
    verificationInfo: unknown;
    verificationCode: string;
    email: string;
  }): Promise<CloudBaseSessionPayload>;
  signInWithSms(input: {
    verificationInfo: unknown;
    verificationCode: string;
    phoneNum: string;
  }): Promise<CloudBaseSessionPayload>;
  getLoginState(): Promise<CloudBaseSessionPayload | null>;
  signOut(): Promise<unknown>;
  onAuthStateChange(
    listener: (
      event: string,
      state: CloudBaseSessionPayload | null,
    ) => void,
  ): {
    data: {
      subscription: {
        unsubscribe(): void;
      };
    };
  };
};

type CloudBaseAuthApp = {
  auth(): CloudBaseAuthRuntime;
};

type CloudBaseAuthInitializer = (input: {
  env: string;
  region: CloudBaseConfig['region'];
}) => CloudBaseAuthApp;

const initializeCloudBaseAuth: CloudBaseAuthInitializer = input =>
  cloudbase.init(input) as unknown as CloudBaseAuthApp;

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('请输入有效的邮箱地址');
  }
  return email;
}

function normalizeMainlandPhone(value: string) {
  let digits = value.replace(/[\s-]/g, '');
  if (digits.startsWith('+86')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('86') && digits.length === 13) {
    digits = digits.slice(2);
  }

  if (!/^1[3-9]\d{9}$/.test(digits)) {
    throw new Error('请输入有效的中国大陆手机号');
  }
  return `+86 ${digits}`;
}

function normalizeVerificationCode(value: string) {
  const code = value.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('请输入 6 位数字验证码');
  }
  return code;
}

function readUser(payload: CloudBaseSessionPayload | null | undefined) {
  if (!payload) {
    return undefined;
  }
  return payload.user ?? payload.data?.user ?? payload.data?.session?.user;
}

function readProviders(user: CloudBaseUser): AccountProvider[] {
  const names = new Set(
    user.providers
      ?.map(provider => provider.name ?? provider.id)
      .filter((name): name is string => Boolean(name)),
  );

  if (user.email) {
    names.add('email');
  }
  if (user.phone ?? user.phoneNumber ?? user.phone_number) {
    names.add('phone');
  }

  return ACCOUNT_PROVIDERS.filter(provider => names.has(provider));
}

function toAccountSession(
  payload: CloudBaseSessionPayload | null | undefined,
): AccountSession | null {
  const user = readUser(payload);
  const uid = user?.uid ?? user?.sub;
  if (!user || !uid) {
    return null;
  }

  const phone = user.phone ?? user.phoneNumber ?? user.phone_number;
  return {
    uid,
    ...(user.email ? {email: user.email} : {}),
    ...(phone ? {phone} : {}),
    providers: readProviders(user),
  };
}

function requireSession(payload: CloudBaseSessionPayload) {
  const session = toAccountSession(payload);
  if (!session) {
    throw new Error('CloudBase 返回的登录会话无效');
  }
  return session;
}

function createChallenge(
  channel: VerificationChallenge['channel'],
  destination: string,
  verification: CloudBaseVerification,
): VerificationChallenge {
  if (!verification.verification_id) {
    throw new Error('CloudBase 返回的验证码请求无效');
  }
  return {
    channel,
    destination,
    verificationId: verification.verification_id,
    raw: verification,
  };
}

export function createCloudBaseAuthProvider(
  config: CloudBaseConfig,
  initialize: CloudBaseAuthInitializer = initializeCloudBaseAuth,
): AuthProvider {
  const auth = initialize({
    env: config.envId,
    region: config.region,
  }).auth();

  return {
    async restoreSession() {
      try {
        return toAccountSession(await auth.getLoginState());
      } catch (error) {
        throw toAccountAuthError(error);
      }
    },

    async requestEmailCode(value) {
      const email = normalizeEmail(value);
      try {
        const verification = await auth.getVerification({email});
        return createChallenge('email', email, verification);
      } catch (error) {
        throw toAccountAuthError(error);
      }
    },

    async verifyEmailCode(challenge, value) {
      if (challenge.channel !== 'email') {
        throw new Error('验证码类型与邮箱登录不匹配');
      }
      const code = normalizeVerificationCode(value);
      try {
        return requireSession(
          await auth.signInWithEmail({
            verificationInfo: challenge.raw,
            verificationCode: code,
            email: challenge.destination,
          }),
        );
      } catch (error) {
        throw toAccountAuthError(error);
      }
    },

    async requestPhoneCode(value) {
      const phone = normalizeMainlandPhone(value);
      try {
        const verification = await auth.getVerification({
          phone_number: phone,
        });
        return createChallenge('phone', phone, verification);
      } catch (error) {
        throw toAccountAuthError(error);
      }
    },

    async verifyPhoneCode(challenge, value) {
      if (challenge.channel !== 'phone') {
        throw new Error('验证码类型与手机号登录不匹配');
      }
      const code = normalizeVerificationCode(value);
      try {
        return requireSession(
          await auth.signInWithSms({
            verificationInfo: challenge.raw,
            verificationCode: code,
            phoneNum: challenge.destination,
          }),
        );
      } catch (error) {
        throw toAccountAuthError(error);
      }
    },

    async signOut() {
      try {
        await auth.signOut();
      } catch (error) {
        throw toAccountAuthError(error);
      }
    },

    subscribe(listener) {
      const subscription = auth.onAuthStateChange((_event, state) => {
        listener(toAccountSession(state));
      });
      return () => subscription.data.subscription.unsubscribe();
    },
  };
}
