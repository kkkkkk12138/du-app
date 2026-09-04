export const ACCOUNT_PROVIDERS = [
  'email',
  'phone',
  'apple',
  'wechat',
] as const;

export type AccountProvider = (typeof ACCOUNT_PROVIDERS)[number];

export type AccountSession = {
  uid: string;
  email?: string;
  phone?: string;
  providers: AccountProvider[];
};

export type VerificationChallenge = {
  channel: 'email' | 'phone';
  destination: string;
  verificationId: string;
  raw: unknown;
};
