# Media Checkout Domain Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, tested domain engine that calculates whole-entry media charges without enabling unfinished account, cloud, or payment UI.

**Architecture:** A dependency-free TypeScript module receives normalized media items, applies the 500 MB free-media rule atomically per item, calculates paid units, applies an existing credit balance, and recommends the smallest store product that can cover the shortage. React Native file inspection, account state, receipt verification, uploads, and UI remain outside this module and will be integrated by later plans.

**Tech Stack:** TypeScript 5.8, Jest 29, existing React Native 0.86 toolchain.

---

## File Structure

- Create `src/features/billing/mediaCheckout.ts`: media types, unit calculation, free-space allocation, quote generation, and product recommendation.
- Create `__tests__/mediaCheckout.test.ts`: behavior-first coverage for photos, handwriting, recordings, free space, existing credits, and recommendation.
- Create `docs/superpowers/plans/2026-09-02-media-checkout-domain-foundation.md`: this execution plan.

This phase intentionally does not modify `WriteScreen`, `NewLetterScreen`, the database schema, or store metadata. Activating a paywall before account sync, server-side entitlement accounting, and receipt verification exist would produce a misleading partial product.

### Task 1: Define Media Unit Rules

**Files:**
- Create: `src/features/billing/mediaCheckout.ts`
- Test: `__tests__/mediaCheckout.test.ts`

- [ ] **Step 1: Write the failing unit-rule tests**

```typescript
import {
  calculateMediaUnits,
  type CheckoutMediaItem,
} from '../src/features/billing/mediaCheckout';

describe('calculateMediaUnits', () => {
  test.each<{
    item: CheckoutMediaItem;
    expected: number;
  }>([
    {
      item: {id: 'photo-1', kind: 'photo', bytes: 2_000_000},
      expected: 1,
    },
    {
      item: {id: 'ink-1', kind: 'ink', bytes: 400_000},
      expected: 1,
    },
    {
      item: {
        id: 'audio-short',
        kind: 'audio',
        bytes: 4_000_000,
        durationSeconds: 15 * 60,
      },
      expected: 1,
    },
    {
      item: {
        id: 'audio-long',
        kind: 'audio',
        bytes: 8_000_000,
        durationSeconds: 15 * 60 + 1,
      },
      expected: 2,
    },
  ])('$item.id costs $expected unit(s)', ({item, expected}) => {
    expect(calculateMediaUnits(item)).toBe(expected);
  });

  test('rejects audio without a valid duration', () => {
    expect(() =>
      calculateMediaUnits({
        id: 'broken-audio',
        kind: 'audio',
        bytes: 1,
      }),
    ).toThrow('录音缺少有效时长');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/mediaCheckout.test.ts
```

Expected: FAIL because `src/features/billing/mediaCheckout.ts` does not exist.

- [ ] **Step 3: Implement the minimum unit rules**

```typescript
export type CheckoutMediaKind = 'photo' | 'audio' | 'ink';

export type CheckoutMediaItem = {
  id: string;
  kind: CheckoutMediaKind;
  bytes: number;
  durationSeconds?: number;
};

const LONG_AUDIO_THRESHOLD_SECONDS = 15 * 60;

export function calculateMediaUnits(item: CheckoutMediaItem) {
  if (item.kind !== 'audio') {
    return 1;
  }
  if (
    item.durationSeconds === undefined ||
    !Number.isFinite(item.durationSeconds) ||
    item.durationSeconds <= 0
  ) {
    throw new Error('录音缺少有效时长');
  }
  return item.durationSeconds > LONG_AUDIO_THRESHOLD_SECONDS ? 2 : 1;
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npm test -- --runInBand __tests__/mediaCheckout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the unit rules**

```bash
git add __tests__/mediaCheckout.test.ts src/features/billing/mediaCheckout.ts
git commit -m "feat(billing): define media unit rules"
```

### Task 2: Calculate a Whole-Entry Quote

**Files:**
- Modify: `src/features/billing/mediaCheckout.ts`
- Modify: `__tests__/mediaCheckout.test.ts`

- [ ] **Step 1: Write failing quote tests**

```typescript
import {
  calculateMediaCheckout,
  FREE_MEDIA_BYTES,
} from '../src/features/billing/mediaCheckout';

describe('calculateMediaCheckout', () => {
  test('saves text-only entries without media charges', () => {
    expect(
      calculateMediaCheckout({
        items: [],
        remainingFreeBytes: 0,
        availableCredits: 0,
      }),
    ).toEqual({
      freeItemIds: [],
      paidItems: [],
      totalUnits: 0,
      coveredUnits: 0,
      missingUnits: 0,
      remainingFreeBytes: 0,
    });
  });

  test('covers complete media items with remaining free space', () => {
    expect(
      calculateMediaCheckout({
        items: [
          {id: 'photo-1', kind: 'photo', bytes: 2_000_000},
          {id: 'ink-1', kind: 'ink', bytes: 500_000},
        ],
        remainingFreeBytes: FREE_MEDIA_BYTES,
        availableCredits: 0,
      }),
    ).toMatchObject({
      freeItemIds: ['photo-1', 'ink-1'],
      paidItems: [],
      totalUnits: 0,
      missingUnits: 0,
    });
  });

  test('does not partially consume free bytes for an item that does not fit', () => {
    expect(
      calculateMediaCheckout({
        items: [{id: 'photo-1', kind: 'photo', bytes: 2_000_000}],
        remainingFreeBytes: 1_000_000,
        availableCredits: 0,
      }),
    ).toEqual({
      freeItemIds: [],
      paidItems: [
        {
          id: 'photo-1',
          kind: 'photo',
          bytes: 2_000_000,
          units: 1,
        },
      ],
      totalUnits: 1,
      coveredUnits: 0,
      missingUnits: 1,
      remainingFreeBytes: 1_000_000,
    });
  });

  test('applies existing credits to the entire entry shortage', () => {
    expect(
      calculateMediaCheckout({
        items: [
          {id: 'photo-1', kind: 'photo', bytes: 2_000_000},
          {
            id: 'audio-1',
            kind: 'audio',
            bytes: 8_000_000,
            durationSeconds: 20 * 60,
          },
        ],
        remainingFreeBytes: 0,
        availableCredits: 2,
      }),
    ).toMatchObject({
      totalUnits: 3,
      coveredUnits: 2,
      missingUnits: 1,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/mediaCheckout.test.ts
```

Expected: FAIL because `calculateMediaCheckout` and `FREE_MEDIA_BYTES` are not defined.

- [ ] **Step 3: Implement deterministic whole-entry calculation**

```typescript
export const FREE_MEDIA_BYTES = 500 * 1024 * 1024;

export type PaidMediaItem = CheckoutMediaItem & {
  units: number;
};

export type MediaCheckoutQuote = {
  freeItemIds: string[];
  paidItems: PaidMediaItem[];
  totalUnits: number;
  coveredUnits: number;
  missingUnits: number;
  remainingFreeBytes: number;
};

export function calculateMediaCheckout({
  items,
  remainingFreeBytes,
  availableCredits,
}: {
  items: CheckoutMediaItem[];
  remainingFreeBytes: number;
  availableCredits: number;
}): MediaCheckoutQuote {
  const freeItemIds: string[] = [];
  const paidItems: PaidMediaItem[] = [];
  let freeBytes = Math.max(0, Math.floor(remainingFreeBytes));

  items.forEach(item => {
    if (!Number.isFinite(item.bytes) || item.bytes < 0) {
      throw new Error('媒体文件大小无效');
    }
    if (item.bytes <= freeBytes) {
      freeItemIds.push(item.id);
      freeBytes -= item.bytes;
      return;
    }
    paidItems.push({...item, units: calculateMediaUnits(item)});
  });

  const totalUnits = paidItems.reduce((sum, item) => sum + item.units, 0);
  const coveredUnits = Math.min(
    totalUnits,
    Math.max(0, Math.floor(availableCredits)),
  );

  return {
    freeItemIds,
    paidItems,
    totalUnits,
    coveredUnits,
    missingUnits: totalUnits - coveredUnits,
    remainingFreeBytes: freeBytes,
  };
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
npm test -- --runInBand __tests__/mediaCheckout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit whole-entry calculation**

```bash
git add __tests__/mediaCheckout.test.ts src/features/billing/mediaCheckout.ts
git commit -m "feat(billing): calculate whole-entry media charges"
```

### Task 3: Recommend the Smallest Covering Product

**Files:**
- Modify: `src/features/billing/mediaCheckout.ts`
- Modify: `__tests__/mediaCheckout.test.ts`

- [ ] **Step 1: Write failing product recommendation tests**

```typescript
import {
  recommendCreditProduct,
  type CreditProduct,
} from '../src/features/billing/mediaCheckout';

const products: CreditProduct[] = [
  {id: 'credit_1', credits: 1, priceMinor: 100},
  {id: 'credit_5', credits: 5, priceMinor: 400},
  {id: 'credit_10', credits: 10, priceMinor: 600},
  {id: 'credit_20', credits: 20, priceMinor: 1000},
];

describe('recommendCreditProduct', () => {
  test.each([
    [1, 'credit_1'],
    [3, 'credit_5'],
    [7, 'credit_10'],
    [16, 'credit_20'],
  ])('recommends a product covering %i missing units', (missing, expected) => {
    expect(recommendCreditProduct(missing, products)?.id).toBe(expected);
  });

  test('returns undefined when no purchase is required', () => {
    expect(recommendCreditProduct(0, products)).toBeUndefined();
  });

  test('rejects a shortage larger than the available products', () => {
    expect(() => recommendCreditProduct(21, products)).toThrow(
      '没有可覆盖本次内容的媒体额度商品',
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/mediaCheckout.test.ts
```

Expected: FAIL because `CreditProduct` and `recommendCreditProduct` are not defined.

- [ ] **Step 3: Implement product recommendation**

```typescript
export type CreditProduct = {
  id: string;
  credits: number;
  priceMinor: number;
};

export function recommendCreditProduct(
  missingUnits: number,
  products: CreditProduct[],
) {
  if (missingUnits <= 0) {
    return undefined;
  }
  const product = [...products]
    .filter(item => item.credits >= missingUnits)
    .sort(
      (left, right) =>
        left.credits - right.credits || left.priceMinor - right.priceMinor,
    )[0];
  if (!product) {
    throw new Error('没有可覆盖本次内容的媒体额度商品');
  }
  return product;
}
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- --runInBand __tests__/mediaCheckout.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

Expected: all commands pass without new warnings or errors.

- [ ] **Step 5: Commit product recommendation**

```bash
git add __tests__/mediaCheckout.test.ts src/features/billing/mediaCheckout.ts
git commit -m "feat(billing): recommend media credit products"
```

### Task 4: Record the Foundation Boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md`

- [ ] **Step 1: Add implementation status**

Append this section:

```markdown
## 当前实施状态

已实现并验证：

- 纯 TypeScript 整篇媒体额度计算
- 免费媒体空间的完整对象抵扣
- 已有额度抵扣与缺口计算
- 最小可覆盖商品推荐

尚未启用：

- 账号状态和服务端额度账本
- React Native 文件大小采集
- 客户端加密与媒体上传
- StoreKit、Play Billing 和服务端验单
- 日迹或信件保存时的结算界面

因此当前正式版本行为和商店文案保持不变，不宣称账号同步或媒体付费已经上线。
```

- [ ] **Step 2: Verify documentation and repository state**

Run:

```bash
rg -n "implemented|disabled|未启用" \
  docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md
git diff --check
git status --short
```

Expected: only the intended design-status change is present.

- [ ] **Step 3: Commit the implementation status**

```bash
git add docs/superpowers/specs/2026-09-02-account-sync-media-billing-design.md
git commit -m "docs: record media checkout foundation status"
```
