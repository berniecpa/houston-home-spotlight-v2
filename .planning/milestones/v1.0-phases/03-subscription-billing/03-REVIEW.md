---
phase: 03-subscription-billing
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/lib/stripe.ts
  - src/lib/subscription.ts
  - src/lib/stripe-events.ts
  - src/app/api/stripe/checkout/route.ts
  - src/app/api/stripe/portal/route.ts
  - src/app/api/stripe/webhook/route.ts
  - src/components/dashboard/BillingWidget.tsx
  - src/app/(dashboard)/dashboard/billing/page.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 3 Stripe subscription/billing implementation: client factory, subscription state helpers, the 5-event state machine, the three API routes (checkout, portal, webhook), the billing widget, and the billing page RSC. The cross-cutting security architecture is largely sound: the webhook reads the raw body first, verifies HMAC via `constructEventAsync` + `stripeCryptoProvider` before any DB write, rejects missing/invalid signatures with 400 and no side effects; checkout/portal derive the agent strictly from the verified session (never the body); admin is blocked with 403 before any Stripe call; all D1 queries are parameterized; grace is computed in epoch seconds; and no `runtime = 'edge'` export is present.

However, two BLOCKER-class correctness defects exist. First, `getStripe()` is a module-level singleton keyed on nothing — it caches the **first** secret key and silently ignores all later calls, which is brittle and can bind the webhook verifier or checkout to the wrong key/config if initialization order ever varies. More importantly, `current_period_end`/`current_period_start` are read directly off the Subscription object, but the pinned API version (`2026-05-27.dahlia`, a Basil-era version) moved these fields off the Subscription onto the **subscription items** — so the read silently falls back to `?? 0`, persisting `current_period_end = 0` and breaking the renewal-date display on the active-subscription widget. Several WARNING-level robustness gaps (silent customer-mapping failures, missing customer-not-found handling, non-atomic idempotency pre-check, unverified `sub.id` on invoice events) round out the review.

## Critical Issues

### CR-01: `getStripe()` singleton ignores the secret key on every call after the first

**File:** `src/lib/stripe.ts:24-49`
**Issue:** `_stripe` is a module-level singleton initialized lazily from the **first** `secretKey` argument. Every subsequent `getStripe(...)` call returns the cached instance and silently discards the passed key:

```ts
let _stripe: Stripe | null = null;
export function getStripe(secretKey: string): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secretKey, { ... });
  }
  return _stripe; // ignores secretKey on all later calls
}
```

In the Workers runtime a single isolate is reused across many requests, and `env.STRIPE_SECRET_KEY` is supposed to be the source of truth on each request. If the binding ever differs between invocations (key rotation via `wrangler secret put`, preview vs. production isolate reuse, or test harnesses that pass different keys), the stale cached client is used. This is a latent correctness/security defect: a rotated/revoked key would keep being used, and in multi-env scenarios one environment's client could service another's request. The function signature advertises per-call key injection but the implementation defeats it.

**Fix:** Cache per key (or drop the singleton — constructing a Stripe client is cheap):

```ts
const _clients = new Map<string, Stripe>();
export function getStripe(secretKey: string): Stripe {
  let client = _clients.get(secretKey);
  if (!client) {
    client = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2026-05-27.dahlia',
    });
    _clients.set(secretKey, client);
  }
  return client;
}
```

### CR-02: `current_period_end` / `current_period_start` are read from the wrong object on the pinned API version — renewal date persists as `0`

**File:** `src/lib/stripe-events.ts:90-92, 119-121` (also surfaces in `src/app/(dashboard)/dashboard/billing/page.tsx:86-97` and `BillingWidget.tsx:199-206`)
**Issue:** The code reads `current_period_end`/`current_period_start` directly off the `Subscription` object:

```ts
const periodEnd = (sub as unknown as Record<string, unknown>)['current_period_end'] as number ?? 0;
const periodStart = (sub as unknown as Record<string, unknown>)['current_period_start'] as number ?? 0;
```

The pinned `apiVersion: '2026-05-27.dahlia'` is a Basil-era (2025+) API version. In Basil and later, `current_period_start` and `current_period_end` were **removed from the Subscription object** and now live on each `subscription.items.data[i]` (per-item billing periods). On these versions `sub['current_period_end']` is `undefined`, so the `?? 0` fallback writes `current_period_end = 0` and `current_period_start = 0` into the `subscriptions` row on every `customer.subscription.created/updated` event.

Downstream, the billing page reads `current_period_end` from that row and passes it to `BillingWidget` as `renewalDate`; `formatEpochDate(0)` would render "December 31, 1969" (epoch 0). In practice the widget guards with `renewalDate !== null`, but `0` is not null, so a 1969 date is shown to active subscribers — a user-facing data-correctness defect. The deliberate `as unknown as Record<string, unknown>` cast plus the JSDoc note "Assumption A2: current_period_end is epoch seconds on Subscription objects" indicates the author was uncertain and bypassed the type system rather than verifying — and the type system would have flagged the missing field had the cast not been used.

**Fix:** Read the period boundaries from the subscription item (and verify against the actual pinned API version):

```ts
const item = sub.items?.data?.[0];
const periodEnd = (item?.current_period_end as number | undefined)
  ?? (sub as unknown as Record<string, unknown>)['current_period_end'] as number | undefined
  ?? 0;
const periodStart = (item?.current_period_start as number | undefined)
  ?? (sub as unknown as Record<string, unknown>)['current_period_start'] as number | undefined
  ?? 0;
```

Confirm field location against the Stripe docs for `2026-05-27.dahlia` before shipping. At minimum, do not silently coerce a missing period to `0` — if both lookups miss, leave the existing value untouched (use `COALESCE` in SQL) rather than overwriting a previously-correct value with `0`.

## Warnings

### WR-01: Idempotency pre-check + state update are not atomic; the "atomic batch" claim is unverified

**File:** `src/lib/stripe-events.ts:60-80`, asserted in `src/app/api/stripe/webhook/route.ts:106-115`
**Issue:** The design relies on `db.batch([...])` being atomic (all-or-nothing). The module JSDoc itself flags this as unverified (`@note Assumption A3: D1 batch([]) is treated as atomic ... If Cloudflare docs confirm it is NOT atomic, the idempotency-before-state ordering issue would be re-introduced`). Per Cloudflare's D1 docs, `batch()` runs statements sequentially in an **implicit transaction** and is atomic — but this is load-bearing for correctness and is currently shipped on an explicit "we didn't confirm this" note. If the assumption is wrong, a mid-batch failure could record the idempotency row while leaving the agent's `subscription_status` un-applied, permanently wedging that subscription in a stale state on Stripe retries (the retry would short-circuit at the pre-flight SELECT). Separately, the pre-flight `SELECT 1` is a non-atomic read before the batch; under concurrent delivery of the same event two handlers can both pass the SELECT, but `INSERT OR IGNORE` on the PK makes the second batch's idempotency insert a no-op **while still running the UPDATE** — so the state UPDATE executes twice. For these specific events the UPDATEs are idempotent, so this is not currently a data-corruption bug, but it contradicts the "true no-op on re-sent event" guarantee.
**Fix:** Confirm D1 `batch()` atomicity against the cited docs and replace the `@note` with a definitive statement. To make duplicates a true no-op (not just a benign double-UPDATE), gate the state UPDATE on the idempotency insert succeeding (e.g. only run the UPDATE `WHERE NOT EXISTS (SELECT 1 FROM stripe_events WHERE event_id = ?)` within the same batch, or check the `batch` result `meta.changes` on the insert).

### WR-02: `invoice.paid` / `invoice.payment_failed` blindly set state without verifying the customer exists in D1

**File:** `src/lib/stripe-events.ts:127-165`
**Issue:** Both invoice handlers run `UPDATE agents SET ... WHERE stripe_customer_id = ?`. If no agent row matches that `customer` (e.g. a customer created out-of-band in the Stripe dashboard, a test event, or a deleted agent), the UPDATE affects **0 rows** silently, the idempotency record is still written, and the webhook returns 200. The event is then permanently consumed with no state change and no log. There is no detection of "matched 0 agents," so a real mapping bug (e.g. customer ID drift) would be invisible. The same applies to the subscription events.
**Fix:** After the batch, inspect the agents-UPDATE result `meta.changes`; if `0`, `console.error` with the customer ID (not the secret) so ops can detect orphaned customers. Consider returning 200 still (to avoid infinite Stripe retries) but log loudly.

### WR-03: `customer.subscription.deleted` updates `subscriptions` by `sub.id` but the row may never have existed

**File:** `src/lib/stripe-events.ts:167-188`
**Issue:** The deleted handler runs `UPDATE subscriptions SET status='canceled' WHERE stripe_subscription_id = ?` using `sub.id`. The `subscriptions` row is only ever inserted by the `created/updated` handler. If a `deleted` event is delivered before any `created/updated` (Stripe does not guarantee ordering), this UPDATE matches 0 rows and the `subscriptions` table never reflects the canceled subscription, even though the `agents` row is correctly set to `lapsed`. The two tables can diverge.
**Fix:** Either upsert the subscriptions row in the deleted handler (INSERT ... ON CONFLICT) or accept the divergence explicitly and document that `subscriptions` is best-effort. At minimum, do not rely on `subscriptions` for any authorization decision (currently the billing page reads `current_period_end` from it — see CR-02).

### WR-04: Checkout persists a new Stripe customer ID with no row-match verification; a failed UPDATE creates orphaned customers

**File:** `src/app/api/stripe/checkout/route.ts:96-108`
**Issue:** When the agent has no `stripe_customer_id`, the route creates a Stripe customer and then `UPDATE agents SET stripe_customer_id = ? WHERE id = ?`. The `.run()` result is not checked. If the UPDATE matches 0 rows (race: agent deleted between the SELECT and UPDATE) or fails the `stripe_customer_id` UNIQUE constraint, a Stripe customer has already been created but is never persisted. On the next checkout attempt a **second** customer is created — the exact duplicate-customer outcome the comment claims to prevent. Because the error is swallowed into the generic 500 catch, the orphaned customer is invisible.
**Fix:** Check `result.meta.changes === 1` after the UPDATE; if not, log the created `customer.id` so it can be reconciled. Continue to pass the uid as `client_reference_id` (already done) and reconcile in the webhook as the source of truth.

### WR-05: Checkout returns `{ success: true, url: session.url }` where `session.url` can be `null`

**File:** `src/app/api/stripe/checkout/route.ts:113-124` (and `BillingWidget.tsx:83-84`)
**Issue:** `stripe.checkout.sessions.create(...)` returns `url: string | null` (null for certain session configurations). The route returns it unconditionally as `{ success: true, url: session.url }`. The client does `const { url } = await res.json(); window.location.href = url;` — if `url` is `null`, the browser navigates to the string `"null"` (a 404 on the app) with no error surfaced, since `res.ok` is true. The portal route has the same shape (`portalSession.url` is typed non-null there, lower risk).
**Fix:** Guard before returning: `if (!session.url) return NextResponse.json({ success: false, message: 'Checkout session has no URL' }, { status: 500 });`. Client-side, validate `url` is a non-empty string before assigning to `window.location.href`.

### WR-06: `invoice.paid` unconditionally forces `active`, which can resurrect a canceled subscription and override `deleted`

**File:** `src/lib/stripe-events.ts:127-143`
**Issue:** `invoice.paid` sets `subscription_status = 'active'` for the customer regardless of current state. Stripe can emit a final `invoice.paid` (e.g. proration/closing invoice) around cancellation, and event ordering is not guaranteed. If `invoice.paid` arrives after `customer.subscription.deleted`, the agent is flipped back to `active` with no active subscription, granting publish access to a lapsed agent. The handler keys only on `customer`, not on whether the paid invoice belongs to a live subscription.
**Fix:** Scope the activation to subscription invoices for the current subscription (check `invoice.subscription` and/or `invoice.billing_reason`), or only promote to `active` when the customer is not already `lapsed` due to a deletion. Prefer driving status primarily from `customer.subscription.*` events and treating `invoice.paid` as grace-clearing only.

## Info

### IN-01: Unverified token type — inconsistent admin-claim access across checkout route and billing page

**File:** `src/app/api/stripe/checkout/route.ts:67`, `src/app/(dashboard)/dashboard/billing/page.tsx:63`
**Issue:** The admin claim is read as `tokens.decodedToken.admin` in the checkout route but as `(tokens?.decodedToken as Record<string, unknown> | undefined)?.admin === true` in the billing page. The inconsistent access pattern and the loose cast suggest the `admin` custom claim is not in the decoded-token type. If `admin` is ever a truthy non-boolean (e.g. `1`), the checkout route's `if (tokens.decodedToken.admin)` would treat it as admin while the page's `=== true` would not — divergent admin detection across files.
**Fix:** Define a typed `DecodedToken & { admin?: boolean }` and use one helper (`isAdmin(tokens)`) in both places for consistent, strict (`=== true`) evaluation.

### IN-02: Billing page runs the renewal-date query for `grace` though the widget never renders it in that state

**File:** `src/app/(dashboard)/dashboard/billing/page.tsx:85-97`
**Issue:** The renewal-date query runs for both `active` and `grace`, but `BillingWidget` only renders `renewalDate` in the `active` branch — the `grace` branch uses `graceUntil` instead. The extra D1 read for grace is dead work. Minor; not a correctness issue.
**Fix:** Restrict the `subscriptions` query to `status === 'active'` only.

### IN-03: `default` webhook case records idempotency for unhandled event types, suppressing future handling

**File:** `src/lib/stripe-events.ts:191-196`
**Issue:** The `default` branch writes the idempotency record for any unhandled event type. If a new event type is later added to the switch, previously-received events of that type are already in `stripe_events` and will be skipped by the pre-flight SELECT — they will never be processed even after the code is updated. This is an intentional trade-off (comment acknowledges it) but worth flagging: it couples "we received it" with "we handled it" for events we explicitly do not handle.
**Fix:** Consider only recording idempotency for event types the switch actually handles, and letting unhandled types return 200 without persisting (Stripe will not retry on 200). Document the chosen behavior.

### IN-04: Webhook reads body and acquires Cloudflare context outside try/catch; an env-binding failure yields an unhandled 500

**File:** `src/app/api/stripe/webhook/route.ts:67-78`
**Issue:** `const body = await req.text()` and `getCloudflareContext({ async: true })` at lines 67 and 78 are outside any try/catch. If `getCloudflareContext` throws (binding misconfiguration), the handler rejects with an unhandled error rather than a controlled response. Low risk in normal operation, but inconsistent with the explicit error handling around verification and dispatch.
**Fix:** Wrap the context acquisition in the same defensive pattern, returning a 500 with `{ error: 'Configuration error' }` (no secret leakage).

---

_Reviewed: 2026-06-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
