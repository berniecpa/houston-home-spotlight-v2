# Architecture Patterns

**Project:** Houston Home Spotlight v2 — Real Estate Agent Marketplace SaaS
**Researched:** 2026-06-10
**Overall Confidence:** HIGH

---

## Context: The Shift Required

The existing codebase is a fully-static Next.js export (`output: 'export'`). The platform evolution requires:

1. Removing `output: 'export'` to enable server-side rendering at the edge.
2. Replacing `@cloudflare/next-on-pages` with `@opennextjs/cloudflare` — Cloudflare now recommends this adapter; `next-on-pages` only supports the edge runtime and lacks full Next.js feature coverage.
3. Adding a middleware layer for Firebase Auth token verification (using `next-firebase-auth-edge`, which uses Web Crypto API and works on Cloudflare Workers).
4. Replacing static JSON listing data with Cloudflare D1 queries.

---

## Recommended Architecture

```text
Browser
  |
  +-- Public pages (anonymous)
  |     / (home), /listings, /listings/[slug], /contact
  |
  +-- Agent dashboard (authenticated)
  |     /dashboard, /dashboard/listings, /dashboard/listings/new
  |     /dashboard/listings/[id]/edit, /dashboard/leads, /dashboard/billing
  |
  +-- Admin panel (Bernard only)
        /admin, /admin/agents, /admin/agents/[id], /admin/stats

Cloudflare Pages/Workers (edge)
  |
  +-- middleware.ts (Cloudflare edge runtime)
  |     +-- next-firebase-auth-edge
  |           +-- Verifies Firebase ID token from cookie (Web Crypto, no firebase-admin)
  |           +-- Reads custom claims to check agent vs admin role
  |           +-- Redirects unauthenticated /dashboard/* to /login
  |           +-- Redirects non-admin /admin/* to /403
  |
  +-- Route Handlers (API Routes)
  |     /api/leads          -> D1 insert + Perfex CRM proxy (existing, extended)
  |     /api/auth/login     -> Issue session cookie (next-firebase-auth-edge)
  |     /api/auth/logout    -> Clear session cookie
  |     /api/listings       -> CRUD for agent's own listings (authenticated)
  |     /api/admin/agents   -> Admin: manage agent records
  |     /api/webhooks/stripe -> Stripe webhook event handler
  |
  +-- Server Components (data at request time via getCloudflareContext())
  |     Dashboard pages: read D1 for agent's listings, leads, subscription status
  |     Admin pages: read D1 for all agents, platform stats
  |
  +-- Static / ISR pages (public)
        /listings, /listings/[slug] -- D1 query at build time + revalidate interval
        Home page hero -- can stay SSG with featured listings from D1 at build

Cloudflare D1 (SQLite)
  +-- Tables: agents, listings, subscriptions, leads

Cloudflare Workers bindings (via wrangler.toml)
  +-- DB binding -> D1 database

Firebase Auth (external)
  +-- Issues ID tokens (JWT) to browser clients
        ^ Verified in middleware via Web Crypto (not firebase-admin)

Stripe (external)
  +-- Subscription billing: checkout sessions, webhooks -> /api/webhooks/stripe
        v Updates agents.subscription_status + subscriptions table in D1
```

---

## Q1 — Route Group Structure

Route groups organise files without affecting URLs. Use three groups:

```
src/app/
+-- (public)/                    <- no auth required
|   +-- layout.tsx               <- marketing chrome (Header, Footer)
|   +-- page.tsx                 <- home
|   +-- listings/
|   |   +-- page.tsx             <- /listings (browse + filter)
|   |   +-- [slug]/
|   |       +-- page.tsx         <- /listings/[slug] (detail)
|   +-- contact/
|       +-- page.tsx             <- /contact
|
+-- (auth)/                      <- login/register -- blocked if already signed in
|   +-- layout.tsx               <- minimal shell (no Header/Footer nav)
|   +-- login/
|   |   +-- page.tsx             <- /login
|   +-- register/
|       +-- page.tsx             <- /register (agent sign-up)
|
+-- (dashboard)/                 <- agent-authenticated
|   +-- layout.tsx               <- dashboard chrome (sidebar nav, user header)
|   +-- dashboard/
|       +-- page.tsx             <- /dashboard (agent overview)
|       +-- listings/
|       |   +-- page.tsx         <- /dashboard/listings
|       |   +-- new/
|       |   |   +-- page.tsx     <- /dashboard/listings/new
|       |   +-- [id]/
|       |       +-- edit/
|       |           +-- page.tsx <- /dashboard/listings/[id]/edit
|       +-- leads/
|       |   +-- page.tsx         <- /dashboard/leads
|       +-- billing/
|           +-- page.tsx         <- /dashboard/billing
|
+-- (admin)/                     <- Bernard only (custom claim: admin === true)
    +-- layout.tsx               <- admin chrome
    +-- admin/
        +-- page.tsx             <- /admin (platform stats)
        +-- agents/
        |   +-- page.tsx         <- /admin/agents
        |   +-- [id]/
        |       +-- page.tsx     <- /admin/agents/[id]
        +-- stats/
            +-- page.tsx         <- /admin/stats

src/middleware.ts                 <- matcher covers /dashboard/*, /admin/*, /api/auth/*
```

**Middleware matcher:**

```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/auth/:path*',
    '/api/listings/:path*',
    '/api/admin/:path*',
  ],
};
```

Public routes (`/`, `/listings/*`, `/contact`, `/api/leads`, `/api/webhooks/stripe`) are NOT in the matcher — they bypass middleware entirely.

---

## Q2 — Firebase Auth Token Verification at Cloudflare Edge

**Do not use `firebase-admin`.** It depends on Node.js `crypto` internals not available in the Workers edge runtime.

**Use `next-firebase-auth-edge`** — verifies Firebase JWT using the Web Crypto API (jose-based). Works in Cloudflare's edge runtime.

### How it works

1. Browser signs in via Firebase Auth JS SDK (client-side).
2. After sign-in, client calls `/api/auth/login` — the route handler issues an HttpOnly cookie containing the encoded session.
3. On every subsequent request to a protected route, `middleware.ts` reads the cookie and calls `authMiddleware()` from `next-firebase-auth-edge` to verify the JWT signature against Google's public keys.
4. Verified token payload (including custom claims) is forwarded to the page via request headers.
5. Server components extract user context from request headers — no additional token fetch needed.

### Required env vars

```bash
# Firebase project config (public, used on client too)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Service account for token operations (server-only)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Cookie signing keys -- rotate these; use comma-separated list for rotation
AUTH_COOKIE_SIGNATURE_KEY_CURRENT=
AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS=
```

### Middleware skeleton

```typescript
// src/middleware.ts
import { authMiddleware } from 'next-firebase-auth-edge';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: '/api/auth/login',
    logoutPath: '/api/auth/logout',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: 'AuthToken',
    cookieSignatureKeys: [
      process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
      process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
    ],
    serviceAccount: {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    handleValidToken: async ({ token, decodedToken }, headers) => {
      // Block non-admin users from /admin/*
      if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!decodedToken.admin) {
          return Response.redirect(new URL('/403', request.url));
        }
      }
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      return Response.redirect(new URL('/login', request.url));
    },
    handleError: async () => {
      return Response.redirect(new URL('/login', request.url));
    },
  });
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/auth/:path*',
    '/api/listings/:path*',
    '/api/admin/:path*',
  ],
};
```

### Admin role setup

Set the custom claim once per admin user via Firebase Admin SDK (from a server script, not from the edge):

```typescript
// scripts/set-admin-claim.ts (run locally with Node, not at edge)
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp({ credential: cert(serviceAccount) });
await getAuth(app).setCustomUserClaims(uid, { admin: true });
```

The `admin: true` claim appears in the decoded token in middleware automatically on next token refresh.

---

## Q3 — D1 Schema

```sql
-- migrations/0001_initial_schema.sql

CREATE TABLE IF NOT EXISTS agents (
  id                    TEXT PRIMARY KEY,
  -- Firebase UID; set by the app on first login
  email                 TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  phone                 TEXT,
  brokerage             TEXT,
  license_no            TEXT,
  photo_url             TEXT,
  -- Subscription denormalization for fast visibility checks
  subscription_status   TEXT NOT NULL DEFAULT 'inactive',
  -- values: 'active' | 'past_due' | 'inactive' | 'cancelled'
  subscription_grace_until INTEGER,
  -- Unix epoch; listings stay visible until this timestamp
  stripe_customer_id    TEXT UNIQUE,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listings (
  id          TEXT PRIMARY KEY,
  -- UUID generated on insert
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT NOT NULL DEFAULT 'Houston',
  state       TEXT NOT NULL DEFAULT 'TX',
  zip         TEXT,
  price       INTEGER NOT NULL,
  -- stored in dollars (not cents)
  beds        INTEGER NOT NULL,
  baths       REAL NOT NULL,
  -- allows 1.5, 2.5
  sqft        INTEGER,
  description TEXT,
  images      TEXT NOT NULL DEFAULT '[]',
  -- JSON array of URL strings
  featured    INTEGER NOT NULL DEFAULT 0,
  -- 0 = false, 1 = true (SQLite boolean)
  status      TEXT NOT NULL DEFAULT 'active',
  -- values: 'active' | 'inactive' | 'draft'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_listings_agent  ON listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_price  ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_beds   ON listings(beds);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   TEXT PRIMARY KEY,
  -- Stripe subscription ID (sub_xxx)
  agent_id             TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  stripe_customer_id   TEXT NOT NULL,
  status               TEXT NOT NULL,
  -- mirrors Stripe: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing'
  current_period_start INTEGER NOT NULL,
  -- Unix epoch
  current_period_end   INTEGER NOT NULL,
  -- Unix epoch
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_agent ON subscriptions(agent_id);

CREATE TABLE IF NOT EXISTS leads (
  id             TEXT PRIMARY KEY,
  -- UUID generated on insert
  listing_id     TEXT REFERENCES listings(id) ON DELETE SET NULL,
  agent_id       TEXT REFERENCES agents(id) ON DELETE SET NULL,
  firstname      TEXT NOT NULL,
  lastname       TEXT NOT NULL,
  email          TEXT NOT NULL,
  phonenumber    TEXT,
  message        TEXT,
  perfex_lead_id TEXT,
  -- ID returned by Perfex CRM; nullable if CRM is unavailable
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_leads_agent   ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_listing ON leads(listing_id);
```

**Key schema decisions:**
- `agents.subscription_status` is a denormalized copy for fast public listing visibility checks — avoids a JOIN on every public page load.
- `agents.subscription_grace_until` holds the Unix epoch beyond which listings go offline after payment failure; set to `now + 7 days` on `invoice.payment_failed`.
- Listing `images` is a JSON array stored as TEXT — SQLite has no native array type; always read/written as a whole.
- Boolean fields use `INTEGER 0/1` — SQLite stores all booleans this way.
- All timestamps are Unix epochs (INTEGER) — avoids SQLite timezone ambiguity.

---

## Q4 — Stripe Subscription State Sync with D1

### Webhook endpoint

```
POST /api/webhooks/stripe
```

This route is public (no auth middleware matcher). Stripe signs every request with `STRIPE_WEBHOOK_SECRET`.

### Verification pattern (Cloudflare Workers compatible)

```typescript
// src/app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  // raw body required for signature verification
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    // constructEventAsync uses Web Crypto; works in Cloudflare Workers
    event = await stripe.webhooks.constructEventAsync(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const { env } = getCloudflareContext();
  const db = env.DB;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await db.prepare(
        `INSERT INTO subscriptions
           (id, agent_id, stripe_customer_id, status,
            current_period_start, current_period_end, cancel_at_period_end, updated_at)
         VALUES (?, (SELECT id FROM agents WHERE stripe_customer_id = ?), ?, ?, ?, ?, ?, unixepoch())
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           cancel_at_period_end = excluded.cancel_at_period_end,
           updated_at = unixepoch()`
      ).bind(
        sub.id,
        sub.customer as string,
        sub.customer as string,
        sub.status,
        sub.current_period_start,
        sub.current_period_end,
        sub.cancel_at_period_end ? 1 : 0,
      ).run();

      const agentStatus = (sub.status === 'active' || sub.status === 'trialing')
        ? 'active' : sub.status;
      await db.prepare(
        `UPDATE agents
         SET subscription_status = ?, subscription_grace_until = NULL, updated_at = unixepoch()
         WHERE stripe_customer_id = ?`
      ).bind(agentStatus, sub.customer).run();
      break;
    }

    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      await db.prepare(
        `UPDATE agents
         SET subscription_status = 'active', subscription_grace_until = NULL, updated_at = unixepoch()
         WHERE stripe_customer_id = ?`
      ).bind(inv.customer).run();
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const graceUntil = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
      await db.prepare(
        `UPDATE agents
         SET subscription_status = 'past_due', subscription_grace_until = ?, updated_at = unixepoch()
         WHERE stripe_customer_id = ?`
      ).bind(graceUntil, inv.customer).run();
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db.prepare(
        `UPDATE agents
         SET subscription_status = 'cancelled', subscription_grace_until = NULL, updated_at = unixepoch()
         WHERE stripe_customer_id = ?`
      ).bind(sub.customer).run();
      // Take listings offline immediately on cancellation
      await db.prepare(
        `UPDATE listings SET status = 'inactive', updated_at = unixepoch()
         WHERE agent_id = (SELECT id FROM agents WHERE stripe_customer_id = ?)`
      ).bind(sub.customer).run();
      break;
    }
  }

  return new Response('ok', { status: 200 });
}
```

### Subscription state flow

```
Agent registers
  -> stripe_customer_id stored in agents table after Stripe Checkout

Agent subscribes
  -> customer.subscription.created webhook
  -> agents.subscription_status = 'active'

Monthly renewal
  -> invoice.paid webhook
  -> confirm active, clear grace_until

Payment fails
  -> invoice.payment_failed webhook
  -> subscription_status = 'past_due'
  -> grace_until = now + 7 days
  -> listings remain visible during grace window

Grace expires (no cron needed)
  -> public listing query WHERE grace_until > unixepoch() handles this inline

Agent cancels
  -> customer.subscription.deleted webhook
  -> subscription_status = 'cancelled'
  -> listings.status = 'inactive' (removed from public pages immediately)

Agent re-subscribes
  -> customer.subscription.created again
  -> subscription_status = 'active'
  -> agent manually republishes listings from dashboard
```

**Grace period enforcement query (used on all public listing reads):**

```sql
WHERE l.status = 'active'
  AND (
    a.subscription_status = 'active'
    OR (
      a.subscription_status = 'past_due'
      AND a.subscription_grace_until > unixepoch()
    )
  )
```

No cron job is required. The query itself is the enforcement gate — listings disappear automatically once the grace window passes.

---

## Q5 — Migration from Static JSON Listings to D1

The migration must not break existing public URLs (`/listings`, `/listings/[slug]`). Slugs in JSON become slugs in D1 — the URL surface is identical.

### Phase A: Seed D1 from JSON (one-time data migration)

Write a migration SQL file that inserts the three existing listings. Assign Bernard's Firebase UID to all three as the owning agent.

```bash
# Apply schema first
npx wrangler d1 migrations apply houston-home-spotlight --remote

# Verify data
npx wrangler d1 execute houston-home-spotlight --remote --command "SELECT slug FROM listings"
```

### Phase B: Replace lib/data.ts data source

`src/lib/data.ts` currently imports JSON files. Replace with D1 queries.

```typescript
// src/lib/data.ts (new implementation)
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getAllListings() {
  const { env } = await getCloudflareContext({ async: true });
  const result = await env.DB.prepare(
    `SELECT l.*, a.name as agent_name, a.phone as agent_phone
     FROM listings l
     JOIN agents a ON l.agent_id = a.id
     WHERE l.status = 'active'
       AND (
         a.subscription_status = 'active'
         OR (a.subscription_status = 'past_due' AND a.subscription_grace_until > unixepoch())
       )
     ORDER BY l.created_at DESC`
  ).all();
  return result.results;
}

export async function getListingBySlug(slug: string) {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB.prepare(
    `SELECT l.*, a.name as agent_name, a.phone as agent_phone, a.photo_url as agent_photo
     FROM listings l
     JOIN agents a ON l.agent_id = a.id
     WHERE l.slug = ?`
  ).bind(slug).first();
}
```

### Phase C: Update generateStaticParams and set ISR revalidation

```typescript
// src/app/(public)/listings/[slug]/page.tsx
export const revalidate = 300; // 5-minute ISR; listing pages rebuild from D1 periodically

export async function generateStaticParams() {
  const listings = await getAllListings();
  return listings.map((l) => ({ slug: String(l.slug) }));
}
```

ISR requires removing `output: 'export'` (Phase 1) — static export mode does not support revalidation.

### Phase D: Delete static JSON and duplicate lib module

After confirming D1-backed routes serve correctly:
- Delete `src/data/listings/*.json`
- Delete `src/lib/listings.ts` (the duplicate module flagged in existing architecture docs)
- `resolveJsonModule` in `tsconfig.json` can be removed if no other JSON imports remain

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `middleware.ts` | Auth gate: verify Firebase cookie, enforce route protection, check admin claim | `next-firebase-auth-edge`, all protected routes |
| `(public)` pages | Public listing browse, listing detail, home, contact | `src/lib/data.ts` (D1 reads), `InquiryForm` |
| `(auth)` pages | Login/register UI, Firebase client SDK sign-in | Firebase Auth JS SDK, `/api/auth/login` |
| `/api/auth/login` | Issue session cookie after Firebase sign-in; upsert agent row in D1 | `next-firebase-auth-edge`, D1 agents table |
| `/api/auth/logout` | Clear session cookie | `next-firebase-auth-edge` |
| `(dashboard)` pages | Agent CRUD for listings, lead inbox view, billing management | `/api/listings`, D1 (direct RSC reads), Stripe Portal URL |
| `(admin)` pages | Platform management: agent list, suspend, stats | D1 (direct RSC reads), `/api/admin/agents` |
| `/api/listings` | Agent's own listing CRUD; validates caller is the listing owner | D1 listings table, auth headers from middleware |
| `/api/leads` | Lead capture: insert into D1 + proxy to Perfex CRM | D1 leads table, Perfex CRM |
| `/api/webhooks/stripe` | Stripe event handler: sync subscription state | Stripe SDK, D1 agents + subscriptions + listings tables |
| `/api/admin/agents` | Admin: read/update/suspend agent records | D1 agents table, auth headers (admin claim required) |
| `src/lib/data.ts` | Public data access layer — listings for public pages | D1 via `getCloudflareContext()` |
| D1 | Source of truth for agents, listings, subscriptions, leads | All server-side components |
| Firebase Auth | Identity provider; issues and validates JWT ID tokens | Browser SDK, middleware via `next-firebase-auth-edge` |
| Stripe | Billing; subscription lifecycle; customer portal | `/api/webhooks/stripe`, `/api/billing/*`, agent billing page |

---

## Data Flow

### Public listing browse (anonymous buyer)

```
Browser GET /listings
  -> middleware: path not in matcher -> passes through
  -> (public)/listings/page.tsx (RSC, ISR, revalidate = 300)
  -> lib/data.ts getAllListings()
  -> D1: SELECT listings WHERE status=active AND subscription valid
  -> render ListingCard grid
  -> Response served from CDN edge cache; revalidated every 5 min
```

### Lead submission (anonymous buyer)

```
Buyer submits InquiryForm on /listings/[slug]
  -> POST /api/leads { listing_id, agent_id, firstname, lastname, email, ... }
  -> middleware: path not in matcher -> passes through
  -> leads/route.ts:
      1. validate fields
      2. D1 INSERT INTO leads
      3. fetch Perfex CRM (existing behavior; extended with listing/agent context)
  -> 200 { success: true }
  -> InquiryForm shows success banner
```

### Agent sign-in

```
Browser /login
  -> Firebase Auth JS SDK: signInWithEmailAndPassword()
  -> Firebase returns ID token (JWT) to browser
  -> Browser POST /api/auth/login { idToken }
  -> next-firebase-auth-edge: verify idToken, issue HttpOnly session cookie
  -> 200 -> browser redirects to /dashboard
```

### Agent dashboard request

```
Browser GET /dashboard
  -> middleware: /dashboard/* in matcher
  -> next-firebase-auth-edge reads session cookie, verifies JWT
     if invalid -> redirect /login
     if valid   -> forward uid, email, claims in request headers
  -> (dashboard)/dashboard/page.tsx (RSC)
  -> getCloudflareContext().env.DB
  -> SELECT listings WHERE agent_id = {uid from header}
  -> SELECT subscription_status, grace_until FROM agents WHERE id = {uid}
  -> render dashboard overview
```

### Stripe subscription creation

```
Agent clicks Subscribe on /dashboard/billing
  -> POST /api/billing/create-checkout (authenticated)
  -> stripe.checkout.sessions.create({ customer: agent.stripe_customer_id })
  -> returns Stripe Checkout URL
  -> Browser redirects to Stripe Checkout
  -> Stripe processes payment
  -> Stripe POST /api/webhooks/stripe { type: customer.subscription.created }
  -> D1 UPDATE agents SET subscription_status = 'active'
  -> Agent returns via success_url to /dashboard/billing
  -> Dashboard re-fetches from D1 and shows active subscription
```

### Listing visibility enforcement (inline, no cron)

```
Every public listing query includes:
  WHERE l.status = 'active'
    AND (
      a.subscription_status = 'active'
      OR (
        a.subscription_status = 'past_due'
        AND a.subscription_grace_until > unixepoch()
      )
    )

Result: listings silently disappear from public pages once grace window passes.
No background job required.
```

---

## Q6 — Build Order

Dependencies flow strictly downward. Each phase must be testable before the next phase begins.

```
Phase 1: Adapter migration (unblocks everything)
  +-- Remove output: 'export' from next.config.mjs
  +-- Replace @cloudflare/next-on-pages with @opennextjs/cloudflare
  +-- Create wrangler.toml with nodejs_compat flag
  +-- Add initOpenNextCloudflareForDev() to next.config.mjs
  +-- Update package.json scripts: pages:build -> opennextjs-cloudflare build
  Verify: opennextjs-cloudflare build succeeds; wrangler dev starts

Phase 2: D1 schema + data seed (unblocks auth, listings, billing)
  +-- Write migrations/0001_initial_schema.sql
  +-- Write migrations/0002_seed_listings.sql (3 existing listings, Bernard as agent)
  +-- npx wrangler d1 create houston-home-spotlight
  +-- Add d1_databases binding to wrangler.toml
  +-- npx wrangler d1 migrations apply --local then --remote
  Verify: SELECT * FROM listings returns 3 rows

Phase 3: Firebase Auth middleware (unblocks dashboard, admin)
  +-- npm install next-firebase-auth-edge
  +-- Set FIREBASE_* and AUTH_COOKIE_* env vars in .dev.vars and Cloudflare Pages
  +-- Create /api/auth/login and /api/auth/logout routes
  +-- Create src/middleware.ts with matchers
  +-- Create (auth) route group with /login and /register pages
  +-- /api/auth/login upserts agent row in D1 on first login
  Verify: unauthenticated GET /dashboard -> redirects to /login
  Verify: authenticated GET /dashboard -> 200

Phase 4: Public listing migration (unblocks ISR continuity, SEO)
  +-- Replace lib/data.ts JSON imports with D1 queries
  +-- Update generateStaticParams to query D1
  +-- Add export const revalidate = 300 to listing pages
  +-- Move existing pages into (public) route group
  +-- Delete src/data/listings/*.json and src/lib/listings.ts
  Verify: /listings and /listings/[slug] render from D1
  Verify: existing slugs unchanged (no 404 regression)

Phase 5: Agent dashboard (depends on Phase 2+3)
  +-- Create (dashboard) route group + layout with sidebar
  +-- /dashboard/listings CRUD pages
  +-- /api/listings route handler (GET list, POST create, PATCH update, DELETE)
  +-- /dashboard/leads page (SELECT FROM leads WHERE agent_id = {uid})
  Verify: agent creates listing; listing appears on public /listings

Phase 6: Stripe billing (depends on Phase 2+3+5)
  +-- npm install stripe
  +-- Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID env vars
  +-- /api/billing/create-checkout and /api/billing/portal route handlers
  +-- /api/webhooks/stripe handler (4 events: created, updated, invoice.paid,
      invoice.payment_failed, deleted)
  +-- /dashboard/billing page (shows current status, Subscribe / Manage buttons)
  +-- Subscription-aware listing visibility query in lib/data.ts
  Verify: Stripe CLI test events hit webhook; D1 agents row updates correctly

Phase 7: Admin panel (can run parallel to Phase 5-6; depends on Phase 2+3)
  +-- Create (admin) route group + layout
  +-- /admin/agents list + detail pages
  +-- /api/admin/agents GET + PATCH (suspend/activate) handler
  +-- Bernard UID gets custom claim { admin: true } via scripts/set-admin-claim.ts
  Verify: Bernard accesses /admin; non-admin blocked with redirect

Phase 8: Lead routing extension (final; depends on Phase 5+6)
  +-- Extend /api/leads to write to D1 leads table (schema already exists from Phase 2)
  +-- JOIN agents table to route lead to agent email (future email integration hook)
  +-- Keep Perfex CRM proxy for Bernard's copy
  Verify: submit inquiry -> lead row in D1 -> appears in agent's /dashboard/leads
```

**Critical dependency notes:**

- Phase 1 must complete before any dynamic server route can be tested on Cloudflare infrastructure. Do not write auth or database code against the static export build.
- Phase 2 schema must land (local and remote) before Phase 3, because `/api/auth/login` upserts the agent row in D1 on first login.
- Phase 4 can be developed in parallel with Phase 3 but cannot ship to production until Phase 2 schema is applied to the production D1 database.
- Stripe webhooks (Phase 6) need a publicly reachable URL during development — use `stripe listen --forward-to localhost:8787/api/webhooks/stripe` with `wrangler dev`.

---

## Adapter Migration: next-on-pages to opennextjs

Cloudflare's current recommendation for Next.js with dynamic routes is `@opennextjs/cloudflare`, not `@cloudflare/next-on-pages`. The legacy adapter only supports the edge runtime and lacks middleware and ISR support.

**next.config.mjs after migration:**

```javascript
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev(); // no-op in production; enables D1 binding in dev

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export' removed -- this enables SSR, middleware, and ISR
  images: { unoptimized: true },
};

export default nextConfig;
```

**wrangler.toml:**

```toml
name = "houston-home-spotlight-v2"
main = ".open-next/worker.js"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "houston-home-spotlight"
database_id = "<your-d1-database-id>"
migrations_dir = "migrations"
```

**package.json scripts after migration:**

```json
{
  "build": "next build",
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
}
```

**Accessing D1 in API routes:**

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';

// In route handlers (synchronous context available)
export async function GET() {
  const { env } = getCloudflareContext();
  const rows = await env.DB.prepare('SELECT * FROM listings').all();
  return Response.json(rows.results);
}

// In RSC pages during build (generateStaticParams runs outside request context)
const { env } = await getCloudflareContext({ async: true });
```

---

## Scalability Considerations

| Concern | At 50 agents | At 500 agents | Notes |
|---------|-------------|---------------|-------|
| D1 read load | Negligible | Monitor D1 read units | D1 is globally replicated; reads are cheap |
| Public listing ISR | 5-min revalidation sufficient | On-demand revalidation via tag | `revalidatePath('/listings')` after agent publishes |
| Stripe webhook processing | Synchronous D1 write is fine | Add idempotency guard | Must respond 200 within 20 seconds |
| Lead volume | Direct D1 insert | Same | D1 writes go to primary; adequate for this scale |
| Dashboard load | Per-agent D1 query | Covered by agent_id index | Avoid SELECT * without WHERE |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Relying solely on middleware for auth enforcement

**What:** Protecting dashboard pages only in `middleware.ts`, trusting forwarded headers without re-verifying.
**Why bad:** CVE-2025-29927 (disclosed March 2025) allows attackers to bypass Next.js middleware by manipulating the `x-middleware-subrequest` header. Defense-in-depth is required.
**Instead:** Re-verify the token in sensitive API route handlers using `next-firebase-auth-edge`'s `getTokens()` function in addition to middleware protection.

### Anti-Pattern 2: Using firebase-admin in edge routes

**What:** Installing `firebase-admin` and calling `getAuth().verifyIdToken()` in middleware or edge API routes.
**Why bad:** `firebase-admin` requires Node.js `crypto` internals not available in Cloudflare Workers edge runtime. Build fails or throws at runtime.
**Instead:** Use `next-firebase-auth-edge` — it uses the Web Crypto API and works in Cloudflare Workers.

### Anti-Pattern 3: Complex subscription JOIN on every public listing request

**What:** Running a three-table JOIN (listings + subscriptions + payment events) on each public request instead of reading denormalized status.
**Why bad:** Subscription state changes infrequently (webhook-driven). A complex JOIN on ISR cache misses is wasteful.
**Instead:** Keep `agents.subscription_status` and `agents.subscription_grace_until` denormalized. The webhook handler owns these fields. Public queries need only a two-table JOIN.

### Anti-Pattern 4: Storing subscription state only in the subscriptions table

**What:** Not denormalizing to agents row; requiring a subquery for every listing visibility check.
**Why bad:** Every public listing query needs subscription context. Denormalization makes this a single-column read.
**Instead:** Webhook handler updates both the `subscriptions` table (audit trail) and the `agents` row (fast lookup). `subscriptions` is the event log; `agents` is the current state.

### Anti-Pattern 5: Keeping output: 'export' after adding auth or database code

**What:** Trying to add API routes, middleware, or ISR while `output: 'export'` is still in `next.config.mjs`.
**Why bad:** Static export mode disables all server-side runtime features. Build succeeds but middleware and dynamic routes are silently broken.
**Instead:** Remove `output: 'export'` as the very first step before writing any server-side code.

---

## Sources

- [Cloudflare: Next.js on Cloudflare Workers (OpenNext)](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) — HIGH confidence (official docs)
- [OpenNext Cloudflare — Get Started](https://opennext.js.org/cloudflare/get-started) — HIGH confidence (official adapter docs)
- [OpenNext Cloudflare — Bindings (D1 access pattern)](https://opennext.js.org/cloudflare/bindings) — HIGH confidence (official adapter docs)
- [next-firebase-auth-edge — Middleware docs](https://next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware) — HIGH confidence (official library docs)
- [next-firebase-auth-edge — GitHub](https://github.com/awinogrodzki/next-firebase-auth-edge) — HIGH confidence
- [Stripe — Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — HIGH confidence (official Stripe docs)
- [Cloudflare D1 — Migrations reference](https://developers.cloudflare.com/d1/reference/migrations/) — HIGH confidence (official docs)
- [Next.js — Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) — HIGH confidence (official Next.js docs)
- [CVE-2025-29927 — Next.js middleware bypass](https://www.authgear.com/post/nextjs-middleware-authentication/) — MEDIUM confidence (community reporting of disclosed CVE)

---

*Research completed: 2026-06-10*
