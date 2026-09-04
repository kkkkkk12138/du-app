import type {
  AccountSession,
  VerificationChallenge,
} from './authTypes';

export interface AuthProvider {
  restoreSession(): Promise<AccountSession | null>;
  requestEmailCode(email: string): Promise<VerificationChallenge>;
  verifyEmailCode(
    challenge: VerificationChallenge,
    code: string,
  ): Promise<AccountSession>;
  requestPhoneCode(phone: string): Promise<VerificationChallenge>;
  verifyPhoneCode(
    challenge: VerificationChallenge,
    code: string,
  ): Promise<AccountSession>;
  signOut(): Promise<void>;
  subscribe(listener: (session: AccountSession | null) => void): () => void;
}
