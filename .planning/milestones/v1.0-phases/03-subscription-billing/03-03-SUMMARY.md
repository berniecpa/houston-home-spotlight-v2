---
phase: 03-subscription-billing
plan: "03"
subsystem: billing-ui
tags: [stripe, subscription, dashboard, widget, react, d1, billing-page]
dependency_graph:
  requires:
    - src/lib/subscription.ts (getAgentSubscriptionState, SubscriptionStatus — from 03-01)
    - src/app/api/stripe/checkout/route.ts (POST — from 03-02)
    - src/app/api/stripe/portal/route.ts (POST — from 03-02)
  provides:
    - src/components/dashboard/BillingWidget.tsx (client widget — 4 states + admin notice)
    - src/app/(dashboard)/dashboard/billing/page.tsx (RSC page — reads D1, renders widget)
    - src/tests/billing-widget.test.ts (structural test coverage for BILL-04)
  affects:
    - src/components/dashboard/DashboardSidebar.tsx (Billing link activated)
    - 04-xx (billing page is the canonical D1 subscription-state surface; Phase 4 listing gate reuses getAgentSubscriptionState)
tech_stack:
  added: []
  patterns:
    - "'use client' widget receiving only safe props (status/grace/renewal/isAdmin — never stripe_customer_id)"
    - "force-dynamic RSC page with D1 read + fail-closed fallback to 'none' state"
    - "window.location.href redirect after fetch POST (no router.push — external Stripe URL)"
    - "Inline error banner on fetch failure (mirrors InquiryForm.tsx pattern — no throw)"
    - "Active sidebar link with usePathname() active-state detection (mirrors Profile link)"
key_files:
  created:
    - src/components/dashboard/BillingWidget.tsx
    - src/tests/billing-widget.test.ts
  modified:
    - src/app/(dashboard)/dashboard/billing/page.tsx (placeholder replaced)
    - src/components/dashboard/DashboardSidebar.tsx (Billing span converted to Link)
decisions:
  - "BillingWidget receives only status/grace/renewal/isAdmin — stripe_customer_id never sent to client (T-03-BW-I)"
  - "billing/page.tsx declares force-dynamic; explicitly omits runtime=edge (RESEARCH Pitfall 4)"
  - "D1 error in billing page fails toward 'none' state (fail-closed) — never falsely grants isAdmin=true from D1"
  - "Admin flag is OR of Firebase token claim and D1 is_admin=1 — token claim is authoritative, D1 is defense-in-depth"
  - "Renewal date SELECT queries subscriptions table for status IN active/trialing — covers both live Stripe subscription states"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 03 Plan 03: Billing Widget and Dashboard Page Summary

**One-liner:** 'use client' BillingWidget rendering 4 subscription states + admin notice wired to Stripe routes, force-dynamic RSC billing page reading D1, and activated sidebar Billing link.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 (RED) | billing-widget.test.ts — failing structural tests | 61966e6 | Complete |
| 1 (GREEN) | BillingWidget.tsx — 5 branches + CTA handlers | fc8e95e | Complete |
| 2 | billing/page.tsx RSC + DashboardSidebar Billing link | fc8e95e | Complete |

## What Was Built

### src/components/dashboard/BillingWidget.tsx

'use client' component rendering the correct subscription UI for each state:

- **Props:** `{ status: SubscriptionStatus; graceUntil: number | null; isAdmin: boolean; renewalDate: number | null }`
- **'none':** "Start publishing listings" card, $79/mo copy, Subscribe CTA (handleSubscribe)
- **'active':** Active badge (green), renewal date formatted from epoch seconds, "Manage billing" CTA (handleManage)
- **'grace':** Amber warning banner ("Payment failed — update your card"), grace deadline date, "Manage billing" CTA
- **'lapsed':** "Subscription ended" card, $79/mo copy, "Reactivate" CTA (handleSubscribe)
- **admin:** "Platform owner — complimentary access" notice, no paywall CTAs (T-03-BW-AB defense-in-depth)
- **handleSubscribe:** fetch('/api/stripe/checkout', { method: 'POST' }) then parse { url } and set window.location.href
- **handleManage:** fetch('/api/stripe/portal', { method: 'POST' }) then parse { url } and set window.location.href
- **Error handling:** Inline role="alert" banner on catch (mirrors InquiryForm.tsx — no throw)
- **Loading state:** isLoading disables buttons and shows "Please wait..." text
- Named export BillingWidget + default export (CLAUDE.md convention)
- 288 lines (under 500 CLAUDE.md limit)

### src/app/(dashboard)/dashboard/billing/page.tsx

Real RSC replacing the Phase 2 "coming soon" placeholder:

- `export const dynamic = 'force-dynamic'` — per-request D1 read on the Worker
- No `export const runtime = 'edge'` — explicitly omitted (RESEARCH Pitfall 4)
- Reads session uid via getTokens(cookieStore, authEdgeConfig) — same pattern as layout
- Calls getAgentSubscriptionState(env.DB, uid) for status, subscription_grace_until, is_admin
- Reads current_period_end from subscriptions WHERE status IN ('active', 'trialing') for renewal date
- Fail-closed: D1 error yields status='none'; isAdmin falls back to Firebase token claim only
- Admin flag = Firebase decodedToken.admin OR D1 is_admin===1 (token is authoritative)
- Renders BillingWidget with all four props
- 119 lines (under 500 CLAUDE.md limit)

### src/components/dashboard/DashboardSidebar.tsx

Billing nav entry activated:

- Added isBillingActive = pathname?.startsWith('/dashboard/billing') (mirrors isProfileActive)
- Replaced disabled Billing span with Link href="/dashboard/billing" styled identically to Profile link
- aria-current="page" set when isBillingActive
- Module JSDoc updated to reflect active link status

### src/tests/billing-widget.test.ts

Structural test suite (41 tests, all passing):

- BillingWidget component structure: file exists, 'use client', named+default export, @/lib/subscription import, under 500 lines
- State branches: 'none' (subscribe + $79/mo), 'active' (badge + renewal + manage), 'grace' (warning + graceUntil + manage), 'lapsed' (ended copy + handleSubscribe)
- Admin branch: isAdmin prop, owner/complimentary copy
- CTA wiring: /api/stripe/checkout, /api/stripe/portal, handleSubscribe, handleManage, window.location.href, error catch
- Billing page RSC: getAgentSubscriptionState import, force-dynamic, no edge runtime, BillingWidget render, under 500 lines
- DashboardSidebar: /dashboard/billing Link, no "Coming soon" adjacent to Billing, active state detection

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| billing-widget.test.ts (new) | 41 | 41 | 0 |
| All other tests (pre-existing) | 747 | 743 | 4 |
| **Total** | **788** | **784** | **4** |

Pre-existing failures (4): `src/tests/listing-detail-page.test.ts` — brittle async-params assertions; out of scope (STATE.md Phase 4 blocker). No new failures introduced.

`npm run typecheck` — clean.

`npm run lint` — one pre-existing unrelated error in `src/components/dashboard/WelcomeCard.tsx` (`pct` variable assigned but never used, from Phase 2 commit 782793f). All new files lint-clean (verified with npx eslint on each file individually).

## Verification Checks

- billing/page.tsx contains `force-dynamic` on non-comment line 34: confirmed
- billing/page.tsx does NOT contain `runtime = 'edge'` on non-comment lines: confirmed
- DashboardSidebar.tsx contains `href="/dashboard/billing"` at line 248: confirmed
- "Coming soon" does not appear adjacent to Billing in sidebar source: confirmed
- BillingWidget.tsx has 'use client' directive: confirmed
- BillingWidget.tsx has handleSubscribe + handleManage + window.location.href: confirmed
- BillingWidget.tsx imports from @/lib/subscription: confirmed
- BillingWidget.tsx has named and default export: confirmed
- No new test failures vs. pre-plan baseline (4 pre-existing remain): confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all state branches are fully implemented and wired to live API routes. The widget renders correctly once Stripe credentials are configured in .dev.vars (per 03-01/03-02 deferred human validation items).

## Deferred Human Validation

The following items require live Stripe configuration before the billing widget can be exercised in a browser:

| Step | What to Do |
|------|-----------|
| 1 | Ensure Stripe credentials are in .dev.vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID) |
| 2 | Start local dev: wrangler dev |
| 3 | As non-admin agent (status='none'), visit /dashboard/billing — expect Subscribe card with $79/mo |
| 4 | Click Subscribe — expect Stripe Checkout page (BILL-01 entry point) |
| 5 | After test payment, visit /dashboard/billing — expect Active badge + renewal date (BILL-04) |
| 6 | Click Manage billing — expect Stripe Portal (BILL-02 entry point) |
| 7 | stripe trigger invoice.payment_failed — expect grace warning with deadline at /dashboard/billing |
| 8 | Cancel subscription — expect lapsed state with Reactivate CTA |
| 9 | As admin (Bernard), visit /dashboard/billing — expect complimentary notice, no Subscribe/Manage CTAs |

All visual state verification is deferred per the autonomous-run directive. Automated code + tests are complete.

## Threat Surface Scan

All threat model items from the plan have mitigations implemented:

| Threat ID | Status | Implementation |
|-----------|--------|---------------|
| T-03-BW-I | Mitigated | Widget props: status/grace/renewal/isAdmin only — stripe_customer_id never sent to client bundle |
| T-03-BP-E | Mitigated | billing/page.tsx reads status strictly for session uid via parameterized prepare().bind(); layout gate enforces auth |
| T-03-BW-AB | Accept | Admin notice is cosmetic defense-in-depth; checkout route enforces 403 for admin server-side (03-02) |

No new threat surface introduced beyond the plan's threat model.

## Self-Check: PASSED

Files created exist on disk: BillingWidget.tsx, billing-widget.test.ts — confirmed.
Files modified on disk: billing/page.tsx, DashboardSidebar.tsx — confirmed.

Commits exist:
- 61966e6 (RED — failing tests): confirmed
- fc8e95e (GREEN — implementation): confirmed

Test results: 788 pass 784, fail 4 (all pre-existing listing-detail-page.test.ts)
Typecheck: clean
