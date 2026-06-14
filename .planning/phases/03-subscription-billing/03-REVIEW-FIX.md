---
phase: 03-subscription-billing
fixed_at: 2026-06-13T00:00:00Z
review_path: .planning/phases/03-subscription-billing/03-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-06-13
**Source review:** .planning/phases/03-subscription-billing/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `getStripe()` singleton ignores the secret key on every call after the first

**Files modified:** `src/lib/stripe.ts`
**Commit:** 378145d
**Applied fix:** Replaced the bare module-level `_stripe` singleton with a `Map<string, Stripe>` keyed on the secret key. A call with a new/rotated key now constructs and caches a distinct client instead of silently reusing the first key. `Stripe.createFetchHttpClient()` and `apiVersion: '2026-05-27.dahlia'` preserved.

### CR-02: `current_period_end` / `current_period_start` read from the wrong object — renewal date persists as `0`

**Files modified:** `src/lib/stripe-events.ts`, `src/tests/billing.test.ts`
**Commit:** e34c152
**Applied fix:** Read the period boundaries from `sub.items.data[0]` instead of off the Subscription object, and removed the `as unknown as Record<string, unknown>` cast so TypeScript validates the access. Hardened the `subscriptions` upsert's `ON CONFLICT` clause so it only overwrites `current_period_start` / `current_period_end` when the resolved value is `> 0` (via `CASE WHEN ... > 0`), preventing a missing period from zeroing a previously-correct value. Updated the test's reference handler and the two `customer.subscription.created/updated` fixtures to nest the period fields under `items.data[0]`.
**Status:** fixed (field path verified against installed types — see CR-02 verification note below).

### WR-04: Checkout persists a new Stripe customer ID with no row-match verification

**Files modified:** `src/app/api/stripe/checkout/route.ts`
**Commit:** cdf8157
**Applied fix:** Captured the persist `UPDATE` result and `console.error` the created customer ID when `meta.changes !== 1`, so an orphaned Stripe customer (agent deleted between SELECT and UPDATE, or UNIQUE-constraint failure) is detectable for reconciliation. `client_reference_id: uid` was already set as the webhook recovery path.

### WR-05: Checkout returns `{ url: session.url }` where `session.url` can be `null`

**Files modified:** `src/app/api/stripe/checkout/route.ts` (commit cdf8157), `src/components/dashboard/BillingWidget.tsx` (commit 75e2adb)
**Commit:** cdf8157, 75e2adb
**Applied fix:** Server-side: guard before returning — if `!session.url`, log and return `{ success: false, message: 'Checkout session has no URL' }` with status 500. Client-side: validate the returned `url` is a non-empty string before assigning `window.location.href`, throwing the standard error otherwise so the failure surfaces instead of navigating to `"null"`.

### WR-01: Idempotency pre-check + state update atomicity claim unverified

**Files modified:** `src/lib/stripe-events.ts`
**Commit:** 57d9388
**Applied fix:** Replaced the unverified `@note Assumption A3` with a definitive statement that D1 `batch()` runs all statements in a single SQL transaction (atomic, all-or-none), citing the Cloudflare D1 worker-api docs. Documented the concurrent-duplicate behavior: the second handler's `INSERT OR IGNORE` is a no-op while its state UPDATE still runs, but because every state UPDATE here sets an absolute value (not a relative mutation) the duplicate is benign — no data corruption. A stricter `NOT EXISTS` gate was evaluated and explicitly rejected (within one atomic batch the INSERT commits before the UPDATE, so the guard would suppress the UPDATE on the normal first delivery too); documented as a deliberate trade-off rather than over-engineered.

### WR-02: invoice / subscription handlers set state without verifying the customer exists

**Files modified:** `src/lib/stripe-events.ts`
**Commit:** 57d9388
**Applied fix:** Added a `warnIfNoAgentMatched()` helper that `console.error`s the customer ID (no secret) when the agents `UPDATE` matched 0 rows. Wired it into `customer.subscription.created/updated`, `invoice.payment_failed`, and `customer.subscription.deleted` by capturing the batch result and inspecting `meta.changes` on the agents-UPDATE statement. Still returns 200 to avoid infinite Stripe retries. (Deliberately not wired into `invoice.paid` because its 0-row result is now ambiguous — see WR-06.)

### WR-03: `customer.subscription.deleted` updates `subscriptions` by `sub.id` but the row may never have existed

**Files modified:** `src/lib/stripe-events.ts`, `src/tests/billing.test.ts`
**Commit:** 57d9388
**Applied fix:** Replaced the bare `UPDATE subscriptions ... WHERE stripe_subscription_id = ?` with an `INSERT ... SELECT FROM agents ... ON CONFLICT(stripe_subscription_id) DO UPDATE SET status='canceled'` upsert, so a `deleted` event delivered before any `created/updated` still records a canceled `subscriptions` row instead of diverging from the `agents` row. `ON CONFLICT` only flips status to `canceled`, so a later out-of-order `created` cannot revive it. Test reference handler updated to mirror (batch still 3 statements).

### WR-06: `invoice.paid` unconditionally forces `active`, can resurrect a canceled subscription

**Files modified:** `src/lib/stripe-events.ts`, `src/tests/billing.test.ts`
**Commit:** 57d9388
**Applied fix:** Added `AND subscription_status != 'lapsed'` to the `invoice.paid` agents UPDATE so a closing/proration `invoice.paid` arriving after `customer.subscription.deleted` cannot flip a lapsed agent back to active. Test reference handler updated to mirror.
**Status:** fixed: requires human verification (this is a state-machine/ordering logic change; confirm the chosen rule — "never re-activate a lapsed customer via invoice.paid" — matches intended business semantics, e.g. reactivation after a lapse should flow through `customer.subscription.created/updated`).

## Skipped Issues

None.

## Out-of-Scope (Info findings — not in critical_warning scope)

IN-01 through IN-04 were not addressed (Info severity, outside `fix_scope: critical_warning`).

## CR-02 Field-Location Verification

Verified against the installed SDK (`stripe@22.2.1`, types under `node_modules/stripe/esm/resources/`):

- `Subscription` interface (`Subscriptions.d.ts:89`) has **no** `current_period_end` / `current_period_start` properties. Those names appear only in `SubscriptionListParams` query filters (`current_period_end?`, `current_period_start?` at lines ~2568/2572) and a doc comment — not as readable fields on the object.
- `Subscription.items` is `ApiList<SubscriptionItem>` (`Subscriptions.d.ts:195`).
- `SubscriptionItem` (`SubscriptionItems.d.ts:30`) declares `current_period_end: number` (line 54) and `current_period_start: number` (line 58) — both **non-optional**.

Conclusion: the correct path on the pinned `2026-05-27.dahlia` (Basil-era) API is `sub.items.data[0].current_period_end` / `.current_period_start`, exactly as the review predicted. The new code reads from there and falls back to `0` only when no item is present, with the SQL `CASE WHEN > 0` guard preventing a `0` from overwriting a good persisted value.

## Verification Results

- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) — clean, no errors.
- **Tests:** `npm test` — 788 tests, 784 pass, 4 fail. All 4 failures are the pre-existing `src/tests/listing-detail-page.test.ts` failures (unrelated to billing). No new failures introduced; all billing/Stripe tests pass.

---

_Fixed: 2026-06-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
