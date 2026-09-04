# Save, Encrypt, and Upload Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make final saves durable before network work, encrypt registered-account media with a device-held account key, resume uploads through a WatermelonDB outbox, and prevent future letters from appearing sent before upload and notification finalization.

**Architecture:** A local transaction writes the Memory/Letter and its upload job together. A single leased worker encrypts media through native iOS/Android modules, checkpoints `reserve → PUT → confirm`, and resumes from durable state after process or network interruption. Account key initialization is claimed atomically on the server so a returning account cannot silently generate a second master key.

**Tech Stack:** React Native 0.86.2, TypeScript 5.8, WatermelonDB 0.28, Zustand, React Native Keychain 10, React Native FS 2.20, Swift/CryptoKit, Kotlin/JCA, CloudBase JS SDK 3.8.2, CloudBase Node SDK 3.18.3, PostgreSQL, Tencent COS, Jest 29.

---

## Scope and delivery gates

1. The approved design is `docs/superpowers/specs/2026-09-04-save-upload-outbox-design.md`.
2. This plan implements account-key initialization, key reading, DUEM v1 media encryption, schema 15 outbox, worker recovery, final-save integration, future-letter finalization, and real-account acceptance.
3. This plan does not implement recovery phrases, trusted-device transfer, full structured-data sync, StoreKit, Play Billing, checkout UI, media download, or decryption UI.
4. A missing local key for an already initialized account always yields `signed_in_locked`; it never generates a replacement key.
5. Existing uncommitted changes in `docs/superpowers/plans/2026-09-02-media-checkout-domain-foundation.md` are user-owned and must not be staged with this work.
6. Use ordinary commits only. Do not amend, squash, rebase, reset, or force-push.
7. Native encryption is not accepted from Jest alone. iOS and Android builds plus fixed-vector/native round trips must pass.
8. UI integration is not accepted until its state logic and visible waiting/error behavior both pass tests.

CloudBase deployment commands use the CLI installation already verified in this workspace:

```bash
TCB_NODE="/Users/bytedance/.npm/_npx/0f3d59447e0213f8/node_modules/node/bin/node"
TCB_CLI="/Users/bytedance/.npm/_npx/f4a3769003ccd80b/node_modules/@cloudbase/cli/bin/tcb"
```

## File map

### Account encryption identity

- Create `cloudbase/migrations/20260904074000_claim_account_encryption_identity.sql`: server-owned first-device identity marker and atomic claim RPC.
- Create `functions/account-initialize-key/{index.js,handler.js,runtime.js,package.json}`: authenticated claim/read operation.
- Create `functions/media-renew-upload/{index.js,handler.js,runtime.js,package.json}`: renew expired, unreleased reservations without moving quota.
- Modify `cloudbaserc.json`: register `account-initialize-key` and `media-renew-upload`.
- Modify `src/services/cloudBaseGateway.ts`: expose `initializeAccountKey` and `renewMediaUpload`.
- Modify `src/features/account/keyRecoveryState.ts`: validated key read/write/delete and safe initialization.
- Modify `src/features/account/AccountSessionBootstrap.tsx`: verify local key against server identity after session restoration.
- Modify `src/features/account/AccountAccessScreen.tsx`: initialize encryption identity after first verified login.
- Create `__tests__/accountInitializeKeyFunction.test.js`.
- Create `__tests__/mediaRenewUploadFunction.test.js`.
- Create `__tests__/accountMasterKey.test.ts`.
- Modify `__tests__/cloudSchemaMigration.test.js`, `__tests__/cloudServices.test.ts`, `__tests__/accountSessionBootstrap.test.tsx`, and `__tests__/accountAccess.test.tsx`.

### Native DUEM v1 crypto

- Create `src/services/mediaCrypto.ts`: typed native bridge and stable errors.
- Create `src/features/billing/duemFormat.ts`: constants and result validation.
- Create `ios/duapp/DuemCipher.swift`: testable CryptoKit DUEM codec.
- Create `ios/duapp/DuMediaCrypto.swift`: React Native module using `DuemCipher`.
- Create `ios/duapp/DuMediaCryptoBridge.m`: React Native bridge export.
- Create `ios/duappTests/DuemCipherTests.swift`: fixed-vector and tamper tests.
- Modify `ios/duapp.xcodeproj/project.pbxproj`: compile production files and add the unit-test target.
- Create `android/app/src/main/java/com/duapp/DuemCipher.kt`: testable JCA DUEM codec.
- Create `android/app/src/main/java/com/duapp/DuMediaCryptoModule.kt`: React Native module using `DuemCipher`.
- Create `android/app/src/main/java/com/duapp/DuMediaCryptoPackage.kt`: React package.
- Create `android/app/src/test/java/com/duapp/DuemCipherTest.kt`: fixed-vector and tamper tests.
- Modify `android/app/src/main/java/com/duapp/MainApplication.kt`: register package.
- Create `test-fixtures/duem-v1-vector.json`: shared deterministic binary-format vector.
- Create `scripts/verify-duem-v1.mjs`: independent Node parser/decryptor for native fixture files.
- Create `__tests__/mediaCrypto.test.ts`.

### WatermelonDB outbox

- Modify `src/db/schema.ts`: schema 15 and new tables/Letter fields.
- Modify `src/db/migrations/index.ts`: version 15 migration.
- Modify `src/db/models.ts`: `MediaUploadJob`, `MediaUploadItem`, and Letter notification fields.
- Create `src/features/billing/uploadOutboxTypes.ts`: canonical states and transitions.
- Create `src/features/billing/uploadOutboxRepository.ts`: atomic job/item persistence, leases, checkpoints, and retry selection.
- Create `__tests__/uploadOutboxSchema.test.ts`.
- Create `__tests__/uploadOutboxRepository.test.ts`.

### Save and finalization

- Create `src/features/write/finalSaveService.ts`: shared account-aware final-save contract.
- Modify `src/db/memoryRepository.ts`: optional outbox creation in the Memory transaction.
- Modify `src/features/newLetter/futureLetterRepository.ts`: `pending_upload`/`pending_notification` creation.
- Create `src/features/newLetter/letterFinalizer.ts`: idempotent notification and `traveling` transition.
- Modify `src/services/letterNotifications.ts`: stable notification-ID helpers.
- Modify `__tests__/futureLetterRepository.test.ts`.
- Create `__tests__/finalSaveService.test.ts`.
- Create `__tests__/letterFinalizer.test.ts`.

### Worker and lifecycle

- Replace `src/features/billing/mediaUploadReservation.ts` with checkpoint-oriented transfer operations; retain the public encrypted-media validation rules.
- Create `src/features/billing/mediaUploadWorker.ts`: lease, encrypt, reserve, PUT, confirm, finalize, retry.
- Create `src/features/billing/uploadRetryPolicy.ts`: stable classification and backoff.
- Create `src/features/billing/UploadOutboxBootstrap.tsx`: save/foreground/network/unlock triggers.
- Modify `src/services/appLifecycle.ts`: pending-letter finalization recovery.
- Modify `App.tsx`: mount the outbox bootstrap inside account bootstrap.
- Modify `jest.setup.js`: native crypto and NetInfo mocks.
- Modify `__tests__/mediaUploadReservation.test.ts`.
- Create `__tests__/mediaUploadWorker.test.ts`.
- Create `__tests__/uploadOutboxBootstrap.test.tsx`.

### Product UI and acceptance

- Modify `src/features/write/WriteScreen.tsx`: use final-save completion kinds.
- Modify `src/features/newLetter/NewLetterScreen.tsx`: only play departure after `sent`.
- Modify `src/features/letters/lettersRepository.ts`: query `pending_upload` and `pending_notification`.
- Modify `src/features/letters/letterLogic.ts`: pending section/count behavior.
- Modify `src/features/letters/LettersScreen.tsx`: waiting and retry UI with 44×44pt controls.
- Create `__tests__/finalSaveScreens.test.tsx`.
- Modify `__tests__/lettersRepository.test.ts` and `__tests__/lettersDataRepository.test.ts`.
- Create `scripts/verify-real-media-upload.mjs`: authenticated acceptance verifier without embedding credentials.

## Phase 0: Freeze the baseline

### Task 1: Verify the approved starting point

**Files:**
- Read: `docs/superpowers/specs/2026-09-04-save-upload-outbox-design.md`
- Read: `docs/superpowers/plans/2026-09-04-multi-provider-auth-upload-reservations.md`
- Preserve: `docs/superpowers/plans/2026-09-02-media-checkout-domain-foundation.md`

- [ ] **Step 1: Record the branch and dirty files**

Run:

```bash
git branch --show-current
git status --short
```

Expected: branch `feat/account-sync-media-billing`; the user-owned plan remains modified and the approved design/this plan may be untracked until their dedicated documentation commit.

- [ ] **Step 2: Run the current focused baseline**

Run:

```bash
npm test -- --runInBand \
  __tests__/accountSessionBootstrap.test.tsx \
  __tests__/futureLetterRepository.test.ts \
  __tests__/mediaStorage.test.ts \
  __tests__/mediaUploadReservation.test.ts \
  __tests__/cloudServices.test.ts \
  __tests__/cloudSchemaMigration.test.js
```

Expected: PASS. Record any pre-existing failure before implementation; do not change unrelated behavior to hide it.

- [ ] **Step 3: Verify the TypeScript baseline**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Repair iOS dependencies without changing product code**

Run:

```bash
bundle install
bundle exec pod install --project-directory=ios
```

Expected: `ios/Pods/Target Support Files/Pods-duapp/Pods-duapp.debug.xcconfig` exists. If Ruby installation is blocked, stop native implementation and report the exact Bundler error; do not fake Simulator acceptance.

- [ ] **Step 5: Commit only the approved design and implementation plan**

```bash
git add \
  docs/superpowers/specs/2026-09-04-save-upload-outbox-design.md \
  docs/superpowers/plans/2026-09-04-save-upload-outbox.md
git commit -m "docs(media): design durable encrypted upload outbox"
```

Expected: the user-owned `2026-09-02-media-checkout-domain-foundation.md` remains unstaged.

## Phase 1: Establish one account encryption identity

### Task 2: Add the server-side first-device claim

**Files:**
- Create: `cloudbase/migrations/20260904074000_claim_account_encryption_identity.sql`
- Create: `functions/account-initialize-key/handler.js`
- Create: `functions/account-initialize-key/runtime.js`
- Create: `functions/account-initialize-key/index.js`
- Create: `functions/account-initialize-key/package.json`
- Modify: `cloudbaserc.json`
- Test: `__tests__/accountInitializeKeyFunction.test.js`
- Test: `__tests__/cloudSchemaMigration.test.js`

- [ ] **Step 1: Write failing handler tests**

Cover these exact cases:

```js
test('rejects anonymous callers');
test('claims a new account with a 64-char lowercase verifier');
test('returns existing when the verifier matches');
test('returns recovery_required when the account already has another verifier');
test('does not claim an unmarked account that already owns encrypted records');
```

The public result must be:

```js
{status: 'claimed' | 'existing' | 'recovery_required', keyVersion: 1}
```

Run:

```bash
npm test -- --runInBand \
  __tests__/accountInitializeKeyFunction.test.js \
  __tests__/cloudSchemaMigration.test.js
```

Expected: FAIL because the function and migration do not exist.

- [ ] **Step 2: Add the migration and atomic RPC**

Create a server-owned table:

```sql
CREATE TABLE public.account_encryption_identities (
  account_id bigint PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version = 1),
  key_verifier char(64) NOT NULL CHECK (key_verifier ~ '^[a-f0-9]{64}$'),
  initialized_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_encryption_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_encryption_identities FROM anon, authenticated;
```

Add a `SECURITY DEFINER` RPC that locks by account ID, returns `existing` for the same verifier, returns `recovery_required` for a different verifier, and refuses first claim when `account_key_envelopes`, `sync_records`, or `media_objects` already contain rows for that account. Grant execution only to `service_role`.

- [ ] **Step 3: Implement the cloud function**

Validate:

```js
const KEY_VERIFIER = /^[a-f0-9]{64}$/;
if (!KEY_VERIFIER.test(event?.keyVerifier ?? '')) {
  throw new Error('账号加密身份参数无效');
}
```

Authenticate before touching PostgreSQL. Call only the RPC from `runtime.js`; never let the client write the marker table.

- [ ] **Step 4: Register, test, migrate, and deploy**

Run:

```bash
npm test -- --runInBand \
  __tests__/accountInitializeKeyFunction.test.js \
  __tests__/cloudSchemaMigration.test.js
TCB_NODE="/Users/bytedance/.npm/_npx/0f3d59447e0213f8/node_modules/node/bin/node"
TCB_CLI="/Users/bytedance/.npm/_npx/f4a3769003ccd80b/node_modules/@cloudbase/cli/bin/tcb"
HOME=/tmp/du-tcb-home "$TCB_NODE" "$TCB_CLI" \
  db pg migration up -e du-1-d0gfhmkfe81e2d8e8
HOME=/tmp/du-tcb-home "$TCB_NODE" "$TCB_CLI" \
  fn deploy account-initialize-key -e du-1-d0gfhmkfe81e2d8e8
```

Expected: tests pass; migration is recorded; anonymous invocation is rejected.

- [ ] **Step 5: Commit**

```bash
git add \
  cloudbase/migrations/20260904074000_claim_account_encryption_identity.sql \
  functions/account-initialize-key \
  cloudbaserc.json \
  __tests__/accountInitializeKeyFunction.test.js \
  __tests__/cloudSchemaMigration.test.js
git commit -m "feat(account): claim first encryption identity safely"
```

### Task 3: Define the native crypto bridge and DUEM v1 validation

**Files:**
- Create: `src/features/billing/duemFormat.ts`
- Create: `src/services/mediaCrypto.ts`
- Modify: `jest.setup.js`
- Test: `__tests__/mediaCrypto.test.ts`

- [ ] **Step 1: Write the failing bridge tests**

Test this contract:

```ts
export type EncryptMediaInput = {
  sourcePath: string;
  destinationPath: string;
  masterKeyBase64: string;
  uid: string;
  entryCommitId: string;
  mediaId: string;
  mediaKind: 'photo' | 'audio' | 'ink';
  chunkSize: number;
};

export type EncryptedMediaResult = {
  encryptedPath: string;
  encryptedBytes: number;
  plaintextBytes: number;
  sha256: string;
  formatVersion: 1;
};
```

Assert that the wrapper rejects a missing native module, non-private paths, a non-32-byte key, invalid SHA-256, non-positive byte counts, and any format version other than `1`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/mediaCrypto.test.ts
```

Expected: FAIL because `mediaCrypto.ts` does not exist.

- [ ] **Step 3: Implement the narrow TypeScript wrapper**

Expose only:

```ts
generateRandomKey(): Promise<string>;
keyVerifier(uid: string, masterKeyBase64: string): Promise<string>;
encryptMediaFile(input: EncryptMediaInput): Promise<EncryptedMediaResult>;
inspectEncryptedFile(path: string): Promise<EncryptedMediaResult>;
deleteEncryptedFile(path: string): Promise<void>;
```

Normalize `file://` paths once. Require source and destination paths under app-private directories. Do not log bridge arguments.

Lock the binary encoding in `duemFormat.ts`:

```ts
export const DUEM_MAGIC = Uint8Array.from([0x44, 0x55, 0x45, 0x4d]);
export const DUEM_VERSION = 1;
export const DUEM_ALGORITHM_AES_256_GCM_HKDF_SHA256 = 1;
export const DUEM_SALT_BYTES = 32;
export const DUEM_NONCE_PREFIX_BYTES = 8;
export const DUEM_TAG_BYTES = 16;
export const DUEM_DEFAULT_CHUNK_BYTES = 1024 * 1024;
```

All integers are unsigned big-endian. HKDF `info` and each chunk AAD use UTF-8 strings prefixed by an unsigned 16-bit byte length:

```text
info = lp("du-media-v1") || lp(uid) || lp(mediaId) || lp(mediaKind)
aad  = header || lp(entryCommitId) || lp(mediaId) || lp(mediaKind)
       || uint32be(chunkIndex) || uint32be(plaintextLength)
keyVerifier = sha256(
  lp("du-account-key-verifier-v1") || lp(uid) || masterKeyBytes
)
```

Reject any UTF-8 field longer than 65,535 bytes before crossing the bridge.

- [ ] **Step 4: Add deterministic Jest native mocks and verify GREEN**

Add `NativeModules.DuMediaCrypto` methods to `jest.setup.js`, returning a valid 32-byte base64 key, 64-character verifier/hash, and DUEM v1 result.

Run:

```bash
npm test -- --runInBand __tests__/mediaCrypto.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/billing/duemFormat.ts \
  src/services/mediaCrypto.ts \
  jest.setup.js \
  __tests__/mediaCrypto.test.ts
git commit -m "feat(media): define DUEM native crypto contract"
```

### Task 4: Implement DUEM v1 on iOS

**Files:**
- Create: `ios/duapp/DuemCipher.swift`
- Create: `ios/duapp/DuMediaCrypto.swift`
- Create: `ios/duapp/DuMediaCryptoBridge.m`
- Create: `ios/duappTests/DuemCipherTests.swift`
- Modify: `ios/duapp.xcodeproj/project.pbxproj`
- Create: `test-fixtures/duem-v1-vector.json`
- Create: `scripts/verify-duem-v1.mjs`

- [ ] **Step 1: Add an independent DUEM verifier**

The Node script must parse:

```text
DUEM | version=1 | algorithm=1 | chunk_size:u32 |
plaintext_bytes:u64 | salt:32 | nonce_prefix:8 |
(plaintext_length:u32 | ciphertext:N | tag:16)*
```

It must derive the file key with HKDF-SHA-256, rebuild each nonce as `noncePrefix || uint32be(chunkIndex)`, rebuild AAD from the approved design, decrypt every chunk, and compare plaintext SHA-256 with an expected source file.

Add a deterministic vector with the 32-byte key `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=`, fixed salt/nonce prefix, metadata, plaintext base64, complete encrypted-file base64, and SHA-256. The script generates the expected encrypted bytes; native tests consume but never rewrite the committed vector.

- [ ] **Step 2: Implement the Swift module**

Use `SecRandomCopyBytes` for the 32-byte account key, salt, and nonce prefix. `DuemCipher` accepts injected entropy only in tests. Use CryptoKit `HKDF<SHA256>` and `AES.GCM.seal`. Read and write one chunk at a time with `FileHandle`; update a streaming `SHA256` over every emitted byte.

The module must:

```swift
reject paths outside the app container
write to destination + ".partial"
fsync and atomically move only after the final tag
remove ".partial" on every error
return uppercase-free SHA-256 hex
```

- [ ] **Step 3: Export all five bridge operations**

`DuMediaCryptoBridge.m` exports `generateRandomKey`, `keyVerifier`, `encryptMediaFile`, `inspectEncryptedFile`, and `deleteEncryptedFile`. Promise errors use stable codes:

```text
SOURCE_NOT_FOUND
KEY_INVALID
PATH_NOT_PRIVATE
ENCRYPTION_FAILED
OUTPUT_INVALID
DELETE_FAILED
```

- [ ] **Step 4: Run native vectors and build**

Run:

```bash
xcodebuild \
  -workspace ios/duapp.xcworkspace \
  -scheme duapp \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  test
node scripts/verify-duem-v1.mjs \
  --vector test-fixtures/duem-v1-vector.json
```

Then build the application:

```bash
xcodebuild \
  -workspace ios/duapp.xcworkspace \
  -scheme duapp \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

Expected: XCTest passes, the verifier prints `DUEM v1 verified`, and the application build succeeds.

- [ ] **Step 5: Commit**

```bash
git add \
  ios/duapp/DuemCipher.swift \
  ios/duapp/DuMediaCrypto.swift \
  ios/duapp/DuMediaCryptoBridge.m \
  ios/duappTests/DuemCipherTests.swift \
  ios/duapp.xcodeproj/project.pbxproj \
  test-fixtures/duem-v1-vector.json \
  scripts/verify-duem-v1.mjs
git commit -m "feat(media): encrypt DUEM files on iOS"
```

### Task 5: Implement DUEM v1 on Android

**Files:**
- Create: `android/app/src/main/java/com/duapp/DuemCipher.kt`
- Create: `android/app/src/main/java/com/duapp/DuMediaCryptoModule.kt`
- Create: `android/app/src/main/java/com/duapp/DuMediaCryptoPackage.kt`
- Create: `android/app/src/test/java/com/duapp/DuemCipherTest.kt`
- Modify: `android/app/src/main/java/com/duapp/MainApplication.kt`

- [ ] **Step 1: Implement the Kotlin module against the same format**

Use `SecureRandom`, `Mac.getInstance("HmacSHA256")` for RFC 5869 HKDF, `Cipher.getInstance("AES/GCM/NoPadding")`, `GCMParameterSpec(128, nonce)`, and `MessageDigest.getInstance("SHA-256")`. `DuemCipher` accepts deterministic salt and nonce-prefix providers only from unit tests.

Match Swift byte-for-byte:

```kotlin
val nonce = noncePrefix + ByteBuffer
  .allocate(4)
  .order(ByteOrder.BIG_ENDIAN)
  .putInt(chunkIndex)
  .array()
```

Write `.partial`, call `fileDescriptor.sync()`, and rename only after success. Reject non-app-private paths.

- [ ] **Step 2: Register the package**

Add:

```kotlin
add(DuMediaCryptoPackage())
```

next to the existing `DuFileSharePackage` and `DuGeocoderPackage`.

- [ ] **Step 3: Run native vectors and build Android**

```bash
./android/gradlew -p android app:testDebugUnitTest app:assembleDebug
```

Expected: the Kotlin test reads `test-fixtures/duem-v1-vector.json`, matches the exact encrypted bytes, rejects one-byte tampering, and Gradle reports `BUILD SUCCESSFUL`.

- [ ] **Step 4: Verify cross-platform compatibility**

Run `scripts/verify-duem-v1.mjs --vector test-fixtures/duem-v1-vector.json`, then compare the vector SHA asserted by both native suites.

Expected: both fixtures print `DUEM v1 verified`; corrupting one ciphertext byte makes verification fail with authentication error.

- [ ] **Step 5: Commit**

```bash
git add \
  android/app/src/main/java/com/duapp/DuemCipher.kt \
  android/app/src/main/java/com/duapp/DuMediaCryptoModule.kt \
  android/app/src/main/java/com/duapp/DuMediaCryptoPackage.kt \
  android/app/src/test/java/com/duapp/DuemCipherTest.kt \
  android/app/src/main/java/com/duapp/MainApplication.kt
git commit -m "feat(media): encrypt DUEM files on Android"
```

### Task 6: Implement validated Keychain storage and safe enrollment

**Files:**
- Modify: `src/features/account/keyRecoveryState.ts`
- Modify: `src/services/cloudBaseGateway.ts`
- Modify: `src/features/account/AccountSessionBootstrap.tsx`
- Modify: `src/features/account/AccountAccessScreen.tsx`
- Test: `__tests__/accountMasterKey.test.ts`
- Test: `__tests__/cloudServices.test.ts`
- Test: `__tests__/accountSessionBootstrap.test.tsx`
- Test: `__tests__/accountAccess.test.tsx`

- [ ] **Step 1: Write failing key-service tests**

Cover:

```ts
test('reads only a matching UID and exactly 32 decoded bytes');
test('stores with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY');
test('does not replace an invalid or missing key during session restore');
test('keeps an existing matching key when the server says existing');
test('deletes a newly generated candidate when the server requires recovery');
test('resumes a crash between local write and server claim with the same verifier');
```

- [ ] **Step 2: Add the gateway contract**

```ts
initializeAccountKey(input: {keyVerifier: string}): Promise<{
  status: 'claimed' | 'existing' | 'recovery_required';
  keyVersion: 1;
}>;
```

Validate the response before returning it.

- [ ] **Step 3: Implement Keychain operations**

Use:

```ts
service: `cn.du.app.account-master-key.${uid}`
accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
```

Expose `readAccountMasterKey`, `writeAccountMasterKey`, `deleteLocalAccountMasterKey`, `hasUnlockedAccountKey`, and `initializeAccountMasterKey`. The initializer generates a candidate only for an explicit post-verification enrollment call, computes its verifier through `mediaCrypto`, writes it locally, then calls the server. On `recovery_required`, delete only the candidate created by this call and return locked.

- [ ] **Step 4: Integrate login and restore**

`AccountAccessScreen` invokes explicit enrollment after OTP verification. `AccountSessionBootstrap` only validates an existing key and server verifier; it never creates one. Both call:

```ts
useAccountStore.getState().setSignedIn(session, unlocked);
```

with `unlocked=false` on missing, invalid, mismatched, or recovery-required keys.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --runInBand \
  __tests__/accountMasterKey.test.ts \
  __tests__/cloudServices.test.ts \
  __tests__/accountSessionBootstrap.test.tsx \
  __tests__/accountAccess.test.tsx
npx tsc --noEmit
git add \
  src/features/account/keyRecoveryState.ts \
  src/services/cloudBaseGateway.ts \
  src/features/account/AccountSessionBootstrap.tsx \
  src/features/account/AccountAccessScreen.tsx \
  __tests__/accountMasterKey.test.ts \
  __tests__/cloudServices.test.ts \
  __tests__/accountSessionBootstrap.test.tsx \
  __tests__/accountAccess.test.tsx
git commit -m "feat(account): initialize and validate account master keys"
```

Expected: tests pass; no test expects automatic key generation during restore.

## Phase 2: Persist the outbox

### Task 7: Add WatermelonDB schema 15

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations/index.ts`
- Modify: `src/db/models.ts`
- Create: `src/features/billing/uploadOutboxTypes.ts`
- Test: `__tests__/uploadOutboxSchema.test.ts`

- [ ] **Step 1: Write failing schema assertions**

Assert schema version `15`, both tables, all indexed fields, optional Letter notification fields, and registration in `modelClasses`.

Canonical states:

```ts
export type UploadJobState =
  | 'blocked_key'
  | 'pending_encrypt'
  | 'ready'
  | 'uploading'
  | 'confirming'
  | 'finalizing'
  | 'retry_wait'
  | 'confirmed'
  | 'cancelled'
  | 'failed_permanent';

export type UploadItemState =
  | 'pending_encrypt'
  | 'encrypted'
  | 'put_completed'
  | 'verified';
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/uploadOutboxSchema.test.ts
```

Expected: FAIL at schema version and missing tables.

- [ ] **Step 3: Add schema, migration, and models**

Use the fields from the approved design and add optional `reservation_expires_at` to `media_upload_jobs`, because the worker must decide when to call the renewal endpoint before ticket or confirmation requests. Add `notification_status` and `notification_id` to `letters`. Do not add upload state to `memories`.

- [ ] **Step 4: Verify migration compatibility**

Run:

```bash
npm test -- --runInBand \
  __tests__/uploadOutboxSchema.test.ts \
  __tests__/futureLetterRepository.test.ts \
  __tests__/lettersRepository.test.ts \
  __tests__/App.test.tsx
npx tsc --noEmit
```

Expected: PASS after updating old fixtures with optional Letter fields only where needed.

- [ ] **Step 5: Commit**

```bash
git add \
  src/db/schema.ts \
  src/db/migrations/index.ts \
  src/db/models.ts \
  src/features/billing/uploadOutboxTypes.ts \
  __tests__/uploadOutboxSchema.test.ts
git commit -m "feat(media): add durable upload outbox schema"
```

### Task 8: Implement the outbox repository and legal transitions

**Files:**
- Create: `src/features/billing/uploadOutboxRepository.ts`
- Create: `src/features/billing/uploadRetryPolicy.ts`
- Test: `__tests__/uploadOutboxRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Cover:

```ts
test('creates one job per entryCommitId');
test('claims only due jobs for the active UID');
test('does not claim a live lease');
test('reclaims an expired lease');
test('rejects an illegal state transition');
test('checkpoints encrypted metadata atomically');
test('persists reservation IDs before PUT');
test('keeps reservation after uncertain confirmation');
test('marks all verified items before finalizing');
```

- [ ] **Step 2: Add the transition guard**

Define an explicit map:

```ts
const allowedTransitions: Record<UploadJobState, UploadJobState[]> = {
  blocked_key: ['pending_encrypt', 'cancelled'],
  pending_encrypt: ['ready', 'retry_wait', 'cancelled', 'failed_permanent'],
  ready: ['uploading', 'retry_wait', 'cancelled', 'failed_permanent'],
  uploading: ['confirming', 'retry_wait', 'cancelled'],
  confirming: ['finalizing', 'retry_wait'],
  finalizing: ['confirmed', 'retry_wait'],
  retry_wait: [
    'blocked_key',
    'pending_encrypt',
    'ready',
    'uploading',
    'confirming',
    'finalizing',
    'cancelled',
    'failed_permanent',
  ],
  confirmed: [],
  cancelled: [],
  failed_permanent: [],
};
```

- [ ] **Step 3: Implement leases and retry policy**

Use a generated process owner ID and a five-minute lease. Backoff delays are:

```ts
const retryDelaysMs = [
  5_000,
  30_000,
  120_000,
  600_000,
  3_600_000,
];
const steadyStateDelayMs = 21_600_000;
```

Persist only stable error codes, not raw messages.

- [ ] **Step 4: Run tests**

```bash
npm test -- --runInBand __tests__/uploadOutboxRepository.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/billing/uploadOutboxRepository.ts \
  src/features/billing/uploadRetryPolicy.ts \
  __tests__/uploadOutboxRepository.test.ts
git commit -m "feat(media): persist upload jobs and checkpoints"
```

### Task 9: Create Memory and Letter with outbox in one transaction

**Files:**
- Create: `src/features/write/finalSaveService.ts`
- Modify: `src/db/memoryRepository.ts`
- Modify: `src/features/newLetter/futureLetterRepository.ts`
- Test: `__tests__/finalSaveService.test.ts`
- Test: `__tests__/futureLetterRepository.test.ts`

- [ ] **Step 1: Write failing transaction tests**

Cover all account modes:

```ts
signed_out + media => local record, no job
signed_in_locked + media => local record + blocked_key job
signed_in_unlocked + media => local record + pending_encrypt job
any account + no media => no upload job
future letter + upload job => pending_upload
future letter + no upload job => pending_notification
database failure => prepared durable copies rolled back
same entryCommitId => no duplicate job/items
```

- [ ] **Step 2: Define stable IDs before the transaction**

Generate once:

```ts
entryCommitId
idempotencyKey = `${entryType}:${localEntryId}:${entryCommitId}`
mediaId per attachment
```

The IDs must survive retries and must match `^[A-Za-z0-9._:-]{1,160}$` service validation.

- [ ] **Step 3: Move job creation into repository write callbacks**

Add optional account/outbox arguments to `createMemory` and `createFutureLetter`, but keep existing callers compiling. In the same `database.write`, write the business record, job, and items. Use long-lived attachment paths as `source_path`.

- [ ] **Step 4: Return completion kinds**

```ts
type SaveCompletionKind =
  | 'saved_local'
  | 'saved_pending_upload'
  | 'saved_pending_finalize'
  | 'sent';
```

Repositories return persistence results; `finalSaveService` maps them to completion kinds and triggers background work only after commit.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --runInBand \
  __tests__/finalSaveService.test.ts \
  __tests__/futureLetterRepository.test.ts \
  __tests__/mediaStorage.test.ts
npx tsc --noEmit
git add \
  src/features/write/finalSaveService.ts \
  src/db/memoryRepository.ts \
  src/features/newLetter/futureLetterRepository.ts \
  __tests__/finalSaveService.test.ts \
  __tests__/futureLetterRepository.test.ts
git commit -m "feat(write): save entries with durable upload jobs"
```

## Phase 3: Execute and recover uploads

### Task 10: Renew expired reservations without moving quota

**Files:**
- Create: `cloudbase/migrations/20260904075000_renew_media_reservations.sql`
- Create: `functions/media-renew-upload/handler.js`
- Create: `functions/media-renew-upload/runtime.js`
- Create: `functions/media-renew-upload/index.js`
- Create: `functions/media-renew-upload/package.json`
- Modify: `functions/media-create-upload-ticket/handler.js`
- Modify: `functions/media-confirm-upload/handler.js`
- Modify: `cloudbaserc.json`
- Modify: `src/services/cloudBaseGateway.ts`
- Test: `__tests__/mediaRenewUploadFunction.test.js`
- Test: `__tests__/mediaUploadTicketFunction.test.js`
- Test: `__tests__/mediaConfirmUploadFunction.test.js`

- [ ] **Step 1: Write failing expiration tests**

Cover:

```js
test('ticket returns MEDIA_RESERVATION_EXPIRED for an expired reservation');
test('confirm returns MEDIA_RESERVATION_EXPIRED for an expired reservation');
test('renews reserved and ticketed items owned by the caller');
test('keeps verified items unchanged during renewal');
test('does not change reserved_free_bytes during renewal');
test('rejects released commits and cross-account renewal');
test('returns the same renewed expiry when called twice');
```

Run:

```bash
npm test -- --runInBand \
  __tests__/mediaRenewUploadFunction.test.js \
  __tests__/mediaUploadTicketFunction.test.js \
  __tests__/mediaConfirmUploadFunction.test.js
```

Expected: FAIL because expiration has no stable code and no renewal function exists.

- [ ] **Step 2: Add the atomic renewal RPC**

`renew_media_upload_reservations(account_id, entry_commit_id, expires_at)` must lock the commit and all reservations. It may update only `reserved` and `ticketed` rows, preserve `object_key`, leave `verified` rows unchanged, update the commit expiry, and never update `credit_accounts`.

Return:

```sql
reservation_id varchar,
status varchar,
expires_at timestamptz
```

Revoke public/authenticated execution and grant only `service_role`.

- [ ] **Step 3: Implement and register `media-renew-upload`**

Authenticate first and accept:

```js
{entryCommitId: string}
```

Use a fresh 15-minute server expiry. Return:

```js
{
  entryCommitId,
  expiresAt,
  media: [{id, status, expiresAt}],
}
```

Use stable coded errors `MEDIA_RESERVATION_EXPIRED`, `MEDIA_RESERVATION_RELEASED`, and `MEDIA_RESERVATION_NOT_FOUND`.

- [ ] **Step 4: Add the client gateway and verify**

Expose:

```ts
renewMediaUpload(input: {entryCommitId: string}): Promise<{
  entryCommitId: string;
  expiresAt: number;
  media: Array<{
    id: string;
    status: 'reserved' | 'ticketed' | 'verified';
    expiresAt: number;
  }>;
}>;
```

Run:

```bash
npm test -- --runInBand \
  __tests__/mediaRenewUploadFunction.test.js \
  __tests__/mediaUploadTicketFunction.test.js \
  __tests__/mediaConfirmUploadFunction.test.js \
  __tests__/cloudServices.test.ts
TCB_NODE="/Users/bytedance/.npm/_npx/0f3d59447e0213f8/node_modules/node/bin/node"
TCB_CLI="/Users/bytedance/.npm/_npx/f4a3769003ccd80b/node_modules/@cloudbase/cli/bin/tcb"
HOME=/tmp/du-tcb-home "$TCB_NODE" "$TCB_CLI" \
  db pg migration up -e du-1-d0gfhmkfe81e2d8e8
HOME=/tmp/du-tcb-home "$TCB_NODE" "$TCB_CLI" \
  fn deploy media-renew-upload -e du-1-d0gfhmkfe81e2d8e8
```

Expected: tests pass and anonymous renewal is rejected.

- [ ] **Step 5: Commit**

```bash
git add \
  cloudbase/migrations/20260904075000_renew_media_reservations.sql \
  functions/media-renew-upload \
  functions/media-create-upload-ticket/handler.js \
  functions/media-confirm-upload/handler.js \
  cloudbaserc.json \
  src/services/cloudBaseGateway.ts \
  __tests__/mediaRenewUploadFunction.test.js \
  __tests__/mediaUploadTicketFunction.test.js \
  __tests__/mediaConfirmUploadFunction.test.js \
  __tests__/cloudServices.test.ts
git commit -m "feat(media): renew expired upload reservations"
```

### Task 11: Refactor transfer operations for durable checkpoints

**Files:**
- Modify: `src/features/billing/mediaUploadReservation.ts`
- Test: `__tests__/mediaUploadReservation.test.ts`

- [ ] **Step 1: Replace monolithic behavior tests**

The module must expose small operations:

```ts
reserveEncryptedMedia(input)
renewReservedCommit(entryCommitId)
putEncryptedItem(item, reservation)
confirmReservedItem(reservationId)
releaseReservedCommit(entryCommitId, reason)
```

Test that PUT failure is reported without automatic release, confirmation uncertainty is reported without release, verified reservations skip PUT, and server metadata mismatch is permanent.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --runInBand __tests__/mediaUploadReservation.test.ts
```

Expected: FAIL because the current coordinator releases a reservation after pre-confirm upload failure and cannot checkpoint individual items.

- [ ] **Step 3: Implement the operations**

Keep:

```ts
signed_out => ACCOUNT_REQUIRED
signed_in_locked => ACCOUNT_KEY_LOCKED
```

Remove catch-all lifecycle ownership from this module. Only explicit user cancellation calls release; the worker owns retries and state.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- --runInBand __tests__/mediaUploadReservation.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/billing/mediaUploadReservation.ts \
  __tests__/mediaUploadReservation.test.ts
git commit -m "refactor(media): expose checkpointed upload operations"
```

### Task 12: Implement the leased media upload worker

**Files:**
- Create: `src/features/billing/mediaUploadWorker.ts`
- Test: `__tests__/mediaUploadWorker.test.ts`

- [ ] **Step 1: Write failing worker tests**

Cover:

```ts
test('blocks without reading files when the account key is locked');
test('encrypts each pending item and checkpoints metadata');
test('reuses a valid encrypted file after restart');
test('re-encrypts when inspect result differs from persisted metadata');
test('persists reservations before requesting tickets');
test('renews an expired reservation and resumes with the same entry commit');
test('uploads all pending items before confirming any item');
test('resumes at confirmation without another PUT');
test('keeps reservation when confirmation remains uncertain');
test('marks source missing as failed_permanent');
test('never claims a job owned by another UID');
```

- [ ] **Step 2: Implement encryption recovery**

For each `pending_encrypt` item:

1. Read the account key once per job.
2. If `encrypted_path` exists, inspect and compare version, size, and hash.
3. Delete invalid output.
4. Encrypt to `du-upload-outbox/{jobId}/{mediaId}.enc`.
5. Checkpoint metadata before the next item.

- [ ] **Step 3: Implement reserve, PUT, and confirm phases**

Rules:

```text
reserve only after every item is encrypted
persist reservation IDs before ticket requests
renew expired reserved/ticketed items without changing entryCommitId or quota
PUT every non-verified item before confirming any item
persist put_completed after each 2xx
confirm each reservation idempotently
persist verified/object_key after each response
never release on timeout or uncertain confirm
```

- [ ] **Step 4: Implement terminal cleanup**

For Memory jobs, all verified items move the job through `finalizing` to `confirmed`, then delete only verified `.enc` files. Future-letter jobs stop in `finalizing` until Letter Finalizer completes.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --runInBand \
  __tests__/mediaUploadWorker.test.ts \
  __tests__/mediaUploadReservation.test.ts \
  __tests__/cloudServices.test.ts
npx tsc --noEmit
git add \
  src/features/billing/mediaUploadWorker.ts \
  __tests__/mediaUploadWorker.test.ts
git commit -m "feat(media): resume encrypted uploads from outbox"
```

### Task 13: Finalize future letters idempotently

**Files:**
- Create: `src/features/newLetter/letterFinalizer.ts`
- Modify: `src/services/letterNotifications.ts`
- Modify: `src/features/newLetter/futureLetterRepository.ts`
- Test: `__tests__/letterFinalizer.test.ts`
- Test: `__tests__/dailyNotifications.test.ts`

- [ ] **Step 1: Write failing finalizer tests**

Cover:

```ts
test('records not_authorized and transitions to traveling');
test('schedules an authorized notification before traveling');
test('detects an existing stable notification after a crash');
test('keeps pending_notification when scheduling throws');
test('confirms the upload job in the same database write as traveling');
test('does not finalize pending_upload');
```

- [ ] **Step 2: Make notification identity explicit**

Expose:

```ts
export const letterNotificationId = (letterId: string) =>
  `future-letter-${letterId}`;
```

Use it for create, check, and cancel.

- [ ] **Step 3: Implement `finalizePendingLetter`**

The function accepts injected permission/check/schedule dependencies for tests. If the notification already exists, treat it as `scheduled`. Persist notification outcome and `traveling` together; if a job exists, persist `confirmed` and `confirmed_at` in the same write.

- [ ] **Step 4: Add recovery query**

Expose:

```ts
finalizePendingLetters(): Promise<{
  finalized: number;
  failed: number;
}>;
```

Query only `status = pending_notification`.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --runInBand \
  __tests__/letterFinalizer.test.ts \
  __tests__/dailyNotifications.test.ts \
  __tests__/futureLetterRepository.test.ts
npx tsc --noEmit
git add \
  src/features/newLetter/letterFinalizer.ts \
  src/services/letterNotifications.ts \
  src/features/newLetter/futureLetterRepository.ts \
  __tests__/letterFinalizer.test.ts \
  __tests__/dailyNotifications.test.ts
git commit -m "feat(letters): finalize sent state after durable work"
```

### Task 14: Trigger recovery on lifecycle, network, and key unlock

**Files:**
- Create: `src/features/billing/UploadOutboxBootstrap.tsx`
- Modify: `src/services/appLifecycle.ts`
- Modify: `App.tsx`
- Modify: `jest.setup.js`
- Test: `__tests__/uploadOutboxBootstrap.test.tsx`
- Test: `__tests__/App.test.tsx`

- [ ] **Step 1: Write failing trigger tests**

Assert one coalesced worker run for:

```text
mount after account restoration
AppState active
NetInfo offline -> online
signed_in_locked -> signed_in_unlocked
explicit trigger after save
```

Assert no run for `restoring`, `signed_out`, offline, or a second event while a run is active.

- [ ] **Step 2: Implement a coalescing runner**

Use refs:

```ts
runningRef
rerunRequestedRef
```

If triggered while running, set `rerunRequestedRef`; after the current pass, execute once more. A pass drains due jobs serially and then calls `finalizePendingLetters`.

- [ ] **Step 3: Integrate lifecycle maintenance**

Mount `UploadOutboxBootstrap` inside `AccountSessionBootstrap`, where account state is available. Keep existing `runForegroundDataMaintenance`; add pending-letter finalization without making bootstrap fail when a remote operation fails.

- [ ] **Step 4: Run tests**

```bash
npm test -- --runInBand \
  __tests__/uploadOutboxBootstrap.test.tsx \
  __tests__/App.test.tsx
npx tsc --noEmit
```

Expected: PASS with no open timers or duplicate subscriptions.

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/billing/UploadOutboxBootstrap.tsx \
  src/services/appLifecycle.ts \
  App.tsx \
  jest.setup.js \
  __tests__/uploadOutboxBootstrap.test.tsx \
  __tests__/App.test.tsx
git commit -m "feat(media): resume upload jobs across app lifecycle"
```

## Phase 4: Integrate product behavior

### Task 15: Connect both final-save entry points

**Files:**
- Modify: `src/features/write/WriteScreen.tsx`
- Modify: `src/features/newLetter/NewLetterScreen.tsx`
- Test: `__tests__/finalSaveScreens.test.tsx`

- [ ] **Step 1: Write failing screen behavior tests**

Assert:

```text
Memory saved_pending_upload still clears the editor and opens Daily
Future letter sent plays departure and opens Letters
Future letter saved_pending_upload does not play departure
Future letter saved_pending_finalize does not claim it was sent
local transaction failure keeps editor content
locked account save never invokes encryption directly from the screen
```

- [ ] **Step 2: Replace direct repository calls**

Both screens call `finalSaveService`; remove direct notification scheduling from them. The service returns:

```ts
{
  memory;
  letter?;
  uploadJobId?;
  completion: SaveCompletionKind;
}
```

- [ ] **Step 3: Map completion to product behavior**

Use:

```text
saved_local: existing Memory success; future letter waits for finalizer result
saved_pending_upload: show “已保存，媒体将在解锁或联网后寄出”
saved_pending_finalize: show “信已保存，正在完成寄出”
sent: play existing departure animation
```

Do not display cloud internals, reservation IDs, or cryptographic terms.

- [ ] **Step 4: Run screen and repository tests**

```bash
npm test -- --runInBand \
  __tests__/finalSaveScreens.test.tsx \
  __tests__/futureLetterRepository.test.ts \
  __tests__/draftRepository.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/write/WriteScreen.tsx \
  src/features/newLetter/NewLetterScreen.tsx \
  __tests__/finalSaveScreens.test.tsx
git commit -m "feat(write): route final saves through durable outbox"
```

### Task 16: Show pending future letters without calling them sent

**Files:**
- Modify: `src/features/letters/lettersRepository.ts`
- Modify: `src/features/letters/letterLogic.ts`
- Modify: `src/features/letters/LettersScreen.tsx`
- Test: `__tests__/lettersRepository.test.ts`
- Test: `__tests__/lettersDataRepository.test.ts`

- [ ] **Step 1: Write failing status tests**

Assert `pending_upload` and `pending_notification` are excluded from `traveling`, `arriving`, and `arrived`; they appear in a pending group with one retry action.

- [ ] **Step 2: Add pending data shape**

```ts
type LetterSections = {
  pending: LetterWithMemory[];
  traveling: LetterWithMemory[];
  arriving: LetterWithMemory[];
  arrived: LetterWithMemory[];
};
```

Sort pending letters by `sentAt` descending.

- [ ] **Step 3: Add restrained pending UI**

Show status copy only:

```text
pending_upload: 待寄出
pending_notification: 正在完成寄出
```

Use one retry icon button with an accessibility label and a minimum 44×44pt hit area. Do not put pending cards inside another card or reuse the traveling animation.

- [ ] **Step 4: Run tests**

```bash
npm test -- --runInBand \
  __tests__/lettersRepository.test.ts \
  __tests__/lettersDataRepository.test.ts \
  __tests__/finalSaveScreens.test.tsx
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/letters/lettersRepository.ts \
  src/features/letters/letterLogic.ts \
  src/features/letters/LettersScreen.tsx \
  __tests__/lettersRepository.test.ts \
  __tests__/lettersDataRepository.test.ts
git commit -m "feat(letters): show pending delivery states"
```

## Phase 5: Verification and real-account acceptance

### Task 17: Run complete automated and native verification

**Files:**
- No product files unless a failing test reveals a scoped defect.

- [ ] **Step 1: Run all Jest tests**

```bash
npm test -- --runInBand
```

Expected: all suites pass.

- [ ] **Step 2: Run static checks**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS with no new warnings in touched files.

- [ ] **Step 3: Build iOS**

```bash
xcodebuild \
  -workspace ios/duapp.xcworkspace \
  -scheme duapp \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 4: Build Android**

```bash
./android/gradlew -p android app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit only scoped verification fixes**

Stage named files only. Use a new `fix(...)` commit for each independent defect; never amend an earlier commit.

### Task 18: Execute real-account encrypted upload acceptance

**Files:**
- Create: `scripts/verify-real-media-upload.mjs`
- Modify: `docs/superpowers/specs/2026-09-04-save-upload-outbox-design.md` only to append verified implementation status and evidence.

- [ ] **Step 1: Add a secret-free verifier**

The script accepts runtime values only:

```text
--entry-commit-id
--media-id
--encrypted-path
--expected-account-id
```

It reads credentials from the already authenticated test runtime or environment variables that are never printed. It checks CloudBase `media_objects`, `entry_commits`, `media_upload_reservations`, and `credit_accounts`, then prints redacted IDs and boolean assertions.

- [ ] **Step 2: Verify a real unlocked account**

On iOS Simulator:

1. Sign in with a development email/phone account.
2. Confirm the account becomes `signed_in_unlocked`.
3. Save one entry containing photo, audio, and handwriting.
4. Terminate the app during upload, relaunch, and observe resumption.
5. Run the verifier against the resulting entry commit.

Expected:

```text
all_media_verified=true
reserved_free_bytes_zero=true
quota_consumed_once=true
object_keys_stable=true
```

- [ ] **Step 3: Verify privacy and idempotency**

Download one development COS object through an authorized server-side diagnostic, confirm it starts with `DUEM`, confirm the original viewer cannot open it, and decrypt it only with `scripts/verify-duem-v1.mjs` plus the test key. Run the job again and verify no second reservation, object key, or quota charge appears.

- [ ] **Step 4: Verify account and product states**

Check:

```text
signed_out + media => local save, zero cloud calls
signed_in_locked + media => blocked_key, zero encryption/upload calls
future letter before confirm => pending_upload, no departure animation
future letter after confirm/finalize => traveling, one notification
pure text after media quota exhaustion => local save remains available
```

- [ ] **Step 5: Record evidence and commit**

Append only non-sensitive evidence: date, platform, build, entry type, pass/fail, redacted database assertions, and known limitations.

```bash
git add \
  scripts/verify-real-media-upload.mjs \
  docs/superpowers/specs/2026-09-04-save-upload-outbox-design.md
git commit -m "test(media): verify real encrypted upload recovery"
```

## Final delivery gate

Before declaring this phase complete:

```bash
git status --short
git log --oneline --decorate -15
```

The expected history contains separate documentation, server identity, crypto contract, iOS crypto, Android crypto, account key, schema, repository, save, transfer, worker, letter finalization, lifecycle, and UI commits. The user-owned modified plan remains uncommitted unless the user separately asks to include it.

Do not push until the user explicitly requests it. When pushing, push the feature branch normally without force and report the remote commit range.
