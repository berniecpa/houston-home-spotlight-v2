# Phase 3: Subscription Billing - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas proposed in batch, user accepted all four recommendations

<domain>
## Phase Boundary

Agents can subscribe to the platform via Stripe Checkout ($79/month, single tier) and self-manage
their billing through the Stripe Customer Portal. The platform tracks subscription state on the D1
`agents` row (and `subscriptions` table) via signed Stripe webhooks, enforcing a 7-day grace period
on payment failure. A dashboard billing widget surfaces current status and renewal date.

In scope: Stripe Checkout session creation, Customer Portal session creation, the webhook handler
(signature-verified, idempotent), the subscription-status helper + grace logic, and the billing
dashboard page/widget. The subscription-aware listing SQL gate helper is DEFINED here but APPLIED to
public listing queries in Phase 4 (listings don't exist as D1 rows until then).

Out of scope: annual pricing, second tier, coupons/referral codes (all V2). Listing CRUD (Phase 4).
</domain>

<decisions>
## Implementation Decisions

### Checkout & Pricing
- No free trial — the agent is charged $79 immediately at Stripe Checkout; subscription becomes `active` on successful payment.
- Single recurring Price referenced via `STRIPE_PRICE_ID` env var/secret; the $79/mo Price is created once by Bernard in the Stripe Dashboard (no boot-time Stripe writes, no Product/Price provisioning in code).
- No setup fee (per BILL-01).
- Checkout success/cancel return URLs point back to the dashboard billing page.

### Admin (Bernard) Billing
- A Firebase `admin: true` claim means `subscription_status` is treated as `active` everywhere (gate helper short-circuits to active for admins). Bernard never sees the paywall.
- No Stripe customer or subscription is ever created for an admin account.

### Subscription State & Grace
- Status values on `agents.subscription_status`: `none` (default), `active`, `grace`, `lapsed`.
- `invoice.payment_failed` → status `grace`, `subscription_grace_until` = now + 7 days (epoch seconds).
- `invoice.paid` / `customer.subscription.updated` (active) → status `active`, clear `subscription_grace_until`.
- `customer.subscription.deleted` → status `lapsed`.
- Grace is enforced by a SQL WHERE-clause helper (no cron job) — an agent is "publishable" when `subscription_status='active'` OR (`status='grace'` AND `subscription_grace_until > now`). Admins always publishable.
- On lapse past grace: the agent's existing listings are HIDDEN from public browse via the SQL gate but RETAINED in D1; resubscribing restores visibility (matches LIST-06). The gate helper is built in this phase; Phase 4 applies it to public listing queries.

### Webhooks & Idempotency
- Signature verification via Stripe `constructEventAsync` + `createSubtleCryptoProvider` (Workers-safe; sync `constructEvent` fails on Workers — locked in PROJECT.md).
- Handle: `customer.subscription.created`, `customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
- Idempotency via the existing `stripe_events` table (event_id PRIMARY KEY) — INSERT OR IGNORE / pre-check before processing; a re-sent event_id is a no-op.
- Agent ↔ Stripe mapping via `agents.stripe_customer_id` (set when the Checkout session / customer is created); webhook resolves the agent by customer id.

### Claude's Discretion
- Exact dashboard widget layout and copy (follow 03-UI-SPEC if generated; otherwise mirror the existing dashboard card styling from Phase 2).
- Internal module structure of the Stripe client wrapper and helper naming.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- D1 schema (db/migrations/0001_initial_schema.sql) ALREADY contains every column/table this phase needs — NO migration required:
  - `agents`: `stripe_customer_id` (UNIQUE), `subscription_status` (default 'none'), `subscription_grace_until` (INTEGER epoch), `is_admin`
  - `subscriptions` table: `stripe_subscription_id` (UNIQUE), `status`, `current_period_start/end`
  - `stripe_events` table: `event_id` PRIMARY KEY, `processed_at` — the idempotency log
  - index `idx_agents_stripe_customer`
- `src/app/api/agent/profile/route.ts` — template for an edge-runtime API route reading the verified session (getTokens) and hitting D1 with parameterized binds.
- `src/lib/auth-edge.ts` (`authEdgeConfig`) + session cookie — reuse to identify the authenticated agent in Checkout/Portal route handlers.
- `src/app/(dashboard)/dashboard/billing/page.tsx` — existing "coming soon" placeholder to replace with the real billing widget.
- Dashboard card / sidebar styling patterns from `src/components/dashboard/*` (Phase 2).

### Established Patterns
- Edge API routes: `export const runtime = 'edge'`, uid from verified session only (never request body), parameterized D1 `.bind()`, try/catch with typed NextResponse.json status codes.
- Cloudflare context / D1 binding accessed via the established getCloudflareContext pattern used in the profile + session routes.
- Secrets via `.dev.vars` (local) / wrangler secrets (prod); public-safe config via wrangler.toml [vars].

### Integration Points
- New routes: Stripe Checkout session create, Customer Portal session create, and `POST /api/stripe/webhook` (webhook must be EXEMPT from auth middleware — add its path to the public matcher exclusion).
- Dashboard billing page replaces the placeholder; "Manage billing" / "Subscribe" CTA wired to the new routes.
- Subscription-status helper (e.g. src/lib/subscription.ts) consumed by the dashboard widget now and by Phase 4 listing queries later.
- Stripe secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, NEXT_PUBLIC_STRIPE_* as needed — document in .env.local.example.
</code_context>

<specifics>
## Specific Ideas

- Webhook handler must be reachable without a session cookie (Stripe calls it server-to-server) — ensure the middleware matcher does not gate `/api/stripe/webhook`.
- Live Stripe validation (real Checkout, real webhook delivery, Customer Portal) is DEFERRED per the autonomous-run directive — build production code + automated tests; record live steps as human verification.
</specifics>

<deferred>
## Deferred Ideas

- Annual subscription pricing (V2-01), second tier with AI video included (V2-02), Stripe coupon/referral codes (V2-07) — all explicitly V2 in REQUIREMENTS.md.
</deferred>
