# Deferred Items — Phase 01 Plan 01

## Pre-existing Test Failures (Out of Scope)

The following test failures existed BEFORE Plan 01 execution and are NOT caused by our changes.
They were confirmed pre-existing via git stash verification.

### src/tests/listing-detail-page.test.ts (4 failures)

Tests assert Next.js 14-style params signature `params: { slug: string }` but the source file
already uses Next.js 15 Promise-based params `params: Promise<{ slug: string }>`.

Scope: These tests need updating to Next.js 15 async params pattern. Deferred to Phase 4
when listing detail pages are migrated to D1 data source.

### src/tests/listings-page.test.ts (39 failures)

Tests assert various implementation details (file structure, function names, state patterns)
that do not match the current implementation.

Scope: These tests were written against a specification that was not fully implemented.
Deferred to Phase 4 when the listings page is migrated to use D1 as the data source.

## Total pre-existing failures: 43 tests
## Failures introduced by Plan 01: 0
