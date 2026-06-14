# Phase 3: Subscription Billing - Research

**Researched:** 2026-06-13
**Domain:** Stripe SDK on Cloudflare Workers (workerd) + Next.js App Router route handlers
**Confidence:** MEDIUM-HIGH (core patterns CITED from official sources; apiVersion VERIFIED)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- No free trial — $79 charged immediately at checkout; `active` on successful payment.
- Single Price via `STRIPE_PRICE_ID` env var. Price created once in Stripe Dashboard — no boot-time Stripe writes.
- No setup fee (BILL-01).
- Bernard (`admin: true` claim) bypasses subscription gate entirely — no Stripe customer created for him.
- Status values: `none` | `active` | `grace` | `lapsed`.
- `invoice.payment_failed` → `grace`, `subscription_grace_until` = now + 7 days.
- `invoice.paid` / `customer.subscription.updated` (active) → `active`, clear grace.
- `customer.subscription.deleted` → `lapsed`.
- Grace enforced by SQL WHERE clause helper (no cron). Gate helper built in Phase 3; applied in Phase 4.
- Idempotency via `stripe_events` table (event_id PRIMARY KEY) — INSERT OR IGNORE approach.
- Webhook events: `customer.subscription.created`, `customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
- Agent to Stripe mapping via `agents.stripe_customer_id`. Set on Checkout session creation.
- Webhook MUST be exempt from auth middleware (Stripe calls server-to-server, no cookie).
- `constructEventAsync` + `createSubtleCryptoProvider` (locked in STATE.md — sync `constructEvent` fails on Workers).
- Checkout success/cancel URLs point back to the dashboard billing page.
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` via wrangler secrets.
- D1 schema ALREADY complete — no migration required.

### Claude's Discretion

- Exact dashboard widget layout and copy (mirror existing dashboard card styling from Phase 2).
- Internal module structure of the Stripe client wrapper and helper naming.

### Deferred Ideas (OUT OF SCOPE)

- Annual pricing (V2-01), second tier with AI video (V2-02), Stripe coupon/referral codes (V2-07).
</user_constraints>

---

## Summary

Phase 3 delivers the full Stripe billing layer on top of the Workers + D1 + Firebase Auth foundation. There are three non-obvious technical constraints that dominate all implementation decisions:

**1. No `export const runtime = 'edge'` in this phase.** `@opennextjs/cloudflare` v1.x does not support Next.js edge runtime. [CITED: opennext.js.org/cloudflare] Every Phase 2 file that has `export const runtime = 'edge'` works only because the adapter silently treats all routes as Workers runtime regardless — but the declaration is incorrect and must not be copied into Phase 3 code. Phase 3 route handlers must omit the runtime export entirely (defaults to Workers/nodejs-compat via the adapter).

**2. `Stripe.createFetchHttpClient()` is mandatory.** The Stripe SDK defaults to Node.js `node:https`. Even with `nodejs_compat`, the Workers runtime does not provide `node:https`. [CITED: opennext.js.org/cloudflare/howtos/stripeAPI] Without the fetch HTTP client the SDK throws at import or first API call.

**3. `constructEventAsync` + `SubtleCryptoProvider` is mandatory for webhook verification.** The synchronous `constructEvent` uses Node.js `crypto.timingSafeEqual` which is unavailable in Workers. [CITED: jross.me/verifying-stripe-webhook-signatures-cloudflare-workers] The body must be read as raw text via `await req.text()` — never `await req.json()` — before verification. Consuming the stream via `req.json()` first silently corrupts HMAC verification.

**Primary recommendation:** Initialize Stripe once in `src/lib/stripe.ts` with `createFetchHttpClient()`. Webhook handler reads raw body with `await req.text()`, verifies with `constructEventAsync`. Checkout/Portal handlers follow the established `getCloudflareContext({ async: true })` + `getTokens()` pattern from Phase 2 API routes. Middleware matcher requires no change — `/api/stripe/webhook` is already excluded.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stripe Checkout session creation | API / Backend (Workers) | Database (D1) | Server-side only — Stripe secret key never exposed to browser; writes `stripe_customer_id` to D1 |
| Customer Portal session creation | API / Backend (Workers) | Database (D1) | Reads `stripe_customer_id` from D1; server-to-server Stripe API call |
| Webhook signature verification | API / Backend (Workers) | — | Stripe calls the server directly; no session cookie; SubtleCryptoProvider required |
| Subscription state update | API / Backend (Workers) | Database (D1) | Webhook handler writes `subscription_status` + `subscription_grace_until` to D1 |
| Billing widget (status display) | Frontend Server (RSC) | Database (D1) | RSC reads D1 `agents` row — no client-side Stripe SDK needed |
| Subscribe / Manage billing CTA | Browser / Client | API (Workers) | Client POSTs to create session, receives redirect URL; no Stripe.js required |
| Subscription gate helper | API / Backend | Database (D1) | Pure function on D1 row — consumed by RSC (dashboard) and listing queries (Phase 4) |
| Admin bypass | API / Backend | — | Short-circuits gate via `decodedToken.admin` claim from Firebase token |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 22.2.1 | Stripe API client, webhook verification | Official Stripe Node.js SDK; v11.10+ requires no `node_compat` flag for Cloudflare Workers [CITED: jross.me]; FetchHttpClient added in v10+ |

**No additional packages required.** Checkout and Customer Portal are server-side redirects — no Stripe.js frontend SDK needed for this redirect-only flow.

**Version verification:** [VERIFIED: npm registry]
- `stripe@22.2.1` — published 2026-06-12 (latest), 13,534,897 weekly downloads, github.com/stripe/stripe-node

**Current Stripe API version pinned by SDK v22.2.1:** `2026-05-27.dahlia`
[VERIFIED: stripe-node CHANGELOG — v22.2.0 entry: "This release changes the pinned API version to 2026-05-27.dahlia"]

**Installation:**
```bash
npm install stripe
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `stripe` | npm | 12+ yrs | 13,534,897/wk | github.com/stripe/stripe-node | SUS (too-new flag) | Approved — false positive; official Stripe SDK |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `stripe` flagged only because v22.2.1 was published 2026-06-12 (within recency window). This is the official Stripe Node.js SDK from the canonical stripe org. No human-verify checkpoint required.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client -- dashboard billing page)
  |
  |-- POST /api/stripe/checkout  --[agent session cookie]--> Workers route
  |       |
  |       |-- getTokens() -> uid + admin check (403 if admin)
  |       |-- D1: SELECT stripe_customer_id FROM agents WHERE id = uid
  |       |-- stripe.customers.create() if no customer yet; write to D1
  |       |-- stripe.checkout.sessions.create({ customer, price, mode:'subscription', ... })
  |       `-- return { url: session.url }  --> browser redirects to Stripe Checkout
  |
  |-- POST /api/stripe/portal  --[agent session cookie]--> Workers route
  |       |
  |       |-- getTokens() -> uid
  |       |-- D1: SELECT stripe_customer_id FROM agents WHERE id = uid
  |       |-- stripe.billingPortal.sessions.create({ customer, return_url })
  |       `-- return { url: session.url }  --> browser redirects to Stripe Portal
  |
  `-- GET /dashboard/billing  --[session cookie]--> RSC (Workers)
          |
          |-- getTokens() + D1: SELECT subscription_status, subscription_grace_until FROM agents WHERE id = uid
          `-- render BillingWidget (status badge, renewal date, CTA button)

Stripe (external)
  |
  `-- POST /api/stripe/webhook  (NO cookie -- server-to-server, exempt from auth middleware)
          |
          |-- const body = await req.text()     <- RAW body, FIRST line
          |-- stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider)
          |-- D1 batch([
          |     INSERT OR IGNORE INTO stripe_events (event_id) ...,
          |     UPDATE agents SET subscription_status = ... WHERE stripe_customer_id = ?
          |   ])
          |   -> if idempotency INSERT changes === 0: duplicate event, return 200 immediately
          `-- return NextResponse.json({ received: true }, { status: 200 })
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── stripe.ts            # getStripe() singleton + stripeCryptoProvider
│   └── subscription.ts      # isAgentPublishable() helper + AGENT_PUBLISHABLE_SQL constant
├── app/
│   └── api/
│       └── stripe/
│           ├── checkout/
│           │   └── route.ts  # POST: create Checkout session
│           ├── portal/
│           │   └── route.ts  # POST: create Portal session
│           └── webhook/
│               └── route.ts  # POST: receive + verify Stripe webhook
└── (dashboard)/
    └── dashboard/
        └── billing/
            └── page.tsx      # Replace Phase 2 placeholder; RSC reads D1 status
```

---

## Code Patterns

### Pattern 1: Stripe Client Initialization

`src/lib/stripe.ts` — mandatory for Workers runtime compatibility.

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

/**
 * Stripe client factory for Cloudflare Workers runtime.
 *
 * REQUIRED: httpClient: Stripe.createFetchHttpClient()
 *   Workers does not provide node:https even with nodejs_compat.
 *   The Fetch HTTP client uses globalThis.fetch() instead.
 *   [CITED: opennext.js.org/cloudflare/howtos/stripeAPI]
 *
 * REQUIRED: explicit apiVersion
 *   Pin to the SDK's bundled version to avoid type/Dashboard mismatches.
 *   stripe@22.2.1 pins to '2026-05-27.dahlia'.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support edge runtime.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/stripe
 */

let _stripe: Stripe | null = null;

/** Returns a Stripe instance initialized for Workers runtime. */
export function getStripe(secretKey: string): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2026-05-27.dahlia',
    });
  }
  return _stripe;
}

/**
 * Reusable SubtleCryptoProvider for webhook verification.
 * Uses Web Crypto API (crypto.subtle) -- available in Workers runtime.
 * [CITED: jross.me/verifying-stripe-webhook-signatures-cloudflare-workers]
 */
export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
```

### Pattern 2: Webhook Handler (the #1 Footgun)

Rules enforced by this pattern:
1. `await req.text()` is the FIRST line of the handler — body read before anything else.
2. `constructEventAsync` with `stripeCryptoProvider` — sync version throws in Workers.
3. No `export const runtime = 'edge'`.
4. Idempotency via D1 batch (atomically inserts idempotency record AND updates state).
5. Webhook route is already excluded from the middleware matcher — no change needed.

```typescript
// src/app/api/stripe/webhook/route.ts
//
// POST /api/stripe/webhook
// Called server-to-server by Stripe -- no __session cookie.
// The middleware matcher covers only /dashboard/:path* and /admin/:path*,
// so this route is intentionally public. Do NOT add it to the matcher.
//
// DO NOT add: export const runtime = 'edge';
// @opennextjs/cloudflare v1.x does not support the edge runtime declaration.

import { NextRequest, NextResponse } from 'next/server';
import type { Stripe as StripeType } from 'stripe';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getStripe, stripeCryptoProvider } from '@/lib/stripe';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- 1. Read raw body FIRST ---
  // MUST be the first body access. stripe.webhooks.constructEventAsync verifies
  // the HMAC over the exact bytes Stripe sent. If req.json() is called first,
  // the ReadableStream is consumed and constructEventAsync receives empty bytes.
  // [CITED: jross.me/verifying-stripe-webhook-signatures-cloudflare-workers]
  const body = await req.text();

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });

  // --- 2. Verify signature (async -- Workers-safe) ---
  // constructEventAsync uses Web Crypto API (crypto.subtle.verify) via the
  // SubtleCryptoProvider. The synchronous constructEvent uses
  // node:crypto.timingSafeEqual which is unavailable in Workers runtime.
  // 4th arg = undefined uses the default 300-second timestamp tolerance.
  let event: StripeType.Event;
  try {
    const stripe = getStripe(env.STRIPE_SECRET_KEY as string);
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET as string,
      undefined,           // tolerance: default 300 seconds
      stripeCryptoProvider // REQUIRED: SubtleCryptoProvider for Workers
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // --- 3. Route to state machine ---
  try {
    await handleStripeEvent(event, env.DB);
  } catch (err) {
    console.error(`Webhook handler error for ${event.type} (${event.id}):`, err);
    // Return 500 so Stripe retries. The idempotency batch is atomic -- if the
    // handler throws before the batch commits, the event_id is NOT recorded
    // and Stripe will retry successfully.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

### Pattern 3: Event State Machine

The idempotency INSERT and the state-update are submitted as a D1 batch so they
commit atomically. If the batch throws, the event_id is NOT stored and Stripe
will retry. [ASSUMED: D1 batch is atomic — verify against Cloudflare docs before shipping]

```typescript
// src/app/api/stripe/webhook/route.ts (continued)
import type { D1Database } from '@cloudflare/workers-types';

async function handleStripeEvent(
  event: StripeType.Event,
  db: D1Database
): Promise<void> {
  // Idempotency check: INSERT OR IGNORE into stripe_events (event_id PRIMARY KEY).
  // If changes === 0, this event_id was already processed; return early.
  const idempotencyStmt = db.prepare(
    `INSERT OR IGNORE INTO stripe_events (event_id, processed_at) VALUES (?, unixepoch())`
  ).bind(event.id);

  // Pre-flight idempotency check (non-atomic read before batch write):
  const existing = await db.prepare(
    `SELECT 1 FROM stripe_events WHERE event_id = ?`
  ).bind(event.id).first();
  if (existing) {
    return; // Already processed -- no-op
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as StripeType.Subscription;
      const customerId = sub.customer as string;
      const status = sub.status === 'active' ? 'active' : 'lapsed';
      // current_period_end is epoch seconds on Subscription objects
      // [ASSUMED: field name stable in API version 2026-05-27.dahlia]
      const periodEnd = (sub as Record<string, unknown>).current_period_end as number ?? 0;
      const periodStart = (sub as Record<string, unknown>).current_period_start as number ?? 0;

      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = ?,
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(status, customerId),
        db.prepare(
          `INSERT INTO subscriptions
             (id, agent_id, stripe_subscription_id, status,
              current_period_start, current_period_end, created_at, updated_at)
           SELECT ?, agents.id, ?, ?, ?, ?, unixepoch(), unixepoch()
           FROM agents WHERE stripe_customer_id = ?
           ON CONFLICT(stripe_subscription_id) DO UPDATE SET
             status = excluded.status,
             current_period_end = excluded.current_period_end,
             updated_at = unixepoch()`
        ).bind(sub.id, sub.id, sub.status, periodStart, periodEnd, customerId),
      ]);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as StripeType.Invoice;
      const customerId = invoice.customer as string;
      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'active',
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(customerId),
      ]);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as StripeType.Invoice;
      const customerId = invoice.customer as string;
      // grace_until = now + 7 days in epoch seconds (unixepoch is seconds, not ms)
      const graceUntil = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'grace',
               subscription_grace_until = ?,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(graceUntil, customerId),
      ]);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as StripeType.Subscription;
      const customerId = sub.customer as string;
      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'lapsed',
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(customerId),
        db.prepare(
          `UPDATE subscriptions SET status = 'canceled', updated_at = unixepoch()
           WHERE stripe_subscription_id = ?`
        ).bind(sub.id),
      ]);
      break;
    }

    default:
      // Unhandled event type -- record idempotency only, no state change
      await idempotencyStmt.run();
      break;
  }
}
```

### Pattern 4: Checkout Session Creation

```typescript
// src/app/api/stripe/checkout/route.ts
// DO NOT add: export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);
    if (!tokens) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Admin bypass -- Bernard never subscribes (no Stripe customer created)
    if (tokens.decodedToken.admin) {
      return NextResponse.json(
        { success: false, message: 'Admins do not require a subscription' },
        { status: 403 }
      );
    }

    const uid = tokens.decodedToken.uid;
    const { env } = await getCloudflareContext({ async: true });
    const stripe = getStripe(env.STRIPE_SECRET_KEY as string);

    const agent = await env.DB.prepare(
      'SELECT stripe_customer_id, email FROM agents WHERE id = ?'
    ).bind(uid).first<{ stripe_customer_id: string | null; email: string }>();

    if (!agent) {
      return NextResponse.json({ success: false, message: 'Agent record not found' }, { status: 404 });
    }

    // Create Stripe customer if not yet mapped; write back to D1
    let customerId = agent.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: agent.email,
        metadata: { agent_uid: uid },
      });
      customerId = customer.id;
      await env.DB.prepare(
        'UPDATE agents SET stripe_customer_id = ?, updated_at = unixepoch() WHERE id = ?'
      ).bind(customerId, uid).run();
    }

    const baseUrl = new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: env.STRIPE_PRICE_ID as string, quantity: 1 }],
      // client_reference_id: belt-and-suspenders fallback for webhook mapping
      // Primary mapping is via stripe_customer_id on the agents row
      client_reference_id: uid,
      success_url: `${baseUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${baseUrl}/dashboard/billing?checkout=cancel`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    console.error('POST /api/stripe/checkout error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

### Pattern 5: Customer Portal Session

```typescript
// src/app/api/stripe/portal/route.ts
// DO NOT add: export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);
    if (!tokens) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const uid = tokens.decodedToken.uid;
    const { env } = await getCloudflareContext({ async: true });

    const agent = await env.DB.prepare(
      'SELECT stripe_customer_id FROM agents WHERE id = ?'
    ).bind(uid).first<{ stripe_customer_id: string | null }>();

    if (!agent?.stripe_customer_id) {
      return NextResponse.json(
        { success: false, message: 'No billing account found. Please subscribe first.' },
        { status: 404 }
      );
    }

    const stripe = getStripe(env.STRIPE_SECRET_KEY as string);
    const baseUrl = new URL(req.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: agent.stripe_customer_id,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return NextResponse.json({ success: true, url: portalSession.url });
  } catch (err) {
    console.error('POST /api/stripe/portal error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to open billing portal' },
      { status: 500 }
    );
  }
}
```

### Pattern 6: Subscription Status Helper

```typescript
// src/lib/subscription.ts
import type { D1Database } from '@cloudflare/workers-types';

/** Valid subscription_status values from D1 agents table */
export type SubscriptionStatus = 'none' | 'active' | 'grace' | 'lapsed';

export interface AgentSubscriptionState {
  subscription_status: SubscriptionStatus;
  subscription_grace_until: number | null; // epoch seconds
  is_admin: number; // 0 or 1
}

/**
 * Returns true if the agent is allowed to publish listings.
 *
 * Admin (is_admin=1): always publishable.
 * active: publishable.
 * grace: publishable until subscription_grace_until epoch passes.
 * none / lapsed: not publishable.
 *
 * Phase 4 uses this in listing query WHERE clauses via AGENT_PUBLISHABLE_SQL.
 * [ASSUMED: Logic correct per CONTEXT.md decisions]
 */
export function isAgentPublishable(agent: AgentSubscriptionState): boolean {
  if (agent.is_admin === 1) return true;
  if (agent.subscription_status === 'active') return true;
  if (
    agent.subscription_status === 'grace' &&
    agent.subscription_grace_until !== null &&
    Math.floor(Date.now() / 1000) < agent.subscription_grace_until
  ) {
    return true;
  }
  return false;
}

/**
 * SQL WHERE fragment for Phase 4 public listing queries.
 * Embed in any SELECT that joins agents (aliased as 'a').
 *
 * Example:
 *   SELECT l.* FROM listings l
 *   JOIN agents a ON l.agent_id = a.id
 *   WHERE l.status = 'active'
 *     AND (${AGENT_PUBLISHABLE_SQL})
 */
export const AGENT_PUBLISHABLE_SQL = `(
  a.is_admin = 1
  OR a.subscription_status = 'active'
  OR (a.subscription_status = 'grace' AND a.subscription_grace_until > unixepoch())
)`;

/** Fetches subscription state for a single agent from D1. */
export async function getAgentSubscriptionState(
  db: D1Database,
  uid: string
): Promise<AgentSubscriptionState | null> {
  return db.prepare(
    `SELECT subscription_status, subscription_grace_until, is_admin
     FROM agents WHERE id = ?`
  )
    .bind(uid)
    .first<AgentSubscriptionState>();
}
```

### Pattern 7: Middleware Matcher — No Change Required

The current matcher in `middleware.ts`:
```typescript
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

`/api/stripe/webhook` is already excluded — the matcher covers only `/dashboard/*` and `/admin/*`. No change to `middleware.ts` is required. Document this explicitly in the webhook route file with a JSDoc comment so future developers do not accidentally add `/api/*` to the matcher.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook HMAC verification | Custom `crypto.subtle.verify` loop | `stripe.webhooks.constructEventAsync` | Handles timestamp tolerance, multi-sig header format, v0/v1 schemes; custom implementations miss edge cases |
| Subscription state machine | Custom event parsing | 5-event switch (Pattern 3) with SDK types | Stripe event shapes are versioned; SDK TypeScript types catch field renames |
| Idempotency table | Redis or in-memory set | D1 `stripe_events` (event_id PK + INSERT OR IGNORE) | Already in schema; D1 serialized writes make INSERT OR IGNORE atomic |
| Customer Portal UI | Custom subscription management screens | `stripe.billingPortal.sessions.create` + redirect | Update card, cancel, view invoices all handled by Stripe-hosted portal; no PCI surface |
| Checkout UI | Stripe Elements or custom payment form | `stripe.checkout.sessions.create` + redirect | PCI compliance delegated to Stripe; no card data touches the server |

**Key insight:** The entire billing surface — payment collection, subscription management, invoice history — is delegated to Stripe-hosted pages via server-side session creation. The only custom code is: (1) session routing, (2) webhook state machine, (3) D1 status reads.

---

## Stripe Webhook Events Reference Table

| Stripe Event | `subscription_status` | `subscription_grace_until` | `subscriptions` table | Notes |
|---|---|---|---|---|
| `customer.subscription.created` | `active` | NULL | INSERT new row | First subscription; map `sub.status === 'active'` |
| `customer.subscription.updated` | `active` or `lapsed` | NULL | UPDATE row | Status from `sub.status`; `lapsed` for any non-active value |
| `invoice.paid` | `active` | NULL | — (no update needed) | Renewal confirmed; clears grace if in grace |
| `invoice.payment_failed` | `grace` | `now + 604800` (7 days) | — | Begin 7-day grace window |
| `customer.subscription.deleted` | `lapsed` | NULL | UPDATE status='canceled' | Subscription canceled/expired |

**Field locations in stripe@22 / API `2026-05-27.dahlia` [ASSUMED — verify against TypeScript types post-install]:**
- `Stripe.Subscription.current_period_end` — epoch seconds INTEGER on Subscription object
- `Stripe.Subscription.customer` — Stripe customer ID string
- `Stripe.Invoice.customer` — Stripe customer ID string
- `Stripe.Subscription.status` — `'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'paused' | 'unpaid'`

---

## Common Pitfalls

### Pitfall 1: Reading `req.json()` Before `req.text()` in Webhook Handler

**What goes wrong:** Next.js App Router reads the request body stream once. If any code calls `req.json()` first (e.g., accidental debug logging, middleware body parsing), the stream is consumed. When `constructEventAsync` reads the raw bytes, it receives an empty string — HMAC verification fails.

**How to avoid:** The FIRST line of the webhook POST handler must be `const body = await req.text()`. Never call `req.json()` in this handler. The parsed event data is already available in the verified `event` object.

**Warning signs:** `WebhookSignatureVerificationError: No signatures found matching the expected signature for payload.`

### Pitfall 2: Using `stripe.webhooks.constructEvent` (Sync) in Workers

**What goes wrong:** The synchronous `constructEvent` uses `crypto.timingSafeEqual` from Node.js `node:crypto`. Even with `nodejs_compat`, this specific function is not bridged in Workers runtime. The call throws `TypeError: crypto.timingSafeEqual is not a function`.

**How to avoid:** Always use `constructEventAsync` with the 5th argument `Stripe.createSubtleCryptoProvider()`. This uses `crypto.subtle.verify` (Web Crypto API), which IS available in Workers.

**Warning signs:** `TypeError: crypto.timingSafeEqual is not a function` in wrangler dev logs.

### Pitfall 3: Omitting `httpClient: Stripe.createFetchHttpClient()`

**What goes wrong:** Stripe SDK defaults to `node:https` for HTTP. Workers do not have `node:https` even with `nodejs_compat`. The SDK throws at first API call: `Error: Cannot find module 'node:https'` or `Class extends value #<Object> is not a constructor or null`.

**How to avoid:** Always pass `httpClient: Stripe.createFetchHttpClient()` in the Stripe constructor. See Pattern 1.

**Warning signs:** Module resolution error on any Stripe API call; often appears as a constructor error rather than a network error.

### Pitfall 4: Copying `export const runtime = 'edge'` from Phase 2 Routes

**What goes wrong:** Phase 2 routes have `export const runtime = 'edge'` which `@opennextjs/cloudflare` v1.x silently ignores (the adapter runs everything in workerd regardless). Copying this export into Phase 3 creates incorrect documentation and risks breaking on adapter version upgrades when edge runtime support is properly enforced.

**How to avoid:** Do NOT add `export const runtime = 'edge'` to any Phase 3 route handler. Omit the export entirely.

**Warning signs:** Build-time error on adapter upgrade: `edge runtime not supported by @opennextjs/cloudflare`.

### Pitfall 5: Idempotency Record Written Before Handler Succeeds (Non-Atomic)

**What goes wrong:** If `stripe_events` INSERT is committed before the state-machine update runs, and the update throws, the event_id is consumed but D1 state was not changed. On Stripe's retry, the duplicate check causes early exit — leaving subscription status permanently wrong.

**How to avoid:** Use `env.DB.batch([idempotencyStmt, stateUpdateStmt])` so both writes are atomic. If the batch throws, neither write commits, and Stripe retries successfully.

**Warning signs:** `stripe_events` has an event_id but `agents.subscription_status` was not updated. Agent shows wrong subscription state.

### Pitfall 6: `subscription_grace_until` in Milliseconds Instead of Epoch Seconds

**What goes wrong:** D1 stores `subscription_grace_until` as epoch SECONDS (INTEGER). `Date.now()` returns milliseconds. If `Date.now() + 7 * 24 * 60 * 60 * 1000` is written instead of `Math.floor(Date.now() / 1000) + 604800`, the grace expiry appears ~30 years in the future — agent effectively has permanent access after any payment failure.

**How to avoid:** Always use `Math.floor(Date.now() / 1000)` for current time in seconds. Compare against `unixepoch()` in SQL (also seconds). See Pattern 3.

**Warning signs:** Agent with `subscription_status='grace'` appears publishable indefinitely; `subscription_grace_until` value is ~1.7 trillion (milliseconds, not seconds).

### Pitfall 7: Missing Stripe Customer Portal Configuration

**What goes wrong:** `stripe.billingPortal.sessions.create` returns a 400 error if the Stripe Customer Portal has not been configured in the Stripe Dashboard. The Portal requires enabling it and setting allowed features (cancel, update payment method, etc.).

**How to avoid:** Add to human verification checklist: Stripe Dashboard → Billing → Customer Portal → Enable and configure before testing the Portal route.

**Warning signs:** `StripeInvalidRequestError: No configuration provided and your test mode account does not have a default configuration.`

### Pitfall 8: Webhook `customer` Field Type Assertion

**What goes wrong:** `event.data.object.customer` is typed as `string | Stripe.Customer | Stripe.DeletedCustomer | null` in the SDK (it can be expanded if the event was fetched with `expand: ['data.object.customer']`). If code treats it as `string` without checking, a runtime error occurs if Stripe expands the field.

**How to avoid:** Always cast `const customerId = sub.customer as string` only for non-expanded webhook payloads (Stripe sends the ID as a string in webhook bodies by default). Do not call `stripe.webhooks.constructEventAsync` with `expand` — the raw webhook payload always has the ID as a string.

**Warning signs:** `TypeError: Cannot read property 'id' of string` when trying to access `customer.id` on what is actually a raw string.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `export const runtime = 'edge'` in Phase 2 routes is silently ignored (not an error) by `@opennextjs/cloudflare` v1.19.x | Pitfall 4 | If it causes build errors, Phase 2 routes also need urgent fixes |
| A2 | `Stripe.Subscription.current_period_end` field name is unchanged in API version `2026-05-27.dahlia` | Pattern 3 / Event Table | TypeScript will catch it at compile; field access in Pattern 3 must be updated |
| A3 | D1 `batch([])` is fully atomic (all statements commit or all roll back) | Pitfall 5 / Pattern 3 | If D1 batch is NOT atomic, the idempotency-before-handler write ordering issue persists |
| A4 | Module-level `stripeCryptoProvider` singleton is safe to reuse across concurrent requests in Workers | Pattern 1 | If stateful, move inside the request handler body |
| A5 | Stripe Customer Portal requires Dashboard configuration before `billingPortal.sessions.create` works | Pitfall 7 / Pattern 5 | Portal route returns 400 until Bernard enables it in Stripe Dashboard |
| A6 | `isAgentPublishable` grace logic and AGENT_PUBLISHABLE_SQL correctly reflect the CONTEXT.md grace-period decision | Pattern 6 | SQL gate applies incorrect timing; agents are shown as publishable when they should be hidden (or vice versa) |

---

## Open Questions

1. **D1 batch atomicity**
   - What we know: Cloudflare D1 supports `db.batch([...])` for multiple statements in one round-trip
   - What's unclear: Whether batch is guaranteed atomic (all-or-nothing) or best-effort
   - Recommendation: Check Cloudflare D1 transaction docs before shipping Pattern 3. If not atomic, use `BEGIN IMMEDIATE; ...; COMMIT` via raw SQL execute.

2. **Stripe API type field names for `2026-05-27.dahlia`**
   - What we know: `current_period_end` has been stable snake_case since Stripe API v1
   - What's unclear: Whether the `.dahlia` naming convention introduces object shape changes
   - Recommendation: After `npm install stripe`, inspect `node_modules/stripe/types/Subscriptions.d.ts` before writing handlers.

3. **Stripe CLI availability for local webhook testing**
   - What we know: `stripe listen --forward-to localhost:8787/api/stripe/webhook` is the standard local dev approach
   - What's unclear: Whether Bernard has the Stripe CLI installed
   - Recommendation: Add Stripe CLI install check to Wave 0; fallback is Stripe Dashboard "Send test event" button.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm install stripe` | Yes | 20.11.0 (pinned) | — |
| wrangler | Local D1 dev + testing | Yes | 4.99.0 | — |
| Stripe CLI (`stripe`) | Webhook forwarding to local dev | Not verified | — | Stripe Dashboard "Send test event" |
| Stripe account (test mode) | All Stripe API calls | Bernard has account | — | Cannot proceed without keys |
| `STRIPE_SECRET_KEY` in `.dev.vars` | All Stripe route handlers | NOT YET added | — | Wave 0 task must add it |
| `STRIPE_WEBHOOK_SECRET` in `.dev.vars` | Webhook handler | NOT YET added | — | Wave 0 task must add it |
| `STRIPE_PRICE_ID` in `.dev.vars` | Checkout session creation | NOT YET — Bernard creates Price in Dashboard | — | Cannot test Checkout without it |

**Missing dependencies with no fallback:**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` must be added to `.dev.vars` before any Stripe route handler works locally.
- Stripe Customer Portal must be configured in Dashboard before portal route can be tested.

**Missing dependencies with fallback:**
- Stripe CLI: Stripe Dashboard "Send test event" is a viable alternative for verifying webhook handler logic.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) |
| Config file | none (`package.json` scripts only) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Checkout session request shape is valid (mock Stripe) | unit | `npm test` | No — Wave 0 |
| BILL-02 | Webhook signature verification passes for valid event | unit | `npm test` | No — Wave 0 |
| BILL-03 | Duplicate event_id returns without re-processing | unit | `npm test` | No — Wave 0 |
| BILL-04 | `invoice.payment_failed` sets grace status + grace_until | unit | `npm test` | No — Wave 0 |
| BILL-05 | `isAgentPublishable` correct for all 4 status values | unit | `npm test` | No — Wave 0 |
| BILL-06 | Admin bypass: `isAgentPublishable` true for is_admin=1 | unit | `npm test` | No — Wave 0 |
| BILL-07 | Checkout route returns 403 for admin token | unit | `npm test` | No — Wave 0 |
| BILL-08 | Portal route returns 404 when no stripe_customer_id | unit | `npm test` | No — Wave 0 |
| BILL-09 | Live Checkout: real card → active status in D1 | manual | human verification | — |
| BILL-10 | Live Portal: cancel subscription → lapsed status | manual | human verification | — |

### Wave 0 Gaps

- [ ] `src/tests/billing.test.ts` — covers BILL-01 through BILL-08 (mock Stripe + mock D1)
- [ ] `src/tests/subscription.test.ts` — covers `isAgentPublishable` pure function (no I/O)

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Checkout/Portal routes verify session via `getTokens()` — no anonymous access |
| V3 Session Management | YES (inherited) | Same HttpOnly cookie pattern from Phase 2 |
| V4 Access Control | YES | Checkout requires active agent session; webhook exempt by design (Stripe IP + HMAC) |
| V5 Input Validation | YES | Webhook: signature verification gates all event processing; route handlers validate session tokens |
| V6 Cryptography | YES | `constructEventAsync` + `createSubtleCryptoProvider` (Web Crypto API HMAC-SHA256); never hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook event | Spoofing | `constructEventAsync` HMAC-SHA256 using `STRIPE_WEBHOOK_SECRET` |
| Replay attack on webhook | Tampering | Stripe timestamp in signature; 300s tolerance; `stripe_events` idempotency table |
| Leaked `STRIPE_SECRET_KEY` | Information Disclosure | Wrangler secret; never in `wrangler.toml [vars]`; never in git |
| Unauthorized Checkout creation | Elevation of Privilege | Route requires valid `__session` cookie; uid from token never request body |
| Admin creating Stripe customer | Elevation of Privilege | Checkout route returns 403 for `decodedToken.admin === true` |
| Subscription state bypass | Elevation of Privilege | Gate helper reads D1 on every request; no client-side bypass |
| D1 SQL injection in webhook | Tampering | All D1 writes use `prepare().bind()` — no string concatenation |
| `subscription_grace_until` ms-vs-seconds confusion | Tampering | Always `Math.floor(Date.now() / 1000)`; compared with `unixepoch()` in SQL |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| Files under 500 lines | `webhook/route.ts` must stay under 500 lines; extract `handleStripeEvent` to `src/lib/stripe-events.ts` if needed |
| Validate input at system boundaries | Webhook: signature verification; Checkout/Portal: session token validation |
| `try/catch` wrapping all handler logic | All three new API routes wrap in try/catch |
| Parameterized D1 `.bind()` — no string concatenation | All D1 queries use `prepare().bind()` |
| No `export const runtime = 'edge'` in Phase 3 | Omit this export from all new route handlers |
| `console.error` for server errors only | No `console.log` in production route handlers |
| NEVER commit secrets/credentials | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` via wrangler secrets only |
| Import alias `@/` for all internal imports | `import { getStripe } from '@/lib/stripe'` |
| Named export + default export for reusable components | Billing widget component follows convention |
| Double quotes for JSX attributes | Enforced by existing ESLint config |
| Accessibility: 44px touch targets, aria-labels | Subscribe/Manage buttons use `.touch-target` and `aria-label` |

---

## Sources

### Primary (CITED — MEDIUM confidence)
- [opennext.js.org/cloudflare](https://opennext.js.org/cloudflare) — edge runtime not supported in v1.x; remove `export const runtime = 'edge'`
- [opennext.js.org/cloudflare/howtos/stripeAPI](https://opennext.js.org/cloudflare/howtos/stripeAPI) — `httpClient: Stripe.createFetchHttpClient()` required; Workers lacks `node:https`
- [jross.me/verifying-stripe-webhook-signatures-cloudflare-workers](https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers) — `constructEventAsync` + `createSubtleCryptoProvider`; `await req.text()` for raw body

### Secondary (VERIFIED — MEDIUM confidence)
- stripe-node CHANGELOG via GitHub — API version `2026-05-27.dahlia` for stripe@22.2.1 [VERIFIED: npm view stripe + raw CHANGELOG]
- npm registry — `stripe@22.2.1`, 13.5M weekly downloads [VERIFIED: npm registry]
- Existing codebase — `middleware.ts` matcher, `db/migrations/0001_initial_schema.sql`, established `getCloudflareContext({ async: true })` pattern [VERIFIED: codebase]

### Tertiary (ASSUMED — LOW confidence)
- Stripe Subscription/Invoice TypeScript field names for API version `2026-05-27.dahlia` — from training knowledge; verify against `node_modules/stripe/types/` post-install
- D1 `batch([])` atomicity — assumed based on documented behavior; verify against Cloudflare D1 docs

---

## Metadata

**Confidence breakdown:**
- Stripe init pattern (FetchHttpClient): HIGH — CITED from official opennext.js.org Stripe how-to
- Webhook `constructEventAsync` pattern: HIGH — CITED from jross.me; confirmed by multiple concordant search results
- Raw body `req.text()` requirement: HIGH — confirmed by multiple sources including Stripe official docs
- No `export const runtime = 'edge'`: HIGH — CITED from opennext.js.org; confirmed by GitHub issue #438
- Event field names (`current_period_end` etc.): MEDIUM — training knowledge; verify post-install
- D1 batch atomicity: MEDIUM — common pattern; verify against Cloudflare docs

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (Stripe API version pinned to SDK; stable for 30 days)
