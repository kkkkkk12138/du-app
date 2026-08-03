# Session Handoff

Updated: 2026-08-03

## Current Boundary

- Project: `du-app`, React Native 0.86.
- Stage 3 was accepted and committed as `9e678ac`.
- Stage 4 through Stage 6, the Daily memory detail redesign, and the opened
  letter redesign were committed together as `f0f8697`.
- The local branch is `main`; the working tree was clean immediately after
  `f0f8697`.
- New uncommitted work after `f0f8697` adds editable future-letter reminder
  time in Profile and a WatermelonDB v1-to-v2 settings migration.
- Reminder-time and schema-v2 work was committed separately as `947a10c`.
- New uncommitted work after `947a10c` implements Stage 7 Faraway with real
  WatermelonDB place aggregation and a Debug seed v4 location correction.
- The same uncommitted working tree now includes Stage 8 Profile and local data
  management. The user asked to keep Stage 7 and Stage 8 together for a later
  commit; do not commit either stage yet.
- Daily memory detail and the opened-letter reading page have both been
  redesigned with the shared warm-paper visual language.
- Daily replies are persisted once and now appear both in their parent memory
  thread and in the Letters `已拆` section.
- The opened-letter header uses explicit source-tab navigation instead of
  relying on `goBack()`, preventing stale modal-stack and touch-layer failures.
- The user explicitly approved committing all completed changes. Future work
  still requires a new commit; do not amend or rewrite `f0f8697`.
- Preserve all existing working-tree changes. Do not reset, checkout, or revert
  files that were not created by the current task.

## Remote Repository State

- Configured remote:
  `origin = https://github.com/kkkkkk12138/DU.git`
- The remote repository is private and owned by the authorized GitHub account.
- Remote `main` is currently `9235fd5` and contains the original HTML prototype.
- Local `main` is `947a10c` and contains the React Native history. The two
  histories have no common ancestor.
- The user chose to preserve the HTML prototype and merge the React Native
  project into remote `main`. Do not force-push or delete the prototype.
- The GitHub MCP connector has admin/push permission, but local HTTPS and SSH
  Git credentials are unavailable. The connector cannot ingest local binary
  files or a Git bundle, so the merge push is currently blocked.
- When local GitHub credentials become available, fetch remote `main`, merge
  with `--allow-unrelated-histories`, preserve all prototype files, resolve the
  README collision intentionally, then push normally.

## Required Reading Order

1. `AI_CODING_TASK.md`
2. `VISUAL_SPEC.md`
3. `style.css`
4. `daily.html`
5. `write.html`
6. `ANIMATION_SPEC.md`
7. `du-app/docs/PRODUCT_BACKLOG.md`
8. This file
9. `git status`, `git diff --check`, and the relevant working-tree diffs

The design HTML files are behavioral and visual references. Dynamic values in
them are examples only. Dates, lunar data, counts, statistics, places, weather,
and persisted content must come from real calculation or storage.

## Stage 3 Implemented Work

### Daily

- Real date, lunar calendar, solar term, auspicious activities, foreground and
  cross-midnight refresh.
- WatermelonDB-backed timeline and date grouping based only on real
  `writtenAt` values; descriptive tags never override calendar sections.
- Text, photo, audio, note, anchor, and old-memory cards.
- New-memory entry animation and temporary top placement by `newMemoryId`.
- Anchor statistics are computed from stored memories.
- Chinese month headings.
- `Noto Serif SC` and `Cormorant Garamond` typography.
- The phenology strip and write prompt now use full-container SVG gradients via
  `viewBox` and `preserveAspectRatio="none"`.
- Phenology border is `rgba(143,170,149,0.4)`.
- Prompt paper gradient is `#FBF4E8` to `#F5EBD8`; the red glow is confined to
  the upper-right area.

### Write

- Letter-paper editor, future-letter switch, fold corner, tools, stamp animation,
  and real WatermelonDB writes.
- Empty content and failed writes do not report success.
- Future letters do not create ordinary memories.
- The paper date refreshes whenever Write regains focus or the app returns to
  the foreground, while an unfinished draft remains intact.
- Empty future letters stay on Write with `先落下几句话`; a non-empty future
  letter reaches the Stage 6 placeholder, which has a `返回此刻` escape path.
- Feelings panel is a two-level draggable drawer:
  - collapsed height: `104`
  - expanded height: `236`
  - drag or tap handle to switch
  - collapsed mode uses one-row horizontal scrolling
  - expanded mode uses a wrapped grid
- Feeling copy uses short, conversational, awkward-but-sincere phrases:
  - Weather: 14 presets
  - Body: 12 presets
  - Heart: 13 presets
- Custom feeling component:
  - entry label: `自己写…`
  - maximum 12 characters
  - submit with return or `加入`
  - automatically selected
  - duplicate presets/custom tags are not duplicated
  - saved through the existing `customTags` field
- `GestureHandlerRootView` is installed at the app root.
- Jest uses the official `react-native-gesture-handler/jestSetup`.

## Stage 4 Implemented Work

- Contextual permissions:
  - camera permission is requested only after tapping `拍照`
  - microphone permission is requested only after tapping `录音`
  - location permission is requested only after tapping `位置`
  - iOS microphone denial is handled through `react-native-permissions`
- Recording:
  - `react-native-audio-record` output is archived under
    `Documents/du-attachments`
  - cancel, finish, 30-minute limit, 150ms transform-based waveform updates
  - background/inactive transition automatically stops and saves
  - the screen stays awake only while recording
  - iOS uses a persisted `patch-package` patch to replace the abandoned
    module's failing low-level AudioQueue writer with `AVAudioRecorder`
  - empty or missing WAV files are rejected instead of becoming fake
    attachments
  - the recording bar now springs in from below with a breathing red dot; saved
    attachments use a reduced-motion-aware scale and opacity entrance
- Playback:
  - Daily audio cards load the persisted WAV through `react-native-sound`
  - playback switches the iOS session from recording to `Playback`
  - play, pause, real elapsed position, completion reset, error state, and
    unmount release are implemented
- Camera:
  - rear-camera full-screen capture through VisionCamera
  - captured files are archived locally, with thumbnail and removal controls
  - capture failures show an inline error rather than rejecting silently
- Location:
  - one current high-accuracy reading is stored locally as real latitude and
    longitude
  - no upload or fabricated reverse-geocoded place name
- Handwriting:
  - full-screen SVG canvas with ink/cinnabar colors, fine/brush widths, undo,
    clear, cancel, and PNG export
  - export failures now produce an explicit toast instead of failing silently
- Memory writes persist `imagePath`, `audioPath`, `audioDuration`,
  `inkImagePath`, and `placeDetail` through the existing schema fields.
- Temporary capture files are removed after successful attachment archival.
- Daily attachment presentation:
  - cards show persisted handwriting thumbnails instead of hiding those
    attachments in storage
  - location appears once in the date metadata as `日期 · 坐标`; do not restore
    the removed body-level location chip
  - tapping any memory variant opens one shared detail card rather than a
    placeholder toast
  - the detail card presents the complete text, photo, playable audio,
    handwriting original, real coordinate panel, tags, date, and time
  - the card uses a 400ms opacity/translate/scale entrance with a reduced-motion
    fade fallback; backdrop tap, close control, and Android back all dismiss it
  - unavailable media is omitted or reported explicitly; no map, place name,
    or playback state is fabricated

## Stage 5 Implemented Work

- Letters reads real WatermelonDB `letters` and related `memories`.
- Pure letter logic is separated from database I/O and covers:
  - calendar-day countdown
  - real sent-to-arrival progress clamped to `0...1`
  - arriving, traveling, and opened classification
  - opened state taking precedence over arrival date
  - tomorrow count and deterministic section sorting
- Letters presents three real sections:
  - `即将靠岸`
  - `在途中`
  - `已拆`
- Arriving letters open Unseal; traveling letters remain unavailable; opened
  letters expose a real `查看原信` action.
- Unseal loads the persisted letter and memory and implements the five specified
  phases: wax fade, flap opening, paper extraction, sealed-scene exit, and full
  letter entrance.
- Animation timers and Reanimated values are cancelled on exit. Returning during
  opening leaves the letter unopened.
- The final opened state forces the full letter visible after the entrance
  animation, preventing a transparent blank completion frame.
- Opening writes `status=opened` and `openedAt`; returning to Letters moves the
  item from `即将靠岸` to `已拆`.
- Daily replies use their existing `Letter(status=reply)` link as an opened
  mailbox item. Lists and details resolve `replyMemoryId`, so the reply body is
  shown without duplicating the underlying Memory.
- The opened state uses a full-screen warm-paper reading surface with real
  photo, audio, and handwriting attachments. Its fixed 88x48pt source header
  is the only back control and explicitly pops to the source tab.
- `写封回信` routes to Write. `放回日迹` confirms and routes to Daily.
- Both actions use `popTo('Main', {screen})` so the full-screen Unseal modal is
  removed instead of remaining above Main as a cramped rounded sheet with a
  stale `返回信箱` control.
- Unseal records whether it came from Daily or Letters and labels back navigation
  accordingly.
- Reduced Motion uses a short fade path, but the current Simulator CLI cannot
  toggle that system preference for automated verification.

## Stage 6 Implemented Work

- The future-letter draft now moves explicitly from Write to NewLetter with
  content, tags, photo, audio, handwriting, and real coordinate paths intact.
- NewLetter provides one-year, half-year, three-month, and custom local-calendar
  arrival choices. Month-end and leap-year calculations clamp to valid dates.
- Custom arrival cannot be earlier than tomorrow and uses
  `react-native-date-picker`.
- One WatermelonDB transaction creates the future `Memory`, creates a
  `traveling` `Letter`, and writes the generated `letterId` back to the Memory.
- The send sequence implements the specified cinnabar bloom, ink-river fade,
  drifting envelope, toast, and Letters return using only opacity/transform.
- Reduced Motion skips the drifting envelope and uses a short fade.
- Local notification scheduling uses `@notifee/react-native`, requests
  permission only when the user seals a letter, and schedules in device-local
  time on the arrival date. Permission denial never blocks saving the letter.
- Letter reminder time defaults to `09:00` and is editable from Profile through
  a local-time picker. Editing it does not request notification permission;
  permission remains deferred until the user seals a letter.
- The setting persists in Zustand/AsyncStorage and the WatermelonDB settings
  snapshot. Schema v2 adds `settings.letter_reminder_time`.
- Daily now considers any arrived-but-unopened traveling/arrived letter and
  reloads after crossing a local calendar day, so in-app arrival nudges do not
  depend on notification permission.
- Successful sealing resets the root navigation to Letters, destroying the
  already-sent Write draft while preserving it when the user simply goes back.

Stage 6 verification completed:

- React Native autolinking discovers Notifee 9.1.8 and Date Picker 5.0.13 for
  both iOS and Android.
- Pure tests cover month-end, leap-day, tomorrow minimum, and local reminder
  time.
- Repository tests cover linked Memory + Letter creation and persisted media
  metadata.
- Isolated CocoaPods 1.15.2 installation and `pod install` succeeded without
  modifying the system Ruby environment.
- Notifee and Date Picker are present in Pods and React Native codegen.
- A real 10-second Notifee timestamp trigger was delivered in the iPhone 17 Pro
  simulator with the title `有信到了`.
- Date Picker's invalid TurboModule registration under the New Architecture is
  fixed through `patch-package`.

## Stage 7 Implemented Work

- Faraway now reads the local User, Place, and non-deleted ordinary Memory
  records from WatermelonDB instead of rendering a placeholder.
- The screen follows the supplied ink-landscape prototype with:
  - real city and place-linked memory counts
  - current-city stay duration calculated by local calendar day
  - hometown time-away calculated from the stored last visit
  - visited-place cards sorted by stored visit dates
  - place detail sheets with persisted fragments and explicit empty states
- Memory-to-place ownership uses only persisted `place_id`. It does not infer a
  city from prose, tags, coordinates, or example content.
- The detail sheet closes through backdrop press, its 44pt close control, and
  the Android back action through native Modal `onRequestClose`.
- `寄封信回去` opens Write without fabricating a recipient or draft.
- Debug seed v4 corrects the Tokyo development fragment from `shanghai` to
  `tokyo` and upserts fixed seed IDs so future seed-version changes do not
  create duplicate records.

## Stage 8 Implemented Work

- Profile was rejected once for not following the supplied prototype and then
  rebuilt against `profile.html` v6 as the visual authority. It now uses the
  exact compact one-screen structure: 38pt identity avatar, 35pt rows, 9pt
  section labels, 20pt tinted icon wells, 32x18 toggles, original copy, and the
  original row order. Do not restore the rejected large title/card layout.
- Profile shows the persisted nickname, avatar character, real account age, and
  Du number. Real WatermelonDB counts remain available in the repository but
  are not rendered because profile v6 removed the old statistics card.
- A dedicated editor updates only existing User fields; unsupported demographic
  or remote-avatar fields were not fabricated.
- Daily reminders request notification permission only when enabled and use a
  repeating Notifee trigger at the selected local time. Disabling removes the
  trigger.
- Letter-arrival reminders use the persisted arrival time and remove all
  pending future-letter triggers when disabled. Profile v6 intentionally has no
  extra reminder-time row.
- The privacy lock uses the device's supported biometric type through Keychain.
  It verifies on enable, at cold start, and after returning from background;
  cancellation leaves the app locked.
- Per the latest product direction, Profile no longer exposes backup or data
  export, and the former screen/service/routes were removed.
- Account sync is not implemented. Do not claim logged-in data is protected
  until authentication, server-side storage, attachment upload, conflict
  handling, restore, and deletion have been implemented and verified.
- `我的年度` is now a real current-year summary derived from persisted
  memories, places, and letters: active days, top month, top place, sent
  letters, opened letters, and the first-to-last entry range.
- Feedback is an in-app composer that uses the system share sheet and adds only
  app/system metadata. It never attaches diary content automatically.
- About now contains readable local Privacy Policy and Terms pages, accurate
  version/build metadata, data handling disclosures, and feedback. The rating
  row is hidden until a real App Store ID is configured.
- Onboarding users can read and close the privacy policy before checking
  consent; the previous non-interactive colored text was removed.
- Profile editing now presents explicit avatar choices and an editable nickname,
  persists both to the User record, and refreshes Profile on return.
- Art skins are a distinct future feature and no longer open the light/dark
  appearance selector.
- `ProfileEdit`, `AnnualSummary`, `Feedback`, and `LegalDocument` are
  registered as typed stack routes and deep-link paths.

## Latest Verification

All passed after the latest changes:

```text
npm run lint
npx tsc --noEmit
npm test -- --runInBand
git diff --check
pod install
xcodebuild (iPhone 17 Pro simulator, Debug)
```

Latest Jest result:

```text
14 suites passed
48 tests passed
```

Stage 7 verification:

- Pure tests cover local-calendar duration, date ranges, strict `place_id`
  grouping, and exclusion of unlinked prose from city statistics.
- Integration coverage opens and closes the current-place detail sheet.
- Signed iOS Debug build succeeded with isolated DerivedData, installed on the
  iPhone 17 Pro simulator, and launched as process `65820`.
- Startup logs contained no JavaScript, WatermelonDB, seed, or fatal errors.
- Simulator SQLite confirmed `development_seed_version=4`, one row per fixed
  seed ID, eight Shanghai fragments, and one Tokyo fragment correctly linked
  to `tokyo`.

Stage 8 verification:

- Unit tests cover local daily-reminder rollover and repeating trigger
  scheduling, real Profile aggregation, annual aggregation, and trimmed profile
  updates.
- Integration coverage verifies denied notification permission does not turn on
  Daily reminders, confirms the compact row opens the time picker after
  permission, and confirms the Profile editor persists its values.
- Clean unsigned and locally signed iOS Debug builds both succeeded with Xcode
  26.6 using `/tmp/du-app-derived-data-stage8`.
- The signed app installed and launched on the iPhone 17 Pro simulator as
  process `73151`; logs contained no JavaScript, WatermelonDB, native-module, or
  fatal errors.
- A post-rebuild simulator screenshot was OCR-checked against `profile.html`
  v6: all 13 prototype rows, four groups, account header, version, footer, and
  bottom tabs were visible in one screen and in the original order. The
  temporary Profile initial route used for this check was restored to Daily.
- The simulator cannot provide real Face ID or Touch ID acceptance. The
  biometric prompt, cancellation, background lock, and unlock flow still need
  a real-device pass.
- The production-entry refinement rebuilt and launched successfully as process
  `84805`. App-store submission still requires a public HTTPS copy of the
  privacy policy and real store identifiers; the app no longer pretends those
  external resources are configured.

Reminder-time migration verification:

- An existing simulator database created under schema v1 was launched against
  schema v2 without deleting app data.
- SQLite `settings` gained `letter_reminder_time`; `local-settings` contained
  the expected `09:00` value after bootstrap synchronization.
- The app remained alive as process `54197` with no database, schema,
  initialization, or fatal errors.
- Integration coverage confirms choosing `18:45` updates the settings store and
  does not call Notifee `requestPermission`.

Stage 4 native verification:

- CocoaPods 1.15.2 was installed under `/tmp`; all 22 native modules autolink,
  including `RNSound`.
- Signed iOS Debug build succeeded with Xcode 26.6 and launched in the iPhone
  17 Pro simulator without application initialization or TurboModule errors.
- The first Daily simulator frame was visually and accessibly readable.
- Simulator recording produced a valid 1-channel, 16 kHz, 16-bit WAV with
  603,966 frames over 37.75 seconds; the previous broken file had zero frames.
- A second end-to-end pass verified the live recording timer, attachment
  archival, WatermelonDB save, Daily audio card, and real CoreAudio playback
  queue startup.
- Simulator interaction verified the shared detail card on text, note, and
  audio variants, including dimmed context, readable metadata, tags, and the
  real location panel. Jest covers handwriting thumbnail/original rendering
  and coordinate detail disclosure.
- Simulator interaction also verified recording-bar entrance, breathing dot,
  live waveform/timer, saved attachment entrance, handwriting drawing, undo,
  PNG export, and the returned handwriting thumbnail.
- The iOS simulator has no camera device; camera capture needs a real-device
  acceptance pass. The simulator no-camera message and cancel path were
  accepted by the user.
- Android was not built because this machine has no Android SDK, `adb`,
  `sdkmanager`, `ANDROID_HOME`, or `ANDROID_SDK_ROOT`.

Stage 5 simulator verification:

- Letters loaded the real development seed in `即将靠岸`.
- Completing Unseal displayed the full letter and moved it to `已拆`; the top
  statistics changed from zero to one.
- `查看原信` reopened the full letter instead of showing a placeholder toast.
- `写封回信` opened Write and `放回日迹` returned to Daily.
- A near-simultaneous open-and-back test returned safely to Letters and kept the
  seed in `即将靠岸`, confirming interrupted animation does not write opened
  state.
- The first runtime launch used an unsigned simulator build and correctly failed
  Keychain entitlement initialization. Rebuilding with Xcode's local ad-hoc
  simulator signature fixed it without personal certificates or credentials.
- Reduced Motion still needs a manual simulator Settings or real-device pass.

Latest detail and mailbox verification:

- The Daily memory detail page follows
  `/Users/bytedance/memory-detail-dev-spec.md`: full-screen warm paper, real
  attachments, calendar header, reply thread, reply and stamp sheets, copy, and
  CameraRoll export.
- Memory replies are real hidden `Memory(type=reply)` records linked by
  `Letter(status=reply)`. They remain in the parent Daily thread and also appear
  under Letters `已拆`.
- Letter list/detail resolution uses `replyMemoryId`, so opening a reply shows
  its body rather than the parent Daily content.
- The opened-letter view now uses the same warm-paper language and real photo,
  audio, and handwriting components.
- The source back control has an 88x48pt interaction area and explicitly
  `popTo`s Daily or Letters. Integration tests cover returning to Letters.
- Signed iOS Debug build succeeded and launched as process `41033`; startup logs
  contained no fatal, module-resolution, or invariant errors.

Known format constraint:

- The recorder interface writes PCM/WAV on iOS and Android. The iOS native
  writer is patched to `AVAudioRecorder`, but it still intentionally emits
  WAV. Producing AAC/M4A requires a recorder or transcoding change. Current
  files are truthfully stored as `.wav`.

## Important Engineering Decisions

- Company device: no `sudo`, no global environment modification, no personal
  release credentials, signing certificates, Firebase production files, or
  Android keystores.
- Use isolated npm/Ruby/CocoaPods/DerivedData directories under `/tmp`.
- Publishing credentials and final release configuration remain for the
  personal computer.
- Never fabricate production-facing data. Hide unavailable values or show an
  explicit empty state.
- Unsupported product ideas belong in `docs/PRODUCT_BACKLOG.md`; do not render
  fake counts or engagement.
- UI values must follow the supplied visual specification exactly. Do not
  approximate colors, spacing, typography, radii, or shadows.

## Next Task

1. Continue from commit `947a10c`; preserve all uncommitted Stage 7 and Stage 8
   work. The user explicitly asked to commit later.
2. Perform a real-device pass for biometric enable, cancel, background lock,
   and unlock before treating privacy lock as accepted.
3. Manually verify all detail and sealing animation paths with Reduce Motion
   enabled.
4. Perform a real-device pass for microphone recording and camera capture when
   a device is available.
5. Perform an Android Debug build when an isolated Android SDK is available.
6. Decide with the user whether WAV is accepted or a recorder/transcoder change
   is authorized for M4A.
7. Complete the non-force remote merge only after local GitHub credentials are
   available. Preserve remote HTML prototype commit `9235fd5`.

## Suggested New-Task Prompt

```text
继续开发 du-app。项目路径是
/Users/bytedance/Library/Application Support/TRAE SOLO CN/ModularData/
ai-agent/work-mode-projects/6a6df7fb35cb044b98197f4d/du-app。
先完整读取 docs/SESSION_HANDOFF.md，并按 Required Reading Order 恢复上下文。
保留所有现有改动，不要 reset、checkout、强推或回退。当前本地 main 为
947a10c；其后有未提交的 Stage 7 远方页和 Stage 8 个人与数据管理，已通过
48 项测试及 iOS Debug 构建、安装、启动验证。用户要求后续一起提交，当前不
提交。Stage 4–6、Daily 详情和原信详情已提交。远端 main 为 9235fd5，保存
HTML 原型，和本地无共同历史；后续只能保留原型做正常合并，禁止 force
push。先检查 git status、最近提交和验证记录，再继续当前待办。
```
