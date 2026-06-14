---
phase: 03-subscription-billing
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
human_verification:
  - test: "Live Stripe Checkout flow — agent subscribes via Stripe Checkout"
    expected: "Agent clicks Subscribe on /dashboard/billing, completes Checkout with test card 4242 4242 4242 4242, and D1 agents row flips to subscription_status='active' within seconds (BILL-01 end-to-end)"
    why_human: "Requires live Stripe test-mode credentials, a configured $79/mo Price, and wrangler dev running against D1. Cannot verify HMAC-signed Checkout session round-trip or D1 write without live Stripe."
  - test: "Customer Portal flow — agent self-manages subscription via Stripe Portal"
    expected: "Agent clicks Manage billing, Stripe Portal opens, agent can cancel, webhook fires customer.subscription.deleted, D1 row flips to subscription_status='lapsed' (BILL-02 end-to-end)"
    why_human: "Requires Stripe Customer Portal configured in Stripe Dashboard (Billing > Customer Portal). Without Portal setup billingPortal.sessions.create returns 400. Cannot verify without live credentials (RESEARCH Pitfall 7)."
  - test: "Webhook delivery and idempotency — invoice.payment_failed and duplicate event"
    expected: "stripe trigger invoice.payment_failed sets subscription_status='grace' with subscription_grace_until close to now+604800 (epoch seconds). Re-sending the same event produces no second stripe_events row and no duplicate state update (BILL-03 + BILL-05)."
    why_human: "Requires stripe listen --forward-to and STRIPE_WEBHOOK_SECRET to validate real HMAC signature. Epoch-seconds calculation is unit-tested but live D1 write must be confirmed."
  - test: "WR-06 business-rule approval — invoice.paid must not resurrect a lapsed agent"
    expected: "After customer.subscription.deleted sets status='lapsed', a subsequent invoice.paid (closing/proration invoice) does NOT flip the agent back to 'active'. Reactivation flows only through a new customer.subscription.created."
    why_human: "Deliberate state-machine business rule encoded in WR-06 fix (WHERE subscription_status != 'lapsed'). Bernard (platform owner) should confirm this matches intended churn/reactivation semantics before shipping."
  - test: "BillingWidget visual rendering — all 4 states + admin notice in browser"
    expected: "none -> Subscribe CTA at $79/mo; active -> Active badge + renewal date + Manage billing; grace -> amber payment-failed warning with grace date + Manage billing; lapsed -> Subscription ended + Reactivate CTA; admin -> complimentary access notice, no Subscribe/Manage CTAs."
    why_human: "Client-side conditional JSX rendering, Tailwind class application, and date formatting (toLocaleDateString on epoch seconds) must be visually confirmed in wrangler dev. Source-text assertions cannot substitute for visual inspection."
---

# Phase 3: Subscription Billing Verification Report

**Phase Goal:** Agents can subscribe to the platform via Stripe Checkout and self-manage their billing, and the platform correctly tracks subscription state (including grace periods) in D1 via webhooks.
**Verified:** 2026-06-13T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | isAgentPublishable returns true for admin (is_admin=1) regardless of subscription_status | VERIFIED | `src/lib/subscription.ts:66` — `if (agent.is_admin === 1) return true;`. Two admin bypass tests pass (none and lapsed statuses). |
| 2 | isAgentPublishable returns true for subscription_status='active' | VERIFIED | `src/lib/subscription.ts:68` — `if (agent.subscription_status === 'active') return true;`. Test passes. |
| 3 | isAgentPublishable returns true for 'grace' only while subscription_grace_until > now (epoch seconds) | VERIFIED | `src/lib/subscription.ts:70-77` — uses `Math.floor(Date.now() / 1000)`. Future grace test returns true; past grace (-1s) returns false; null grace returns false. |
| 4 | isAgentPublishable returns false for 'none' and 'lapsed' | VERIFIED | `src/lib/subscription.ts:78` — falls through to `return false`. Both 'none' and 'lapsed' tests pass. |
| 5 | getStripe initializes the SDK with the Fetch HTTP client and explicit apiVersion (Workers-safe) | VERIFIED | `src/lib/stripe.ts:51,54` — `httpClient: Stripe.createFetchHttpClient()`, `apiVersion: '2026-05-27.dahlia'`. CR-01 fix applied: Map-keyed singleton (not bare singleton). 8/8 stripe-lib.test.ts checks pass. |
| 6 | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID are declared in CloudflareEnv type and documented in .env.local.example | VERIFIED | `cloudflare-env.d.ts:13-15` — all three typed as `string`. `.env.local.example` contains Stripe section with placeholder values (sk_test_..., whsec_..., price_...). Typecheck clean. |
| 7 | POST /api/stripe/checkout creates (or reuses) a Stripe customer, persists stripe_customer_id to D1, and returns a Checkout session URL | VERIFIED | `checkout/route.ts:97-144` — reuses existing stripe_customer_id or creates new, persists via parameterized UPDATE. mode: 'subscription' with env.STRIPE_PRICE_ID. WR-04 fix: logs orphaned customer. WR-05 fix: guards null session.url. All structural + behavioral tests pass. |
| 8 | POST /api/stripe/checkout returns 403 for admin and never creates a Stripe customer for admins | VERIFIED | `checkout/route.ts:67-72` — admin check at line 67, before `stripe.customers.create` at line 97. Structural test confirms adminIdx < createIdx. Behavioral test confirms 403 with 0 DB calls. |
| 9 | POST /api/stripe/portal returns a Customer Portal URL, or 404 when the agent has no stripe_customer_id | VERIFIED | `portal/route.ts:75-95` — 404 on `!agent?.stripe_customer_id`; `billingPortal.sessions.create` with `return_url: /dashboard/billing`. All structural + behavioral tests pass. |
| 10 | POST /api/stripe/webhook reads the raw body FIRST and verifies via constructEventAsync + SubtleCryptoProvider before any processing | VERIFIED | `webhook/route.ts:67` — literal first statement is `const body = await req.text()`. `constructEventAsync(..., stripeCryptoProvider)` at lines 88-94. Test confirms .text() appears before constructEventAsync in source. No req.json() in executable code. |
| 11 | Webhook maps 5 Stripe events to subscription_status transitions with grace_until = now + 7 days (epoch seconds) on payment_failed | VERIFIED | `stripe-events.ts` — all 5 events handled. payment_failed: `Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60`. CR-02 fix: period fields from `sub.items.data[0]`. WR-06 fix: invoice.paid excludes lapsed. All 5 behavioral tests pass including 604800s boundary check and ms-trap check (graceUntil < 2e12). |
| 12 | Re-sending the same event_id is a no-op (idempotency via stripe_events PRIMARY KEY) | VERIFIED | `stripe-events.ts:103-111` — pre-flight SELECT 1, early return if found. `INSERT OR IGNORE` in every batch. WR-01 fix: D1 batch atomicity documented as SQL transaction. Duplicate event test: 0 batch calls, noOp=true. |
| 13 | Webhook route is reachable without a session cookie (not gated by middleware matcher) | VERIFIED | `middleware.ts:82` — matcher is `['/dashboard/:path*', '/admin/:path*']`. Webhook route has no getTokens call. JSDoc documents the exemption. middleware.ts unchanged per plan. |
| 14 | /dashboard/billing RSC reads D1 subscription state and renders BillingWidget; sidebar Billing link is live | VERIFIED | `billing/page.tsx:76` — calls getAgentSubscriptionState(env.DB, uid). Declares `dynamic = 'force-dynamic'`, no `runtime = 'edge'`. `DashboardSidebar.tsx:247-274` — Billing is a `<Link href="/dashboard/billing">` with isBillingActive detection. "Coming soon" removed from Billing entry. All billing-widget.test.ts tests pass. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/stripe.ts` | Workers-safe Stripe client factory + stripeCryptoProvider | VERIFIED | 72 lines. Map-keyed singleton. createFetchHttpClient + pinned apiVersion. No runtime = 'edge'. |
| `src/lib/subscription.ts` | isAgentPublishable + AGENT_PUBLISHABLE_SQL + getAgentSubscriptionState | VERIFIED | 125 lines. All 5 exports. AGENT_PUBLISHABLE_SQL uses unixepoch(). |
| `src/lib/stripe-events.ts` | handleStripeEvent state machine (5 events, atomic D1 batch) | VERIFIED | 273 lines. All CR/WR fixes applied. |
| `src/app/api/stripe/checkout/route.ts` | Checkout session creation (admin-blocked, customer upsert) | VERIFIED | 153 lines. Admin 403 before Stripe call. WR-04 + WR-05 fixes. |
| `src/app/api/stripe/portal/route.ts` | Customer Portal session creation | VERIFIED | 104 lines. 404 for missing stripe_customer_id. |
| `src/app/api/stripe/webhook/route.ts` | Signature-verified, idempotent webhook receiver | VERIFIED | 119 lines. Raw body first. constructEventAsync + stripeCryptoProvider. 400/500/200 branches. |
| `src/components/dashboard/BillingWidget.tsx` | Client widget rendering 4 states + admin notice | VERIFIED | 294 lines. 'use client'. Named + default export. All 4 states + admin. CTAs wired to checkout/portal routes. |
| `src/app/(dashboard)/dashboard/billing/page.tsx` | RSC billing page reading D1 status | VERIFIED | 120 lines. force-dynamic. No runtime = 'edge'. Fail-closed (defaults to 'none' on D1 error). |
| `src/components/dashboard/DashboardSidebar.tsx` | Billing link activated | VERIFIED | Link href="/dashboard/billing" with isBillingActive detection. No "Coming soon" on Billing entry. |
| `src/tests/subscription.test.ts` | isAgentPublishable behavioral coverage | VERIFIED | 8 behavioral + 10 structural tests. All pass. |
| `src/tests/stripe-lib.test.ts` | Stripe client structural checks | VERIFIED | 8 structural checks. All pass. |
| `src/tests/billing.test.ts` | Route + state machine coverage | VERIFIED | All 5 event transitions, grace seconds check, duplicate no-op, route shape tests pass. |
| `src/tests/billing-widget.test.ts` | State-to-UI + sidebar coverage | VERIFIED | All 4 states + admin + CTA wiring + sidebar activation pass. |
| `db/migrations/0001_initial_schema.sql` | agents, subscriptions, stripe_events tables | VERIFIED | All required tables and columns present. stripe_events has event_id PRIMARY KEY. subscriptions has current_period_end. agents has subscription_status, subscription_grace_until, is_admin, stripe_customer_id UNIQUE. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `webhook/route.ts` | `stripe.ts` | `constructEventAsync(..., stripeCryptoProvider)` | VERIFIED | stripeCryptoProvider imported from @/lib/stripe at line 47; passed as 5th arg at line 93. |
| `stripe-events.ts` | D1 agents + stripe_events | `env.DB.batch([idempotencyStmt, UPDATE agents])` | VERIFIED | .batch( present in all 4 event handlers. INSERT OR IGNORE INTO stripe_events in every batch. |
| `checkout/route.ts` | Stripe Checkout | `stripe.checkout.sessions.create({ mode: 'subscription', price: STRIPE_PRICE_ID })` | VERIFIED | Line 122-131. mode: 'subscription', env.STRIPE_PRICE_ID in line_items, client_reference_id: uid. |
| `billing/page.tsx` | `subscription.ts` | `getAgentSubscriptionState(env.DB, uid)` | VERIFIED | Line 76. Imported from @/lib/subscription at line 25. |
| `BillingWidget.tsx` | `/api/stripe/checkout` and `/api/stripe/portal` | `fetch POST then redirect to returned url` | VERIFIED | handleSubscribe fetches /api/stripe/checkout (line 73); handleManage fetches /api/stripe/portal (line 102). Both redirect via window.location.href. WR-05 fix: URL validated before navigate. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `billing/page.tsx` | status, graceUntil, isAdmin | `getAgentSubscriptionState` → D1 SELECT subscription_status, subscription_grace_until, is_admin FROM agents WHERE id = ? (parameterized) | Yes | FLOWING |
| `billing/page.tsx` | renewalDate | D1 SELECT current_period_end FROM subscriptions WHERE agent_id = ? AND status IN ('active', 'trialing') (parameterized) | Yes | FLOWING |
| `BillingWidget.tsx` | all props | Props from billing/page.tsx — sourced from D1 reads above, not hardcoded empty | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 3 tests pass | npm test (788 total, 784 pass, 4 fail) | 4 failures are pre-existing in listing-detail-page.test.ts (Phase 4 scope, excluded per context) | PASS |
| Typecheck clean | npm run typecheck | No errors | PASS |
| 5-event state machine + idempotency | npm test (handleStripeEvent behavioral suite) | All 7 tests pass | PASS |
| Admin 403 before Stripe call | npm test (checkout structural + behavioral suites) | Admin block confirmed before customers.create; 0 DB calls for admin path | PASS |
| Webhook raw body first + async verify | npm test (webhook/route.ts structural suite) | All 9 structural checks pass including .text() before constructEventAsync order | PASS |
| Grace in epoch seconds not ms | npm test (invoice.payment_failed test) | graceUntil within 5s of now+604800; confirmed < 2e12 (not milliseconds) | PASS |

### Probe Execution

No probes defined for this phase. Step 7c SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| BILL-01 | 03-02, 03-03 | Agent can subscribe via Stripe Checkout ($79/mo) | CODE VERIFIED / LIVE DEFERRED | Checkout route: subscription mode, STRIPE_PRICE_ID, admin block. Widget Subscribe CTA wired. Live end-to-end deferred per authorized autonomous run directive. |
| BILL-02 | 03-02, 03-03 | Agent can self-manage via Stripe Customer Portal | CODE VERIFIED / LIVE DEFERRED | Portal route: billingPortal.sessions.create, 404 for no-customer. Widget Manage CTA wired. Stripe Portal must be configured in Dashboard before live test. |
| BILL-03 | 03-02 | Platform handles 5 Stripe webhook events | CODE VERIFIED / LIVE DEFERRED | All 5 events in stripe-events.ts. Raw body first, async verify, 500 on handler error. Live delivery deferred. |
| BILL-04 | 03-01, 03-03 | Subscription status + grace stored in D1, enforced in listing queries | VERIFIED | isAgentPublishable + AGENT_PUBLISHABLE_SQL implemented and tested. Application to listing queries is Phase 4 scope (by design). REQUIREMENTS.md marks as complete. |
| BILL-05 | 03-01, 03-02 | Webhook events are idempotent | VERIFIED | stripe_events table with event_id PRIMARY KEY + INSERT OR IGNORE. Duplicate event test passes. REQUIREMENTS.md marks as complete. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/stripe-events.ts` | 267-271 | default branch records idempotency for all unhandled event types, permanently suppressing future handling of those event IDs if a new event type is added later. Code comment acknowledges the trade-off. | INFO | Non-blocking. Design decision documented in code. |
| `src/app/api/stripe/webhook/route.ts` | 67, 78 | req.text() and getCloudflareContext are outside try/catch; a binding misconfiguration yields unhandled 500 | INFO | Low risk in normal operation. Not a Phase 3 goal blocker. |
| `src/app/api/stripe/checkout/route.ts` | 67 | Admin claim read as truthy check (tokens.decodedToken.admin) vs billing/page.tsx which uses === true. Diverges if claim is 1 vs true. | INFO | Checkout admin block is the actual security control. Billing page hides CTAs as defense-in-depth only. Not a blocker. |

No TBD, FIXME, or XXX debt markers found in Phase 3 modified files.

### Human Verification Required

#### 1. Live Stripe Checkout — BILL-01 End-to-End

**Test:** Start wrangler dev with Stripe secrets in .dev.vars. As a non-admin agent on /dashboard/billing, click Subscribe. Complete Stripe Checkout with test card 4242 4242 4242 4242. After redirect to /dashboard/billing?checkout=success, inspect D1: `SELECT subscription_status, stripe_customer_id FROM agents WHERE id = '<uid>'`.

**Expected:** subscription_status = 'active', stripe_customer_id populated.

**Why human:** Requires live Stripe test-mode credentials (STRIPE_SECRET_KEY, STRIPE_PRICE_ID), a configured $79/mo recurring Price, and wrangler dev running against D1. HMAC-signed Checkout round-trip cannot be simulated offline.

#### 2. Customer Portal — BILL-02 End-to-End

**Test:** After agent has subscription_status = 'active', click Manage billing on /dashboard/billing. Confirm Stripe Portal opens. Cancel subscription. Verify D1 shows subscription_status = 'lapsed' after webhook.

**Expected:** Portal opens; cancellation triggers customer.subscription.deleted webhook; lapsed state written to D1.

**Why human:** Requires Stripe Customer Portal to be configured and enabled in Stripe Dashboard (Billing -> Customer Portal). Without setup billingPortal.sessions.create returns 400. Cannot verify without live credentials (RESEARCH Pitfall 7).

#### 3. Webhook Delivery + Idempotency — BILL-03 + BILL-05

**Test:** Run `stripe trigger invoice.payment_failed` forwarded to localhost:8787/api/stripe/webhook. Verify D1: subscription_status = 'grace', subscription_grace_until close to now+604800. Re-send same event; verify no duplicate row in stripe_events.

**Expected:** Grace state written in epoch seconds (7 days out). Idempotency: second delivery produces no second stripe_events row.

**Why human:** Requires stripe listen --forward-to and STRIPE_WEBHOOK_SECRET to validate real HMAC. Epoch-seconds calculation is unit-tested; live D1 write must be confirmed.

#### 4. WR-06 Business-Rule Approval

**Test:** Trigger customer.subscription.deleted (sets 'lapsed'), then send invoice.paid for same customer. Confirm agent remains 'lapsed'.

**Expected:** invoice.paid after deletion does NOT flip status to 'active'. Reactivation requires a new customer.subscription.created.

**Why human:** This is a deliberate state-machine rule encoded in the WR-06 fix (AND subscription_status != 'lapsed'). Bernard should confirm this matches intended churn/reactivation business semantics before shipping to production.

#### 5. BillingWidget Visual Rendering

**Test:** In wrangler dev, set D1 subscription_status to 'none', 'active', 'grace', 'lapsed' and is_admin=1 for separate test accounts. Load /dashboard/billing for each.

**Expected:** none -> Subscribe CTA at $79/mo; active -> Active badge + renewal date + Manage billing; grace -> amber payment-failed warning with grace date + Manage billing; lapsed -> Subscription ended + Reactivate CTA; admin -> complimentary access notice, no Subscribe/Manage CTAs.

**Why human:** Client-side conditional JSX rendering, Tailwind styles, and date formatting (toLocaleDateString on epoch seconds) require visual confirmation in browser. Source-text assertions cannot substitute.

### Gaps Summary

No code-level gaps. All 14 must-haves are verified in the codebase. The phase goal is achievable; the remaining items are live Stripe end-to-end validation (deferred per the authorized autonomous run directive) and one business-rule confirmation (WR-06). Status is human_needed, not gaps_found.

---

_Verified: 2026-06-13T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
