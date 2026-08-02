# Session Handoff

Updated: 2026-08-02

## Current Boundary

- Project: `du-app`, React Native 0.86.
- Last completed stage: Stage 3.
- Stage 3 was explicitly accepted by the user on 2026-08-02 and is ready for
  its stage commit.
- Stage 4 has not started. Do not begin it unless the user asks to continue.
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

## Latest Verification

All passed after the latest changes:

```text
npm run lint -- --no-fix
npx tsc --noEmit
npm test -- --runInBand
git diff --check
```

Jest result:

```text
2 suites passed
8 tests passed
```

The app was manually checked in the iPhone 17 Pro simulator:

- Daily gradients cover both components completely.
- Feelings panel expands and collapses by real vertical drag.
- Category taps and horizontal tag scrolling remain usable.
- Expanded tags wrap without covering the bottom tools.
- Custom input and `加入` remain visible with the keyboard.
- A custom tag is selected and passed to `createMemory`.
- A tagged old-memory card remains under its real `2025年十一月` section rather
  than being forced into `昨天`.
- Write refreshes its displayed time after returning from the future-letter
  placeholder; empty future content cannot leave the editor.
- No manual simulator check submitted a complete memory, so no verification
  record was intentionally added to the database.

Relevant screenshots are under `du-app/exports/`, including:

- `stage3-daily-gradients-fixed.png`
- `stage3-feelings-default.png`
- `stage3-feelings-expanded.png`
- `stage3-custom-feeling-input.png`

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

1. Read the files in the required order.
2. Inspect the current branch and worktree without reverting user changes.
3. Re-run the four verification commands.
4. Start Stage 4 Write tools only after the user explicitly asks to continue.
5. Keep microphone, camera, location, and notification permissions contextual;
   never request them at app startup.
6. Stop for user review before committing Stage 4.

## Suggested New-Task Prompt

```text
继续开发 du-app。先完整读取 du-app/docs/SESSION_HANDOFF.md，并按其中的
Required Reading Order 恢复上下文。保留当前所有未提交改动，不要 reset、
checkout 或回退。Stage 3 已验收完成；先检查 git status、diff 和测试结果，再
向我简要复述当前边界。未经我明确要求，不要开始或提交 Stage 4。
```
