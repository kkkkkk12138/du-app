# Development Seed Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover app startup when development or product-example records exist but their local seed-version markers are missing.

**Architecture:** Reconcile development seed identities, including logically deleted IDs, before creation. For product examples, detect the three committed seed phases and restore a lost marker without rebuilding complete examples.

**Tech Stack:** TypeScript, React Native, WatermelonDB, Jest

---

### Task 1: Make the initial development seed idempotent

**Files:**
- Create: `__tests__/seed.test.ts`
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Write the failing partial-seed regression test**

Create an in-memory WatermelonDB test double whose `create` method throws on
duplicate IDs. Preload a logically deleted `shanghai` place, leave the seed
version undefined, call `seedDevelopmentData()`, and assert:

```ts
await expect(seedDevelopmentData()).resolves.toBeUndefined();
expect(mockCollections.places.filter(item => item.id === 'shanghai')).toHaveLength(1);
expect(mockCollections.places).toEqual(
  expect.arrayContaining([
    expect.objectContaining({id: 'changsha'}),
    expect.objectContaining({id: 'tokyo'}),
  ]),
);
expect(mockInstalledVersion).toBe(4);
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/seed.test.ts
```

Expected: FAIL with a duplicate `places.id` error for `shanghai`.

- [ ] **Step 3: Reconcile fixed records before creation**

Inside the existing `database.write`, fetch existing `places`, `memories`,
`letters`, and `tags`. Build stable identity sets:

```ts
const existingPlaceIds = new Set(existingPlaces.map(record => record.id));
const existingMemoryIds = new Set(existingMemories.map(record => record.id));
const existingLetterIds = new Set(existingLetters.map(record => record.id));
const existingTagKeys = new Set(
  existingTags.map(record => `${record.category}:${record.text}`),
);
```

Guard each initial seed create:

```ts
if (!existingPlaceIds.has(item.id)) {
  await database.get<Place>('places').create(/* existing initializer */);
}
```

Apply the equivalent fixed-ID guard to `seed-memory-letter` and
`seed-letter-one-year`, and use `${category}:${text}` for tag guards. Do not
update or delete existing user records.

Include IDs from `database.adapter.getDeletedRecords()` in the place, memory,
and letter identity sets so logical deletion does not free a SQLite primary
key.

- [ ] **Step 4: Verify GREEN and run full static checks**

Run:

```bash
npm test -- --runInBand __tests__/seed.test.ts
npm test -- --runInBand
./node_modules/.bin/tsc --noEmit --pretty false
npm run lint -- --quiet
```

Expected: all commands pass.

### Task 2: Repair a lost product-example marker

**Files:**
- Modify: `__tests__/productExamples.test.ts`
- Modify: `src/db/productExamples.ts`

- [ ] **Step 1: Write and verify the failing marker-loss test**

Seed all examples, clear only the mocked marker, mark
`example-place-hangzhou` logically deleted, and call
`seedProductExamples()` again. Expect `false`, unchanged collection counts,
and marker version 6.

Run:

```bash
npm test -- --runInBand __tests__/productExamples.test.ts
```

Expected: FAIL because the initial example transaction runs again.

- [ ] **Step 2: Recover from committed phase sentinels**

Check active and logically deleted IDs for:

```text
example-place-hangzhou
example-book-v4-1
example-place-harbin
```

When all exist and the marker is absent, apply the idempotent v6 copy update,
set marker version 6, and return `false` without recreating examples.

- [ ] **Step 3: Verify focused and full tests**

Run:

```bash
npm test -- --runInBand __tests__/seed.test.ts __tests__/productExamples.test.ts
npm test -- --runInBand
./node_modules/.bin/tsc --noEmit --pretty false
npm run lint -- --quiet
```

Expected: all commands pass.

- [ ] **Step 4: Verify the existing Simulator database recovers**

Keep Metro running, relaunch `org.reactjs.native.example.duapp`, press
`重试初始化`, and inspect Simulator state. Expected: neither the
`UNIQUE constraint failed: places.id` warning nor the
`本地数据没有准备好` fallback remains.

- [ ] **Step 6: Review scope**

Run:

```bash
git status --short
git diff --check -- . ':!docs/superpowers/plans/2026-09-02-media-checkout-domain-foundation.md'
```

Expected: only the design, plan, seed tests, `src/db/seed.ts`, and
`src/db/productExamples.ts` are new or modified for this bug; the user's
existing plan edit remains untouched.
