# Letter Reader Collapse Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the opened-letter top-left collapse control so it is visually balanced and reliably tappable.

**Architecture:** Keep the change local to `LetterReadingView`. Preserve the existing navigation callback and accessibility destination label, while aligning the control with the write screen's typography and enforcing a stable 44 by 44 point hit target.

**Tech Stack:** React Native, TypeScript, Jest, react-test-renderer.

---

### Task 1: Lock the interaction and layout contract

**Files:**
- Modify: `__tests__/letterReadingView.test.tsx`
- Modify: `src/features/unseal/LetterReadingView.tsx`

- [ ] **Step 1: Write a failing test**

Assert that the opened-letter control renders `收起`, keeps the destination-aware accessibility label, and has a flattened style with `minWidth: 44`, `minHeight: 44`, `alignItems: 'flex-start'`, and horizontal padding.

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- --runInBand __tests__/letterReadingView.test.tsx --forceExit
```

Expected: FAIL because the control still renders `收回` and centers its label.

- [ ] **Step 3: Implement the visual correction**

Change the label to `收起`, use the same sans-serif 14 point treatment as the write screen, left-align the 44 point control, and reduce the letter toolbar height to match the established top-bar rhythm.

- [ ] **Step 4: Verify focused and full regression**

Run:

```bash
npm test -- --runInBand __tests__/letterReadingView.test.tsx --forceExit
npm test -- --runInBand --forceExit
npx tsc --noEmit
npm run lint
git diff --check
```

Expected: all commands pass.

No commit is included because the user has not requested one.
