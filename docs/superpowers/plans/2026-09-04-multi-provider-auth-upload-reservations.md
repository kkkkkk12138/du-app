# Multi-Provider Authentication and Upload Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one DU account that supports email OTP, phone OTP, Apple, and WeChat login in that order, restores sessions safely, and creates server-controlled COS upload reservations without weakening end-to-end encryption.

**Architecture:** CloudBase Auth V2 owns authentication and one stable UID; DU wraps it behind `AuthProvider`. Email and phone are first-party OTP identities. Apple and WeChat are linked identities, never separate data silos. Encryption identity is independent of login identity: account login proves ownership, while a trusted device or 12-word recovery credential unlocks the account master key. Uploads follow `reserve -> ticket -> PUT -> confirm`, with quota accounting performed only by server functions.

**Tech Stack:** React Native 0.86, TypeScript, Zustand, `@cloudbase/js-sdk` 3.8.2, CloudBase Node SDK 3.18.3, PostgreSQL/RLS, Tencent COS, Jest, React Native Keychain.

---

## Scope And Delivery Gates

1. Email OTP and phone OTP ship together as the account baseline.
2. Upload reservation ships after baseline authentication because every reservation requires a registered UID.
3. Apple ships only after the production iOS Bundle ID, Apple Team ID, Service ID, callback URL, and rotating client secret are configured.
4. WeChat ships only after the final iOS Bundle ID, Android application ID/signature, Universal Link/App Link, and WeChat Open Platform mobile-app approval exist.
5. Third-party login never silently creates a second DU account. An unbound Apple or WeChat identity must be linked after email/phone verification.
6. This plan does not implement StoreKit, Play Billing, full sync, or production media checkout UI.
7. Until key transfer and sync pass acceptance, UI may say `已登录`; it must not claim `换机后自动恢复全部内容`.

## File Map

### Shared authentication

- Create `src/features/account/authTypes.ts`: provider-neutral account/session contracts.
- Create `src/features/account/AuthProvider.ts`: provider-neutral interface.
- Create `src/features/account/cloudBaseAuthProvider.ts`: CloudBase Auth V2 adapter.
- Create `src/features/account/useAccountStore.ts`: transient account state; no tokens or secrets.
- Create `src/features/account/AccountSessionBootstrap.tsx`: initial session restoration and auth event subscription.
- Create `src/features/account/authErrors.ts`: stable Chinese error mapping.
- Create `src/features/account/AccountAccessScreen.tsx`: email/phone OTP UI.
- Create `src/features/account/AccountScreen.tsx`: signed-in account and linked-provider state.
- Modify `src/services/cloudBaseGateway.ts`: expose one initialized runtime to auth and functions.
- Modify `src/navigation/RootNavigator.tsx` and `src/navigation/linking.ts`: account routes and OAuth callback.
- Modify `src/features/profile/ProfileScreen.tsx`: route account card to account access/account screen.
- Modify `App.tsx`: mount session bootstrap after settings hydration.

### Encryption boundary

- Modify `docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md`: remove password-derived master-key recovery as the universal rule.
- Create `src/features/account/keyRecoveryState.ts`: locked/unlocked/recovery-required state contract.
- Create `cloudbase/migrations/20260904070000_decouple_auth_and_key_recovery.sql`: make legacy password envelope optional and add explicit recovery policy.

### Upload reservation lifecycle

- Create `functions/media-reserve-upload/{index.js,handler.js,runtime.js,package.json}`.
- Modify `functions/media-create-upload-ticket/{handler.js,runtime.js}`.
- Create `functions/media-confirm-upload/{index.js,handler.js,runtime.js,package.json}`.
- Create `functions/media-release-upload/{index.js,handler.js,runtime.js,package.json}`.
- Create `cloudbase/migrations/20260904071000_add_reserved_media_bytes.sql`.
- Modify `cloudbaserc.json`.
- Modify `src/services/cloudBaseGateway.ts`.
- Create `src/features/billing/mediaUploadReservation.ts`.

### Apple

- Create `src/features/account/oauthFlow.ts`: state/nonce generation and callback validation.
- Create `src/features/account/AppleLoginButton.tsx`.
- Modify `ios/duapp/Info.plist`, `ios/duapp/duapp.entitlements`, and Xcode project settings.
- Modify account screens and deep-link routing.

### WeChat

- Create `src/features/account/WechatLoginButton.tsx`.
- Modify iOS URL schemes/Universal Links and Android intent filters.
- Modify account screens and OAuth callback handling.

### Tests

- Create `__tests__/cloudBaseAuthProvider.test.ts`.
- Create `__tests__/accountStore.test.ts`.
- Create `__tests__/accountAccess.test.tsx`.
- Create `__tests__/accountSessionBootstrap.test.tsx`.
- Create `__tests__/mediaReserveUploadFunction.test.js`.
- Create `__tests__/mediaConfirmUploadFunction.test.js`.
- Create `__tests__/mediaUploadReservation.test.ts`.
- Create `__tests__/oauthFlow.test.ts`.
- Extend `__tests__/cloudSchemaMigration.test.js`, `__tests__/cloudServices.test.ts`, and `__tests__/App.test.tsx`.

## Phase 0: Correct The Security Model

### Task 1: Amend The Account And Encryption Specification

**Files:**
- Modify: `docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md`
- Test: documentation self-review

- [ ] **Step 1: Replace the password-only key wrapping rule**

Use this normative text:

```markdown
- 登录身份与加密身份分离。邮箱、手机号、Apple、微信都只用于证明账号归属。
- 每个账号在首台可信设备生成 256 位主密钥，主密钥不上传明文。
- 主密钥至少由 12 词恢复凭证派生的包装密钥保护。
- 新设备登录后仍处于“等待解锁”状态；必须由旧设备批准或输入恢复凭证。
- 邮箱或手机号密码不得成为唯一恢复路径，第三方登录令牌不得用于派生主密钥。
- 仅完成账号登录而未解锁主密钥时，可以查看账号信息，但不能下载或上传历史密文。
```

- [ ] **Step 2: Add the provider order and linking rule**

```markdown
登录方式按邮箱/手机号、Apple、微信顺序交付。所有方式绑定同一 CloudBase UID。
Apple 或微信首次授权若没有绑定记录，不静默创建第二账号；用户必须验证已有邮箱
或手机号后完成关联。
```

- [ ] **Step 3: Run the consistency scan**

Run:

```bash
grep -n "密码包装\|原密码\|Apple\|微信\|手机号\|恢复凭证" \
  docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md
```

Expected: no statement says every login provider can derive the master key from an account password.

- [ ] **Step 4: Commit the design correction**

```bash
git add docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md
git commit -m "docs(account): separate login identity from key recovery"
```

### Task 2: Migrate The Key Envelope Contract

**Files:**
- Create: `cloudbase/migrations/20260904070000_decouple_auth_and_key_recovery.sql`
- Modify: `__tests__/cloudSchemaMigration.test.js`

- [ ] **Step 1: Write failing migration assertions**

Assert the new migration contains:

```js
expect(sql).toContain('ALTER COLUMN password_salt DROP NOT NULL');
expect(sql).toContain('ALTER COLUMN password_kdf DROP NOT NULL');
expect(sql).toContain('ALTER COLUMN password_wrapped_key DROP NOT NULL');
expect(sql).toContain("key_transfer_policy");
expect(sql).toContain("'device_or_recovery'");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand __tests__/cloudSchemaMigration.test.js
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the migration**

```sql
ALTER TABLE public.account_key_envelopes
  ALTER COLUMN password_salt DROP NOT NULL,
  ALTER COLUMN password_kdf DROP NOT NULL,
  ALTER COLUMN password_wrapped_key DROP NOT NULL,
  ADD COLUMN key_transfer_policy varchar(32)
    NOT NULL DEFAULT 'device_or_recovery'
    CHECK (key_transfer_policy IN ('device_or_recovery'));
```

- [ ] **Step 4: Verify GREEN and deploy**

```bash
npm test -- --runInBand __tests__/cloudSchemaMigration.test.js
tcb db migrate
```

Expected: tests pass and the migration is recorded remotely.

- [ ] **Step 5: Commit**

```bash
git add cloudbase/migrations __tests__/cloudSchemaMigration.test.js
git commit -m "feat(account): decouple authentication from key recovery"
```

## Phase 1: Email And Phone Authentication

### Task 3: Define The Provider-Neutral Authentication Contract

**Files:**
- Create: `src/features/account/authTypes.ts`
- Create: `src/features/account/AuthProvider.ts`
- Test: `__tests__/cloudBaseAuthProvider.test.ts`

- [ ] **Step 1: Write the failing contract test**

Test a fake provider through this public contract:

```ts
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
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/cloudBaseAuthProvider.test.ts
```

Expected: FAIL because the contract files do not exist.

- [ ] **Step 3: Add the minimal types and interface**

`AccountProvider` must be:

```ts
export type AccountProvider = 'email' | 'phone' | 'apple' | 'wechat';
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- --runInBand __tests__/cloudBaseAuthProvider.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/features/account/authTypes.ts \
  src/features/account/AuthProvider.ts \
  __tests__/cloudBaseAuthProvider.test.ts
git commit -m "feat(account): define multi-provider authentication contract"
```

### Task 4: Implement The CloudBase Email And Phone Adapter

**Files:**
- Create: `src/features/account/cloudBaseAuthProvider.ts`
- Create: `src/features/account/authErrors.ts`
- Modify: `src/services/cloudBaseGateway.ts`
- Test: `__tests__/cloudBaseAuthProvider.test.ts`

- [ ] **Step 1: Write failing email OTP tests**

Verify:

```ts
await provider.requestEmailCode('person@example.com');
expect(auth.getVerification).toHaveBeenCalledWith({
  email: 'person@example.com',
});

await provider.verifyEmailCode(challenge, '123456');
expect(auth.signInWithEmail).toHaveBeenCalledWith({
  verificationInfo: challenge.raw,
  verificationCode: '123456',
  email: 'person@example.com',
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/cloudBaseAuthProvider.test.ts
```

Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement email OTP**

Use the installed SDK methods `getVerification`, `signInWithEmail`, and
`getLoginState`. Reject malformed email before requesting a code.

- [ ] **Step 4: Write failing phone OTP tests**

Verify input `13800000000` is normalized to `+86 13800000000`, then:

```ts
expect(auth.getVerification).toHaveBeenCalledWith({
  phone_number: '+86 13800000000',
});
expect(auth.signInWithSms).toHaveBeenCalledWith({
  verificationInfo: challenge.raw,
  verificationCode: '123456',
  phoneNum: '+86 13800000000',
});
```

- [ ] **Step 5: Implement phone OTP and stable error mapping**

Map provider errors to:

```ts
const authErrorMessages = {
  invalid_code: '验证码不正确，请重新输入',
  expired_code: '验证码已过期，请重新获取',
  rate_limited: '请求过于频繁，请稍后再试',
  network: '网络连接不可用，请稍后再试',
} as const;
```

- [ ] **Step 6: Verify GREEN**

```bash
npm test -- --runInBand __tests__/cloudBaseAuthProvider.test.ts
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/features/account src/services/cloudBaseGateway.ts \
  __tests__/cloudBaseAuthProvider.test.ts
git commit -m "feat(account): add CloudBase email and phone authentication"
```

### Task 5: Add Session Restoration Without Persisting Tokens In Zustand

**Files:**
- Create: `src/features/account/useAccountStore.ts`
- Create: `src/features/account/AccountSessionBootstrap.tsx`
- Create: `src/features/account/keyRecoveryState.ts`
- Modify: `App.tsx`
- Test: `__tests__/accountStore.test.ts`
- Test: `__tests__/accountSessionBootstrap.test.tsx`

- [ ] **Step 1: Write failing store tests**

The store states must be:

```ts
type AccountState =
  | {status: 'restoring'}
  | {status: 'signed_out'}
  | {status: 'signed_in_locked'; session: AccountSession}
  | {status: 'signed_in_unlocked'; session: AccountSession};
```

Assert no access token, refresh token, OTP, provider token, recovery words, or
master key appears in persisted Zustand data.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand \
  __tests__/accountStore.test.ts \
  __tests__/accountSessionBootstrap.test.tsx
```

- [ ] **Step 3: Implement restoration and subscription**

On app startup:

1. call `restoreSession()`;
2. set `signed_out` when null;
3. set `signed_in_locked` when a session exists but Keychain has no unlocked key;
4. subscribe to SDK auth changes;
5. unsubscribe on unmount.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- --runInBand \
  __tests__/accountStore.test.ts \
  __tests__/accountSessionBootstrap.test.tsx
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/features/account __tests__/accountStore.test.ts \
  __tests__/accountSessionBootstrap.test.tsx
git commit -m "feat(account): restore CloudBase sessions safely"
```

### Task 6: Build Email And Phone Account Screens

**Files:**
- Create: `src/features/account/AccountAccessScreen.tsx`
- Create: `src/features/account/AccountScreen.tsx`
- Modify: `src/features/profile/ProfileScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/navigation/linking.ts`
- Test: `__tests__/accountAccess.test.tsx`
- Test: `__tests__/App.test.tsx`

- [ ] **Step 1: Write failing screen tests**

Assert:

- Email/phone is a segmented control.
- The primary action has a minimum `44x44` hit area.
- Sending a code changes the screen to a six-digit code input.
- Resend is disabled for 30 seconds.
- Closing the flow preserves all existing local data.
- Signed-in-but-locked state says `账号已登录，需要恢复凭证或旧设备批准才能读取已同步内容`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand \
  __tests__/accountAccess.test.tsx \
  __tests__/App.test.tsx
```

- [ ] **Step 3: Implement the minimal screens and routes**

Add:

```ts
AccountAccess: {initialChannel?: 'email' | 'phone'} | undefined;
Account: undefined;
AuthCallback: {provider: 'apple' | 'wechat'} | undefined;
```

The Profile account card routes to `AccountAccess` while signed out and
`Account` while signed in.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- --runInBand \
  __tests__/accountAccess.test.tsx \
  __tests__/App.test.tsx
npx eslint src/features/account src/features/profile/ProfileScreen.tsx \
  src/navigation
```

- [ ] **Step 5: Perform the CloudBase console gate**

Enable:

- 邮箱验证码, using CloudBase built-in mail for development.
- 短信验证码, Shanghai region.

Set strict development limits. Confirm phone cost behavior before production:
first-month allowance is not a permanent free tier.

- [ ] **Step 6: Real-device acceptance**

Verify on iOS and Android:

1. email code request and login;
2. phone code request and login;
3. app restart restores the same UID;
4. sign-out returns to local-only mode without deleting local records;
5. both channels can be linked to one UID.

- [ ] **Step 7: Commit**

```bash
git add src/features/account src/features/profile/ProfileScreen.tsx \
  src/navigation __tests__/accountAccess.test.tsx __tests__/App.test.tsx
git commit -m "feat(account): add email and phone account flows"
```

## Phase 1B: Server-Controlled Upload Reservations

### Task 7: Add Reserved-Byte Accounting

**Files:**
- Create: `cloudbase/migrations/20260904071000_add_reserved_media_bytes.sql`
- Modify: `__tests__/cloudSchemaMigration.test.js`

- [ ] **Step 1: Write failing schema assertions**

```js
expect(sql).toContain('reserved_free_bytes bigint NOT NULL DEFAULT 0');
expect(sql).toContain(
  'free_media_used_bytes + reserved_free_bytes <= free_media_limit_bytes',
);
expect(sql).toContain("'allocating'");
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/cloudSchemaMigration.test.js
```

- [ ] **Step 3: Add the migration**

```sql
ALTER TABLE public.credit_accounts
  ADD COLUMN reserved_free_bytes bigint NOT NULL DEFAULT 0
    CHECK (reserved_free_bytes >= 0),
  ADD CONSTRAINT credit_accounts_capacity_check
    CHECK (
      free_media_used_bytes + reserved_free_bytes
      <= free_media_limit_bytes
    );

ALTER TABLE public.entry_commits
  DROP CONSTRAINT entry_commits_status_check,
  ADD CONSTRAINT entry_commits_status_check
    CHECK (
      status IN (
        'allocating', 'reserved', 'uploading',
        'committed', 'failed', 'released'
      )
    );
```

- [ ] **Step 4: Verify, deploy, and inspect remote schema**

```bash
npm test -- --runInBand __tests__/cloudSchemaMigration.test.js
tcb db migrate
```

- [ ] **Step 5: Commit**

```bash
git add cloudbase/migrations __tests__/cloudSchemaMigration.test.js
git commit -m "feat(billing): track reserved media bytes"
```

### Task 8: Implement Idempotent Free-Space Reservation

**Files:**
- Create: `functions/media-reserve-upload/handler.js`
- Create: `functions/media-reserve-upload/runtime.js`
- Create: `functions/media-reserve-upload/index.js`
- Create: `functions/media-reserve-upload/package.json`
- Modify: `cloudbaserc.json`
- Test: `__tests__/mediaReserveUploadFunction.test.js`

- [ ] **Step 1: Write failing handler tests**

The request shape is:

```js
{
  entryCommitId: 'commit-1',
  entryType: 'memory',
  localEntryId: 'memory-1',
  idempotencyKey: 'save-memory-1-revision-3',
  media: [{
    mediaId: 'media-1',
    mediaKind: 'photo',
    encryptedBytes: 2048,
    sha256: 'a'.repeat(64)
  }]
}
```

Cover:

- unauthenticated caller rejected;
- duplicate idempotency key returns the existing reservation;
- aggregate request over remaining free bytes returns
  `MEDIA_SPACE_EXHAUSTED`;
- invalid media kind/bytes/hash rejected;
- concurrent compare-and-swap conflict retries at most three times;
- partial failure releases reserved bytes.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/mediaReserveUploadFunction.test.js
```

- [ ] **Step 3: Implement the pure handler**

The handler dependencies are:

```js
createMediaReservationHandler({
  getUser,
  findCommitByIdempotencyKey,
  ensureCreditAccount,
  createAllocatingCommit,
  compareAndSwapReservedBytes,
  createReservations,
  markCommitReserved,
  releaseReservedBytes,
  now,
});
```

Only free bytes are consumed in this phase. Do not accept credit counts from
the client.

- [ ] **Step 4: Implement runtime compensation**

Use conditional updates with the previous byte values. On an exception after
the quota compare-and-swap, decrement the exact reserved byte count and mark
the commit `failed`. Expired reservations are releasable by Task 10.

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- --runInBand __tests__/mediaReserveUploadFunction.test.js
```

- [ ] **Step 6: Register and deploy**

Add `media-reserve-upload` to `cloudbaserc.json`, deploy it, and verify an
anonymous request is rejected.

- [ ] **Step 7: Commit**

```bash
git add functions/media-reserve-upload cloudbaserc.json \
  __tests__/mediaReserveUploadFunction.test.js
git commit -m "feat(media): reserve free upload capacity"
```

### Task 9: Close The Ticket And Confirmation Lifecycle

**Files:**
- Modify: `functions/media-create-upload-ticket/handler.js`
- Modify: `functions/media-create-upload-ticket/runtime.js`
- Create: `functions/media-confirm-upload/index.js`
- Create: `functions/media-confirm-upload/handler.js`
- Create: `functions/media-confirm-upload/runtime.js`
- Create: `functions/media-confirm-upload/package.json`
- Modify: `cloudbaserc.json`
- Test: `__tests__/mediaUploadTicketFunction.test.js`
- Test: `__tests__/mediaConfirmUploadFunction.test.js`

- [ ] **Step 1: Write failing ticket-state tests**

After signing, require:

```js
await markTicketed({
  reservationId,
  objectKey,
  expectedStatus: 'reserved',
});
```

A reservation already `ticketed` may receive a replacement short-lived URL
for the same object key; other states are rejected.

- [ ] **Step 2: Verify RED and implement**

```bash
npm test -- --runInBand __tests__/mediaUploadTicketFunction.test.js
```

- [ ] **Step 3: Write failing confirmation tests**

Confirmation must:

1. HEAD the exact server-stored object key;
2. compare object byte length and `x-cos-meta-sha256`;
3. insert/update `media_objects`;
4. move bytes from `reserved_free_bytes` to `free_media_used_bytes`;
5. mark reservation `verified`;
6. be idempotent.

- [ ] **Step 4: Implement and verify confirmation**

```bash
npm test -- --runInBand __tests__/mediaConfirmUploadFunction.test.js
```

- [ ] **Step 5: Deploy both functions and run a real ciphertext fixture**

With a test account:

1. reserve 32 bytes;
2. request a ticket;
3. PUT a 32-byte ciphertext fixture;
4. confirm;
5. verify `media_objects.upload_status = 'verified'`;
6. delete the fixture and test rows after evidence is recorded.

- [ ] **Step 6: Commit**

```bash
git add functions/media-create-upload-ticket functions/media-confirm-upload \
  cloudbaserc.json __tests__/mediaUploadTicketFunction.test.js \
  __tests__/mediaConfirmUploadFunction.test.js
git commit -m "feat(media): verify reserved COS uploads"
```

### Task 10: Release Cancelled And Expired Reservations

**Files:**
- Create: `functions/media-release-upload/index.js`
- Create: `functions/media-release-upload/handler.js`
- Create: `functions/media-release-upload/runtime.js`
- Create: `functions/media-release-upload/package.json`
- Modify: `cloudbaserc.json`
- Test: `__tests__/mediaReleaseUploadFunction.test.js`

- [ ] **Step 1: Write failing release tests**

Cover explicit cancellation, expiry, idempotent repeated release, wrong
account, already verified upload, and non-negative quota accounting.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/mediaReleaseUploadFunction.test.js
```

- [ ] **Step 3: Implement release**

Only `allocating`, `reserved`, and `ticketed` rows may release quota. Mark the
entry commit and reservations `released`.

- [ ] **Step 4: Verify and deploy**

```bash
npm test -- --runInBand __tests__/mediaReleaseUploadFunction.test.js
tcb fn deploy media-release-upload
```

- [ ] **Step 5: Commit**

```bash
git add functions/media-release-upload cloudbaserc.json \
  __tests__/mediaReleaseUploadFunction.test.js
git commit -m "feat(media): release unused upload reservations"
```

### Task 11: Add The Client Reservation Orchestrator

**Files:**
- Modify: `src/services/cloudBaseGateway.ts`
- Create: `src/features/billing/mediaUploadReservation.ts`
- Test: `__tests__/cloudServices.test.ts`
- Test: `__tests__/mediaUploadReservation.test.ts`

- [ ] **Step 1: Write failing client API tests**

Expose:

```ts
reserveMediaUpload(input): Promise<MediaUploadReservation>
requestMediaUploadTicket(input): Promise<MediaUploadTicket>
confirmMediaUpload(input): Promise<ConfirmedMediaUpload>
releaseMediaUpload(input): Promise<void>
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand \
  __tests__/cloudServices.test.ts \
  __tests__/mediaUploadReservation.test.ts
```

- [ ] **Step 3: Implement orchestration**

`prepareReservedUpload()` must stop when the account state is signed out or
signed in but cryptographically locked. It accepts encrypted file metadata,
never plaintext media.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- --runInBand \
  __tests__/cloudServices.test.ts \
  __tests__/mediaUploadReservation.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/services/cloudBaseGateway.ts src/features/billing \
  __tests__/cloudServices.test.ts __tests__/mediaUploadReservation.test.ts
git commit -m "feat(media): orchestrate reserved encrypted uploads"
```

## Phase 2: Apple Login

### Task 12: Complete Apple Provider Prerequisites

**External resources:**
- Apple Developer account
- Final iOS Bundle ID
- Apple App ID with `Sign in with Apple`
- Service ID
- Key ID and `.p8`
- CloudBase Apple provider callback URL

- [ ] **Step 1: Replace the placeholder Bundle ID**

Current `org.reactjs.native.example.*` is not acceptable for provider setup.
Choose and register the final production Bundle ID before continuing.

- [ ] **Step 2: Configure Apple in CloudBase**

Create the Apple App ID, Service ID, callback URL, and ES256 client secret.
Store the `.p8` only in Apple/CloudBase secret configuration, never in Git.

- [ ] **Step 3: Record secret rotation**

Create an operational reminder at least 14 days before the Apple client secret
expires; Apple permits at most 180 days.

### Task 13: Implement Generic OAuth State Validation

**Files:**
- Create: `src/features/account/oauthFlow.ts`
- Test: `__tests__/oauthFlow.test.ts`

- [ ] **Step 1: Write failing tests**

Verify random state creation, one-time use, provider match, expiry, callback
scheme validation, and rejection of missing/mismatched state.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/oauthFlow.test.ts
```

- [ ] **Step 3: Implement with Keychain-backed pending state**

Persist only short-lived OAuth state and nonce. Delete them immediately after
success or failure.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm test -- --runInBand __tests__/oauthFlow.test.ts
git add src/features/account/oauthFlow.ts __tests__/oauthFlow.test.ts
git commit -m "feat(account): validate mobile OAuth callbacks"
```

### Task 14: Add Apple Authorization And Account Linking

**Files:**
- Create: `src/features/account/AppleLoginButton.tsx`
- Modify: `src/features/account/AuthProvider.ts`
- Modify: `src/features/account/cloudBaseAuthProvider.ts`
- Modify: `src/features/account/AccountAccessScreen.tsx`
- Modify: `src/features/account/AccountScreen.tsx`
- Modify: iOS URL/capability files
- Test: `__tests__/cloudBaseAuthProvider.test.ts`
- Test: `__tests__/accountAccess.test.tsx`

- [ ] **Step 1: Write failing provider tests**

The adapter must:

1. call `genProviderRedirectUri` for the configured Apple provider;
2. open the system authorization session;
3. validate callback state;
4. exchange the callback code with `grantProviderToken`;
5. call `signInWithProvider`;
6. return `link_required` rather than creating a duplicate account on
   `not_found`.

- [ ] **Step 2: Implement the provider flow**

Extend the interface with:

```ts
beginAppleLogin(): Promise<AccountSession | {status: 'link_required'}>;
linkPendingProvider(): Promise<AccountSession>;
```

- [ ] **Step 3: Implement first-time linking**

When `link_required`, require email or phone OTP sign-in, verify that account,
then call `bindWithProvider({provider_token})`. Never persist provider tokens
after binding.

- [ ] **Step 4: Add the Apple button**

Use Apple's official button treatment and show it only on iOS. Maintain a
minimum 44-point height.

- [ ] **Step 5: Verify**

```bash
npm test -- --runInBand \
  __tests__/cloudBaseAuthProvider.test.ts \
  __tests__/accountAccess.test.tsx
npx tsc --noEmit
```

- [ ] **Step 6: Real-device acceptance**

Test first-time link, repeat login, hidden email, cancellation, revoked Apple
authorization, app restart, and linking Apple to an existing phone/email UID.

- [ ] **Step 7: Commit**

```bash
git add src/features/account ios __tests__/cloudBaseAuthProvider.test.ts \
  __tests__/accountAccess.test.tsx
git commit -m "feat(account): add Apple login and account linking"
```

## Phase 3: WeChat Login

### Task 15: Complete WeChat Open Platform Prerequisites

**External resources:**
- Approved WeChat Open Platform mobile application
- iOS Bundle ID
- Android application ID and release signing fingerprint
- WeChat App ID/App Secret
- Universal Link/App Link
- CloudBase `wx_open` provider configuration

- [ ] **Step 1: Submit the mobile application**

Use the final production identifiers. Do not configure WeChat against debug
package identifiers because provider approval and callbacks will not transfer
cleanly to release.

- [ ] **Step 2: Configure CloudBase**

Store App Secret only in CloudBase's WeChat provider configuration. The client
contains App ID and callback information only.

### Task 16: Add WeChat Authorization And Account Linking

**Files:**
- Create: `src/features/account/WechatLoginButton.tsx`
- Modify: `src/features/account/AuthProvider.ts`
- Modify: `src/features/account/cloudBaseAuthProvider.ts`
- Modify: `src/features/account/AccountAccessScreen.tsx`
- Modify: `src/features/account/AccountScreen.tsx`
- Modify: `src/navigation/linking.ts`
- Modify: iOS and Android URL/app-link configuration
- Test: `__tests__/cloudBaseAuthProvider.test.ts`
- Test: `__tests__/oauthFlow.test.ts`
- Test: `__tests__/accountAccess.test.tsx`

- [ ] **Step 1: Write failing WeChat tests**

Verify:

```ts
await auth.genProviderRedirectUri({
  provider_id: 'wx_open',
  provider_redirect_uri: 'duapp://auth/wechat',
  state,
});
await auth.grantProviderToken({
  provider_id: 'wx_open',
  provider_redirect_uri: 'duapp://auth/wechat',
  provider_code: code,
});
await auth.signInWithProvider({provider_token});
```

Also verify `not_found` routes to verified email/phone linking.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand \
  __tests__/cloudBaseAuthProvider.test.ts \
  __tests__/oauthFlow.test.ts \
  __tests__/accountAccess.test.tsx
```

- [ ] **Step 3: Implement the WeChat flow**

Use the same one-time state validator as Apple. Never put the WeChat App Secret
in React Native configuration, plist, manifest, source, or GitHub Actions logs.

- [ ] **Step 4: Add provider availability behavior**

If WeChat is unavailable, hide the button or show a clear unavailable state;
do not trap the user in a dead authorization flow.

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- --runInBand \
  __tests__/cloudBaseAuthProvider.test.ts \
  __tests__/oauthFlow.test.ts \
  __tests__/accountAccess.test.tsx
npx tsc --noEmit
```

- [ ] **Step 6: Real-device acceptance**

Test iOS and Android release-signed builds for first-time binding, repeat
login, cancellation, missing WeChat, callback replay, provider revocation, and
linking to the same UID used by email/phone/Apple.

- [ ] **Step 7: Commit**

```bash
git add src/features/account src/navigation ios android \
  __tests__/cloudBaseAuthProvider.test.ts \
  __tests__/oauthFlow.test.ts \
  __tests__/accountAccess.test.tsx
git commit -m "feat(account): add WeChat login and account linking"
```

## Final Verification

### Task 17: Verify Identity Unity, Security, And Regression Safety

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test -- --runInBand
npx tsc --noEmit
npx eslint .
```

Expected: all commands pass without new warnings.

- [ ] **Step 2: Verify one UID across all providers**

For one test person:

1. sign in with email;
2. link phone;
3. link Apple;
4. link WeChat;
5. sign out;
6. sign in through each provider;
7. verify the CloudBase UID is identical every time.

- [ ] **Step 3: Verify account/key separation**

On a clean device, login must produce `signed_in_locked`. Historical encrypted
content remains inaccessible until trusted-device approval or recovery words
unlock the master key.

- [ ] **Step 4: Verify reservation abuse resistance**

Test duplicate idempotency keys, parallel reservation attempts, expired
reservations, forged byte counts, forged hashes, another user's reservation,
replayed tickets, and upload confirmation with the wrong object metadata.

- [ ] **Step 5: Verify local-first behavior**

Sign-out, provider cancellation, network loss, and provider outage must not
delete or block existing local-only records.

- [ ] **Step 6: Verify privacy and secret handling**

```bash
git grep -n -E \
  'Secret(Id|Key)|AppSecret|private_key|provider_token|refresh_token|recovery words'
git status --short
```

Expected: no production secret, provider token, recovery words, or temporary
test artifact is tracked.

- [ ] **Step 7: Push without rewriting history**

Push the existing feature branch normally. Do not amend, squash, rebase, or
force push.

## Operational Dependencies

- Email development can use CloudBase built-in mail; production sender identity
  should be reviewed before launch.
- SMS has ongoing cost and abuse risk. Keep server/provider frequency limits,
  add a daily cost alert, and do not advertise SMS as the only login path.
- Apple client secret rotation is a recurring operational task, not a one-time
  implementation detail.
- WeChat cannot be fully accepted in Simulator; final validation requires
  approved credentials, real devices, and release identifiers/signatures.
- Provider rollout must be feature-flagged independently so a provider outage
  does not block email/phone login.
