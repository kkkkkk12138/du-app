# Session Handoff

Updated: 2026-08-02

## Current Boundary

- Project: `du-app`, React Native 0.86.
- Last completed stage: Stage 3.
- Stage 3 was accepted and committed as `9e678ac`.
- Stage 4 is implemented in the working tree and awaiting user acceptance.
- Stage 5 Letters and Unseal are implemented in the working tree and awaiting
  user acceptance.
- Daily memory detail and the opened-letter reading page have both been
  redesigned with the shared warm-paper visual language.
- Daily replies are persisted once and now appear both in their parent memory
  thread and in the Letters `已拆` section.
- The opened-letter header uses explicit source-tab navigation instead of
  relying on `goBack()`, preventing stale modal-stack and touch-layer failures.
- Do not commit Stage 4 or Stage 5 without explicit user approval.
- Preserve all existing working-tree changes. Do not reset, checkout, or revert
  files that were not created by the current task.

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
- Letter reminder time is persisted in settings with a `09:00` default, ready
  for the settings UI to edit later.
- Daily now considers any arrived-but-unopened traveling/arrived letter and
  reloads after crossing a local calendar day, so in-app arrival nudges do not
  depend on notification permission.
- Successful sealing resets the root navigation to Letters, destroying the
  already-sent Write draft while preserving it when the user simply goes back.

Stage 6 verification currently completed:

- React Native autolinking discovers Notifee 9.1.8 and Date Picker 5.0.13 for
  both iOS and Android.
- Pure tests cover month-end, leap-day, tomorrow minimum, and local reminder
  time.
- Repository tests cover linked Memory + Letter creation and persisted media
  metadata.
- Jest: 6 suites and 21 tests pass; lint, TypeScript, and `git diff --check`
  pass.

Stage 6 native verification blocker:

- Existing Pods do not yet contain Notifee or Date Picker.
- The isolated CocoaPods 1.15.2 install under `/tmp` failed because
  `rubygems.org/specs.4.8.gz` timed out. No global Ruby environment was changed.
- Do not claim iOS notification/date-picker runtime verification until
  `pod install` succeeds and the simulator flow is rerun.

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

Jest result:

```text
4 suites passed
16 tests passed
```

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
  acceptance pass.
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

1. Preserve all current Stage 4, Stage 5, and Stage 6 working-tree changes.
2. Wait for the user's replacement Daily detail prototype; keep the current
   Daily and opened-letter detail views frozen.
3. Retry isolated CocoaPods installation, run `pod install`, then verify the
   complete Stage 6 save, notification permission, custom date picker, animation,
   and traveling-letter flow in the iOS simulator.
4. Manually verify Stage 5 and Stage 6 with Reduce Motion enabled.
5. Perform a real-device pass for microphone recording and camera capture.
6. Perform an Android Debug build when an isolated Android SDK is available.
7. Decide with the user whether WAV is accepted or a recorder/transcoder change
   is authorized for M4A.
8. Stop for user review before committing Stage 4, Stage 5, or Stage 6.

## Suggested New-Task Prompt

```text
继续开发 du-app。先完整读取 du-app/docs/SESSION_HANDOFF.md，并按其中的
Required Reading Order 恢复上下文。保留当前所有未提交改动，不要 reset、
checkout 或回退。Stage 4 已实现但尚未验收或提交；先检查 git status、diff、
Stage 5 和 Stage 6 也已实现但尚未提交。当前 Daily 与原信详情页冻结，等待
我的新原型；先检查 git status、diff、测试和原生构建记录，再向我简要复述
当前边界。未经我明确确认，不要提交 Stage 4、Stage 5 或 Stage 6。
```
