# Development Seed Idempotency Fix

## Problem

`seedDevelopmentData()` treats a missing local seed-version marker as proof
that no development records exist. If the marker is missing while fixed-ID
records remain in WatermelonDB, startup attempts to insert them again and
fails with `UNIQUE constraint failed: places.id`.

The same failure mode exists in `seedProductExamples()`: its core examples
can be fully committed while `product_examples_seeded` is absent, causing the
next startup to rebuild `example-place-hangzhou`.

## Scope

- Preserve all existing local data.
- Make the fixed development places, future-letter memory, letter, and tags
  safe to initialize after a partial or interrupted seed.
- Recover a lost product-example version marker without rebuilding a complete
  example set.
- Keep the existing daily-seed update behavior.
- Do not change production behavior because development seeding remains
  guarded by `__DEV__`.
- Do not alter Task 11 or account/upload behavior.

## Design

Inside the existing database writer, load the fixed-ID records before
creating the initial development seed:

- Existing fixed-ID records are left unchanged.
- Missing fixed-ID records are created.
- Logically deleted fixed-ID records still count as occupied IDs and are not
  restored.
- Tags without fixed IDs are detected by their stable seed identity
  (`category`, `text`) before insertion.
- The seed version marker is written only after the complete database writer
  succeeds.

Product examples use one committed-stage sentinel for each seed phase:
`example-place-hangzhou`, `example-book-v4-1`, and
`example-place-harbin`. When all three exist, including as logically deleted
records, the app applies the idempotent v6 copy update and restores the
version marker without recreating examples.

This makes initialization recoverable after a partial seed without deleting
or overwriting user data.

## Error Handling

Any database failure aborts the writer and leaves the seed version marker
unchanged. A later retry repeats the same idempotent reconciliation.

## Verification

Add a regression test where the seed version is absent but `shanghai` already
exists as a logically deleted record. The test must prove that initialization:

1. does not insert a duplicate `shanghai` record;
2. creates the other missing fixed records;
3. completes and writes the current seed version;
4. remains safe when called again.

Add a product-example regression test that removes only the version marker
after a complete seed and proves no example counts change when startup repairs
the marker.

Finally, run the focused test, the complete Jest suite, TypeScript, ESLint,
and relaunch the existing Simulator app without clearing its data.
