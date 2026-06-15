# Phase 4: Listings, Migration, and Leads — Research

**Researched:** 2026-06-13
**Domain:** Cloudflare D1 / @opennextjs/cloudflare data layer, Resend fetch API, JSON→D1 migration, force-dynamic RSC
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lead Delivery Pipeline**
- On inquiry submit: (1) INSERT into D1 `leads`, (2) email via Resend to listing agent (Reply-To = buyer, Bernard CC'd), AND (3) STILL post to Perfex CRM (keep parallel — do not remove).
- Resend failure must not lose the lead: D1 insert is source of truth; email + Perfex are best-effort side effects. Never block buyer's success response on email/CRM failure.
- Bernard's CC address: env var `ADMIN_NOTIFY_EMAIL`. Resend key + from-domain: `RESEND_API_KEY`, `LEAD_FROM_EMAIL`.

**Public Listing Rendering**
- `/listings` and `/listings/[slug]` use `export const dynamic = 'force-dynamic'`, read D1 per request. NO `runtime='edge'` — @opennextjs/cloudflare ignores it.
- Subscription gate (AGENT_PUBLISHABLE_SQL / isAgentPublishable) applied: listing visible only when owning agent is publishable AND listing status is 'active'.
- Hidden/lapsed/paused listing slug returns `notFound()` (404).
- Remove `generateStaticParams` from detail page; update the 4 failing tests.

**Migration / Seed**
- 3 legacy JSON listings seeded into D1, owned by Bernard's admin agent id, status 'active', exact slugs preserved.
- D1 `listings.title` (NOT NULL) derived from address during seed.
- Idempotent SQL migration (INSERT OR IGNORE on slug). JSON files may remain on disk.
- Map: address/city/state/zip/price/beds/baths/sqft/description direct; images[] → listing_images rows (display_order = array index); createdAt → created_at epoch.

**Listing CRUD & Ownership**
- Create/edit/delete derive agent uid from verified session (never body); edit/delete enforce ownership → 403 on cross-agent.
- Create gated on isAgentPublishable (active/grace/admin).
- Pause/activate toggles listings.status between 'active' and 'paused'.

### Claude's Discretion
- Listing form UI layout (reuse ProfileForm patterns from Phase 2).
- Lead inbox table layout (mirror dashboard styling).
- Internal module structure of listings data-access layer.
- Whether to add a `featured` column to listings or derive featured another way (schema has no featured column — pick least-disruptive approach; admin/Bernard listings can be featured).

### Deferred Ideas (OUT OF SCOPE)
- Photo file upload to R2 (V2-03)
- Per-listing analytics (V2-04)
- CRM pipeline stages (V2-10)
- AI video (Phase 6)
- Admin-wide management views (Phase 5)
</user_constraints>

---

## Summary

Phase 4 converts the public listing read path from static JSON imports to live Cloudflare D1 queries, implements full listing CRUD for agents, migrates the three legacy JSON listings into D1, and extends the leads route with D1 persistence and Resend email delivery.

The single most important architectural finding: **`output: 'export'` was already removed from `next.config.mjs` in Phase 1.** The current config has no `output` key. `@opennextjs/cloudflare` handles deployment; the site already runs as Cloudflare Workers. `force-dynamic` and D1 bindings in RSC pages work today — no config change is required to enable dynamic routes.

The four failing tests in `src/tests/listing-detail-page.test.ts` are plain text-grep assertions. They look for `params.slug` (the old synchronous params pattern) and `getListingBySlug(params.slug)` but the current page uses `await params` (Next.js 15 async params). Fixing the page removes `generateStaticParams` and updates call sites to `const { slug } = await params` — the test assertions must be updated to match the new source text patterns.

**Primary recommendation:** Port `src/lib/data.ts` to D1 first (keeping identical async signatures), then convert the two public pages to `force-dynamic`, then build listing CRUD routes following the established profile-route pattern, then extend `/api/leads` with D1 insert + best-effort Resend, then deliver the seed migration.

---

## CRITICAL FINDING: output:'export' Status

### next.config.mjs — current state (verified by direct file read)

```js
// next.config.mjs — actual file content as of 2026-06-13
const nextConfig = {
  images: {
    unoptimized: true, // Keep — no Next.js image optimization on Workers
  },
};

if (process.env.NODE_ENV !== "production") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

export default nextConfig;
```

**`output: 'export'` is ABSENT.** It was removed during Phase 1 (the migration to @opennextjs/cloudflare). The codebase already runs as Cloudflare Workers with dynamic route capability. `PROJECT.md` mentions the old static-export architecture as context ("Next.js 14 App Router with `output: 'export'` — fully static SSG today") but that describes the pre-Phase-1 state.

**Implication for Phase 4:** No `next.config.mjs` changes are needed. `export const dynamic = 'force-dynamic'` in public pages will work immediately. D1 bindings via `getCloudflareContext` already work in the deployed adapter.

[VERIFIED: direct codebase read of next.config.mjs]

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public listing browse/detail | Frontend Server (RSC, force-dynamic) | D1 Database | Per-request D1 read; subscription gate enforced server-side |
| Listing CRUD | API / Backend (edge API routes) | D1 Database | Session-derived ownership, parameterized writes |
| Lead capture | API / Backend (/api/leads) | D1 Database, Resend, Perfex | D1 is source of truth; email + CRM are best-effort |
| JSON→D1 seed | Database / Storage (wrangler migration) | — | One-time idempotent migration, not runtime logic |
| Agent listing dashboard UI | Frontend Server (RSC shell + client form) | API routes | Session-gated; reuses ProfileForm pattern |
| Agent lead inbox | Frontend Server (RSC, D1 read) | — | Read-only per-agent view; no client state needed |
| Subscription gate enforcement | API / Backend (SQL JOIN fragment) | — | AGENT_PUBLISHABLE_SQL applied in data layer SQL |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@opennextjs/cloudflare` | ^1.13.12 (package.json) | Next.js → Cloudflare Workers adapter | Already in project |
| `@cloudflare/workers-types` | installed | D1Database type | Already in project |
| `next-firebase-auth-edge` | installed | Session cookie → uid derivation | Already in project |
| `next` | ^15.5.2 | App Router RSC / API routes | Already in project |

### New Dependency

No new npm packages are required for Phase 4. Resend is called via raw `fetch` to a Workers-compatible REST API; no Node SDK is needed. All other requirements (D1, auth, Next.js) are already installed.

### Installation

```bash
# No new packages needed.
```

---

## Package Legitimacy Audit

No new packages are introduced in this phase. All libraries used are established project dependencies already validated in prior phases.

---

## Architecture Patterns

### System Architecture Diagram

```
Buyer Browser
    |
    v
/listings (RSC, force-dynamic)
/listings/[slug] (RSC, force-dynamic)
    |  getCloudflareContext() -> env.DB
    |  SELECT l.*, li.url FROM listings l
    |  JOIN listing_images li ON ...
    |  JOIN agents a ON ...
    |  WHERE l.status='active' AND (AGENT_PUBLISHABLE_SQL)
    v
Cloudflare D1
    |
    v
Public Listing Shape (Listing interface)
    |
    v
/api/leads POST -> D1 leads INSERT (source of truth)
    |
    |-- best-effort -> Resend REST API
    |                  (reply_to=buyer, cc=ADMIN_NOTIFY_EMAIL)
    |
    +-- best-effort -> Perfex CRM API (existing, unchanged)

Agent Browser
    |
    v
/dashboard/listings (RSC, gated by DashboardLayout)
    |  CRUD UI (create/edit/delete/pause)
    v
/api/agent/listings/* (edge API routes)
    |  session -> uid (ownership)
    |  isAgentPublishable gate on CREATE
    |  parameterized D1 writes
    v
Cloudflare D1

/dashboard/leads (RSC, gated)
    |  SELECT from leads WHERE agent_id = uid
    v
Lead Inbox Table
```

### Recommended Project Structure

```
src/
  lib/
    data.ts                   # REWORK: JSON -> D1 (same async signatures)
    listings-db.ts            # NEW: D1 write helpers (create/update/delete)
    subscription.ts           # EXISTING: AGENT_PUBLISHABLE_SQL consumed here
  app/
    listings/
      page.tsx                # CONVERT: force-dynamic, RSC, fetch from D1
      ListingsClient.tsx      # NEW: 'use client' wrapper for FilterBar state
      [slug]/
        page.tsx              # CONVERT: force-dynamic, remove generateStaticParams
    api/
      leads/
        route.ts              # EXTEND: D1 insert + Resend + keep Perfex
      agent/
        listings/
          route.ts            # NEW: GET (list) + POST (create)
          [id]/
            route.ts          # NEW: PUT (edit) + DELETE + PATCH (toggle status)
    (dashboard)/dashboard/
      listings/
        page.tsx              # REPLACE placeholder with CRUD UI
      leads/
        page.tsx              # REPLACE placeholder with lead inbox
  types/
    index.ts                  # No changes needed (listingSlug already optional)
db/
  migrations/
    0002_add_featured_column.sql   # NEW: ALTER TABLE listings ADD COLUMN featured
    0003_seed_legacy_listings.sql  # NEW: idempotent seed for 3 JSON listings
```

---

## Domain 1: Resend Email on Cloudflare Workers

### Approach: raw fetch, no SDK

Resend's Node.js SDK uses Node-native APIs not available in the Workers runtime. Use the REST API directly via `fetch` — this is fully Workers-compatible. [ASSUMED — consistent with all Workers email integrations and the CONTEXT.md established patterns note]

### Exact Request Pattern

```typescript
// Best-effort Resend helper — never throws, always logs on failure
async function sendLeadEmail(params: {
  resendKey: string;
  fromEmail: string;      // LEAD_FROM_EMAIL env var — must be verified domain
  agentEmail: string;     // listing agent's email from agents row
  adminEmail: string;     // ADMIN_NOTIFY_EMAIL env var
  buyerEmail: string;     // body.email from the inquiry form
  buyerName: string;      // `${body.firstname} ${body.lastname}`
  listingAddress: string; // listing.address from D1
  listingSlug: string;    // body.listingSlug
  message: string;
  phonenumber: string;
}): Promise<void> {
  const body = {
    from: params.fromEmail,           // e.g. "Houston Home Spotlight <leads@yourdomain.com>"
    to: [params.agentEmail],          // primary recipient: listing agent
    cc: [params.adminEmail],          // Bernard CC via ADMIN_NOTIFY_EMAIL
    reply_to: params.buyerEmail,      // clicking Reply goes to the buyer
    subject: `New Inquiry: ${params.listingAddress}`,
    html: `
      <p>New inquiry from <strong>${params.buyerName}</strong>
         (<a href="tel:${params.phonenumber}">${params.phonenumber}</a>).</p>
      <p><strong>Listing:</strong>
         <a href="https://houstonhomespotlight.com/listings/${params.listingSlug}">
           ${params.listingAddress}
         </a>
      </p>
      <p><strong>Message:</strong> ${params.message || '(no message)'}</p>
      <p>Reply directly to this email to contact the buyer.</p>
    `,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.resendKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Resend delivery failed:', res.status, errText);
    // Do NOT throw — caller uses Promise.allSettled
  }
}
```

### From-Domain Verification Requirement

Resend requires the `from` email's domain to be DNS-verified in the Resend dashboard before emails are delivered. `LEAD_FROM_EMAIL` must use a domain Bernard has verified (DNS TXT + DKIM records added via Resend). `reply_to` and `cc` can be any address — no verification needed.

### Best-Effort Pattern (correct for Workers)

Cloudflare Workers terminates execution after the response is sent. Fire-and-forget promises may be killed before completing. The correct pattern awaits both side effects before returning — but catches errors individually so failures do not alter the 200 response:

```typescript
// In POST /api/leads — correct Workers best-effort sequencing:

// STEP 1: Validate input (400 on failure, before any side effects)

// STEP 2: INSERT lead into D1 (source of truth — must succeed or return 500)
const leadId = crypto.randomUUID();
const { env } = await getCloudflareContext({ async: true });
// Look up listing_id + agent_id + agent email from slug:
const listingRow = await env.DB.prepare(
  `SELECT l.id, l.agent_id, a.email as agent_email
   FROM listings l
   JOIN agents a ON l.agent_id = a.id
   WHERE l.slug = ?`
).bind(body.listingSlug).first<{ id: string; agent_id: string; agent_email: string }>();

if (!listingRow) {
  return NextResponse.json({ success: false, message: 'Listing not found.' }, { status: 400 });
}

await env.DB.prepare(
  `INSERT INTO leads (id, listing_id, agent_id, firstname, lastname, email, phonenumber, message)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
).bind(
  leadId, listingRow.id, listingRow.agent_id,
  body.firstname, body.lastname, body.email,
  body.phonenumber, body.message ?? null
).run();

// STEP 3: Best-effort side effects (await both, catch individually)
const [emailResult, perfexResult] = await Promise.allSettled([
  sendLeadEmail({
    resendKey: env.RESEND_API_KEY,
    fromEmail: env.LEAD_FROM_EMAIL,
    agentEmail: listingRow.agent_email,
    adminEmail: env.ADMIN_NOTIFY_EMAIL,
    buyerEmail: body.email,
    buyerName: `${body.firstname} ${body.lastname}`,
    listingAddress: '...', // fetch from listingRow or a second query
    listingSlug: body.listingSlug,
    message: body.message ?? '',
    phonenumber: body.phonenumber,
  }),
  sendToPerfex(body, env), // existing Perfex logic, extracted to helper
]);

if (emailResult.status === 'rejected') {
  console.error('Resend best-effort failure:', emailResult.reason);
}
if (perfexResult.status === 'rejected') {
  console.error('Perfex best-effort failure:', perfexResult.reason);
}

// STEP 4: Return success — D1 insert is already committed
return NextResponse.json({
  success: true,
  message: 'Thank you! Your inquiry has been submitted.',
  leadId,
});
```

---

## Domain 2: Reworking src/lib/data.ts from JSON to D1

### D1 Binding Access Pattern (verified from existing codebase)

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';

const { env } = await getCloudflareContext({ async: true });
const db = env.DB; // D1Database
```

`{ async: true }` is required in Next.js 15 App Router context. [VERIFIED: direct read of `src/app/api/agent/profile/route.ts` line 143 and `src/app/(dashboard)/layout.tsx` line 85 — both use this exact pattern]

### Reconstructing the Public Listing Shape

`Listing.images: string[]` is a flat array. D1 stores images in `listing_images` rows. Use two queries + in-memory grouping (avoids GROUP_CONCAT dependency):

```typescript
// src/lib/data.ts — D1-backed getAllListings()
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { AGENT_PUBLISHABLE_SQL } from '@/lib/subscription';
import type { Listing, FilterOptions } from '@/types';

interface ListingRow {
  id: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  description: string | null;
  video_url: string | null;
  created_at: number; // epoch seconds
  featured: number;   // 0 or 1 (added via migration 0002)
}

export async function getAllListings(): Promise<Listing[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const listingRows = await db.prepare(
      `SELECT l.id, l.slug, l.address, l.city, l.state, l.zip,
              l.price, l.beds, l.baths, l.sqft, l.description,
              l.video_url, l.created_at, l.featured
       FROM listings l
       JOIN agents a ON l.agent_id = a.id
       WHERE l.status = 'active'
         AND ${AGENT_PUBLISHABLE_SQL}
       ORDER BY l.created_at DESC`
    ).all<ListingRow>();

    if (!listingRows.results.length) return [];

    // Batch-fetch images for all returned listings
    const ids = listingRows.results.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const imageRows = await db.prepare(
      `SELECT listing_id, url FROM listing_images
       WHERE listing_id IN (${placeholders})
       ORDER BY display_order ASC`
    ).bind(...ids).all<{ listing_id: string; url: string }>();

    // Group images by listing_id
    const imageMap = new Map<string, string[]>();
    for (const img of imageRows.results) {
      const arr = imageMap.get(img.listing_id) ?? [];
      arr.push(img.url);
      imageMap.set(img.listing_id, arr);
    }

    return listingRows.results.map(row => ({
      id: row.id,
      slug: row.slug,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip ?? '',
      price: row.price,
      beds: row.beds,
      baths: row.baths,
      sqft: row.sqft ?? 0,
      description: row.description ?? '',
      images: imageMap.get(row.id) ?? [],
      videoUrl: row.video_url ?? undefined,
      featured: row.featured === 1,
      createdAt: new Date(row.created_at * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('getAllListings D1 error:', error);
    return [];
  }
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const row = await db.prepare(
      `SELECT l.id, l.slug, l.address, l.city, l.state, l.zip,
              l.price, l.beds, l.baths, l.sqft, l.description,
              l.video_url, l.created_at, l.featured
       FROM listings l
       JOIN agents a ON l.agent_id = a.id
       WHERE l.slug = ?
         AND l.status = 'active'
         AND ${AGENT_PUBLISHABLE_SQL}`
    ).bind(slug).first<ListingRow>();

    if (!row) return null;

    const imageRows = await db.prepare(
      `SELECT url FROM listing_images WHERE listing_id = ? ORDER BY display_order ASC`
    ).bind(row.id).all<{ url: string }>();

    return {
      id: row.id,
      slug: row.slug,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip ?? '',
      price: row.price,
      beds: row.beds,
      baths: row.baths,
      sqft: row.sqft ?? 0,
      description: row.description ?? '',
      images: imageRows.results.map(r => r.url),
      videoUrl: row.video_url ?? undefined,
      featured: row.featured === 1,
      createdAt: new Date(row.created_at * 1000).toISOString(),
    };
  } catch (error) {
    console.error(`getListingBySlug D1 error for "${slug}":`, error);
    return null;
  }
}

export async function getFeaturedListings(): Promise<Listing[]> {
  const all = await getAllListings();
  return all.filter(l => l.featured);
}

export async function filterListings(filters: FilterOptions): Promise<Listing[]> {
  const all = await getAllListings();
  return all.filter(l => {
    if (filters.minPrice !== undefined && l.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && l.price > filters.maxPrice) return false;
    if (filters.minBeds !== undefined && l.beds < filters.minBeds) return false;
    return true;
  });
}

// Retained for test teardown compatibility — no-op with D1
export function clearListingsCache(): void {}
```

### The `featured` Column

The D1 schema (`0001_initial_schema.sql`) does NOT have a `featured` column. Recommendation (Claude's discretion): add via a new migration before the seed.

```sql
-- db/migrations/0002_add_featured_column.sql
ALTER TABLE listings ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
```

This preserves the `Listing.featured: boolean` contract. The seed sets `featured=1` for the riverside-terrace listing only (the one JSON file with `"featured": true`).

---

## Domain 3: force-dynamic Public Pages

### Converting /listings/[slug]/page.tsx

```typescript
// Add at top of file:
export const dynamic = 'force-dynamic';
// No runtime = 'edge' — @opennextjs/cloudflare ignores it on pages

// REMOVE entirely:
export async function generateStaticParams(): Promise<{ slug: string }[]> { ... }
// Also remove the getAllListings import (no longer needed by this file)

// The page component and generateMetadata already use async params correctly:
// params: Promise<{ slug: string }>  <- already in file, keep as-is
// const { slug } = await params;     <- already in file, keep as-is
// getListingBySlug(slug)             <- already in file, keep as-is
```

### Converting /listings/page.tsx

Current page is `'use client'` and loads JSON in `useEffect`. With D1, data must come from the server. Convert to RSC + extract client state into a separate component:

```typescript
// src/app/listings/page.tsx — new RSC
export const dynamic = 'force-dynamic';
// Remove: 'use client', useState, useEffect, useCallback, useMemo

import { getAllListings } from '@/lib/data';
import ListingsClient from './ListingsClient';

export default async function ListingsPage() {
  const listings = await getAllListings();
  return <ListingsClient initialListings={listings} />;
}
```

```typescript
// src/app/listings/ListingsClient.tsx — new 'use client' component
'use client';
// Contains: useState for filters, filterListingsClientSide, FilterBar, ListingCard grid
// Accepts: initialListings: Listing[]
// Identical render logic to current page.tsx, just promoted to a separate file
```

---

## Domain 4: JSON→D1 Seed Migration

### Title Derivation

D1 `listings.title NOT NULL` — derive from the JSON data deterministically:

| JSON listing | Derived title |
|---|---|
| riverside-terrace-modern-craftsman | `'Modern Craftsman at 2611 Wichita Street'` |
| heights-bungalow-historic | `'Historic Bungalow at 1421 Ashland Street'` |
| sugarland-estate-pool | `'Estate with Pool at 1523 Riverstone Ranch Drive'` |

### Admin UID Resolution

Use `(SELECT id FROM agents WHERE is_admin = 1 LIMIT 1)` as the `agent_id` subquery. Avoids hardcoding a UID and handles any admin UID dynamically.

**Prerequisite:** Bernard must log in at least once AND `set-admin-claim` script must have run (setting `is_admin = 1`) BEFORE applying this seed migration.

### Seed SQL (idempotent — INSERT OR IGNORE on slug)

```sql
-- db/migrations/0003_seed_legacy_listings.sql
-- Idempotent seed of 3 legacy JSON listings into D1.
-- PREREQUISITE: Bernard's agents row must exist with is_admin=1.
-- Run: wrangler d1 migrations apply DB --local  (dev)
--      wrangler d1 migrations apply DB --remote (prod, after Bernard logs in)

INSERT OR IGNORE INTO listings (
  id, agent_id, title, slug, address, city, state, zip,
  price, beds, baths, sqft, description, status, featured, created_at, updated_at
) VALUES (
  'seed-listing-1',
  (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1),
  'Modern Craftsman at 2611 Wichita Street',
  'riverside-terrace-modern-craftsman',
  '2611 Wichita Street', 'Houston', 'TX', '77004',
  785000, 4, 3.5, 3200,
  'Stunning modern craftsman home in the historic Riverside Terrace neighborhood...',
  'active', 1,
  strftime('%s', '2025-02-15T10:00:00Z'), unixepoch()
);

INSERT OR IGNORE INTO listings (
  id, agent_id, title, slug, address, city, state, zip,
  price, beds, baths, sqft, description, status, featured, created_at, updated_at
) VALUES (
  'seed-listing-2',
  (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1),
  'Historic Bungalow at 1421 Ashland Street',
  'heights-bungalow-historic',
  '1421 Ashland Street', 'Houston', 'TX', '77008',
  625000, 3, 2, 1850,
  'Charming 1920s bungalow in the heart of the Heights...',
  'active', 0,
  strftime('%s', '2025-02-28T14:30:00Z'), unixepoch()
);

INSERT OR IGNORE INTO listings (
  id, agent_id, title, slug, address, city, state, zip,
  price, beds, baths, sqft, description, status, video_url, featured, created_at, updated_at
) VALUES (
  'seed-listing-3',
  (SELECT id FROM agents WHERE is_admin = 1 LIMIT 1),
  'Estate with Pool at 1523 Riverstone Ranch Drive',
  'sugarland-estate-pool',
  '1523 Riverstone Ranch Drive', 'Sugar Land', 'TX', '77479',
  925000, 5, 4, 4100,
  'Exceptional family estate in the sought-after Riverstone community...',
  'active', 'https://www.youtube.com/watch?v=example-tour-3', 0,
  strftime('%s', '2025-03-05T09:15:00Z'), unixepoch()
);

-- Images (display_order = original array index)
INSERT OR IGNORE INTO listing_images (id, listing_id, url, display_order) VALUES
  ('seed-img-1-0', 'seed-listing-1', 'https://picsum.photos/seed/houston1-1/1200/800', 0),
  ('seed-img-1-1', 'seed-listing-1', 'https://picsum.photos/seed/houston1-2/1200/800', 1),
  ('seed-img-1-2', 'seed-listing-1', 'https://picsum.photos/seed/houston1-3/1200/800', 2),
  ('seed-img-1-3', 'seed-listing-1', 'https://picsum.photos/seed/houston1-4/1200/800', 3),
  ('seed-img-1-4', 'seed-listing-1', 'https://picsum.photos/seed/houston1-5/1200/800', 4),
  ('seed-img-2-0', 'seed-listing-2', 'https://picsum.photos/seed/houston2-1/1200/800', 0),
  ('seed-img-2-1', 'seed-listing-2', 'https://picsum.photos/seed/houston2-2/1200/800', 1),
  ('seed-img-2-2', 'seed-listing-2', 'https://picsum.photos/seed/houston2-3/1200/800', 2),
  ('seed-img-2-3', 'seed-listing-2', 'https://picsum.photos/seed/houston2-4/1200/800', 3),
  ('seed-img-3-0', 'seed-listing-3', 'https://picsum.photos/seed/houston3-1/1200/800', 0),
  ('seed-img-3-1', 'seed-listing-3', 'https://picsum.photos/seed/houston3-2/1200/800', 1),
  ('seed-img-3-2', 'seed-listing-3', 'https://picsum.photos/seed/houston3-3/1200/800', 2),
  ('seed-img-3-3', 'seed-listing-3', 'https://picsum.photos/seed/houston3-4/1200/800', 3),
  ('seed-img-3-4', 'seed-listing-3', 'https://picsum.photos/seed/houston3-5/1200/800', 4);
```

---

## Domain 5: Listing CRUD Routes

### Pattern: follow /api/agent/profile/route.ts

The profile route at `src/app/api/agent/profile/route.ts` is the canonical template:
- `export const runtime = 'edge'`
- `getTokens(await cookies(), authEdgeConfig)` for session
- `getCloudflareContext({ async: true })` for D1
- Parameterized `env.DB.prepare().bind()`
- Typed `NextResponse.json()` with explicit status codes

### Ownership Enforcement (403 on Cross-Agent)

```typescript
// Before any mutation on /api/agent/listings/[id]:
const existing = await env.DB.prepare(
  'SELECT agent_id FROM listings WHERE id = ?'
).bind(id).first<{ agent_id: string }>();

if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
if (existing.agent_id !== uid) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
```

### Publishability Gate on Create

```typescript
// In POST /api/agent/listings:
import { getAgentSubscriptionState, isAgentPublishable } from '@/lib/subscription';

const agent = await getAgentSubscriptionState(env.DB, uid);
if (!agent || !isAgentPublishable(agent)) {
  return NextResponse.json(
    { success: false, message: 'Active subscription required to create listings.' },
    { status: 403 }
  );
}
```

### Pause/Activate Toggle

```typescript
// PATCH /api/agent/listings/[id] with body { status: 'active' | 'paused' }
if (status !== 'active' && status !== 'paused') {
  return NextResponse.json({ success: false, message: 'Invalid status value.' }, { status: 400 });
}
await env.DB.prepare(
  `UPDATE listings SET status = ?, updated_at = unixepoch() WHERE id = ? AND agent_id = ?`
).bind(status, id, uid).run();
```

### Photo URLs (multiple) to listing_images rows

On create: INSERT each URL with display_order = index.
On edit: DELETE all existing images for the listing, then re-INSERT. The `ON DELETE CASCADE` is for the listing row deletion, not image replacement — so DELETE by listing_id directly:

```typescript
await env.DB.prepare('DELETE FROM listing_images WHERE listing_id = ?').bind(listingId).run();
for (let i = 0; i < imageUrls.length; i++) {
  await env.DB.prepare(
    `INSERT INTO listing_images (id, listing_id, url, display_order) VALUES (?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), listingId, imageUrls[i], i).run();
}
```

---

## Domain 6: The 4 Failing Tests

### Root Cause (verified by running npm test — 784 pass, 4 fail)

All 4 failures are in `src/tests/listing-detail-page.test.ts`. They are source-text grep assertions that check for string patterns that no longer match the current file because Next.js 15 changed params from synchronous to asynchronous.

| Suite | Test description | Asserts string | Actual file content | Why failing |
|-------|-----------------|---------------|---------------------|-------------|
| generateMetadata | "should accept params with slug" | `params: { slug: string }` | `params: Promise<{ slug: string }>` | Sync vs async params type |
| generateMetadata | "should call getListingBySlug" | `getListingBySlug(params.slug)` | `getListingBySlug(slug)` (after `await params`) | Params destructured first |
| Page Component | "should accept params with slug" | `params: { slug: string }` | `params: Promise<{ slug: string }>` | Same sync vs async |
| Page Component | "should call getListingBySlug to fetch listing" | `getListingBySlug(params.slug)` | `getListingBySlug(slug)` | Same destructuring pattern |

Additionally, the `generateStaticParams` suite (3 tests asserting its existence) will fail once it is removed in Phase 4. Those 3 tests are currently passing only because `generateStaticParams` still exists. They must be updated.

### Correct Test Fixes

```typescript
// generateStaticParams suite — change from "should exist" to "should NOT exist"
it('should NOT export generateStaticParams (force-dynamic removes static generation)', () => {
  const content = readFileSync(pagePath, 'utf-8');
  assert.ok(
    !content.includes('export async function generateStaticParams'),
    'generateStaticParams must be absent for force-dynamic pages'
  );
});

// generateMetadata / Page Component params tests — update to async pattern
it('should accept params as Promise<{ slug: string }>', () => {
  const content = readFileSync(pagePath, 'utf-8');
  assert.ok(
    content.includes('params: Promise<{ slug: string }>'),
    'Should use Next.js 15 async params pattern'
  );
});

it('should call getListingBySlug with awaited slug', () => {
  const content = readFileSync(pagePath, 'utf-8');
  assert.ok(
    content.includes('const { slug } = await params') &&
    content.includes('getListingBySlug(slug)'),
    'Should destructure slug via await params then pass to getListingBySlug'
  );
});

// Imports test — getAllListings is no longer imported by the detail page
it('should import getListingBySlug from lib/data', () => {
  const content = readFileSync(pagePath, 'utf-8');
  assert.ok(
    content.includes("from '@/lib/data'") && content.includes('getListingBySlug'),
    'Should import getListingBySlug from @/lib/data'
  );
});
```

[VERIFIED: direct test file read + npm test output confirming exact 4 failure messages]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP integration | Resend REST API via `fetch` | DNS/DKIM/deliverability handled by Resend |
| SQL injection prevention | String interpolation in queries | D1 `.prepare().bind()` — established pattern | Parameterized queries only safe approach |
| UUID generation | Custom ID generation | `crypto.randomUUID()` | Web Crypto API built into Workers runtime and Node.js 20+ |
| Session / uid derivation | Parsing cookies manually | `getTokens()` from next-firebase-auth-edge | Handles verification, expiry, key rotation |
| Ownership enforcement | Custom RBAC system | `WHERE agent_id = ?` bound to session uid | Simple and sufficient for this data model |
| Image ordering | Custom sort | `display_order INTEGER` column + `ORDER BY display_order ASC` | Already in schema |
| Publishability check | Duplicate SQL logic | `AGENT_PUBLISHABLE_SQL` from `src/lib/subscription.ts` | Already defined, tested in Phase 3 |

---

## Common Pitfalls

| # | Pitfall | What Goes Wrong | Prevention |
|---|---------|----------------|------------|
| P1 | **`output:'export'` ghost** | Developer adds `output: 'export'` back to next.config "to be safe", breaking all dynamic routes and API routes | CONFIRMED ABSENT from next.config.mjs. Never re-add it. @opennextjs/cloudflare handles deployment without it |
| P2 | **D1 binding outside Worker context** | `getCloudflareContext()` throws or returns empty env when called in a pure Node.js test context | Always use `{ async: true }` param; dev overlay via `initOpenNextCloudflareForDev()` already in next.config; mock in tests |
| P3 | **Resend from-domain not verified** | Emails fail silently; Resend returns 403 "domain not verified" | Verify sending domain in Resend dashboard before deploying; keep as best-effort so it does not block the buyer response |
| P4 | **Images JOIN returns N rows per listing** | `SELECT l.*, li.url FROM listings l LEFT JOIN listing_images li ON l.id = li.listing_id` returns one row per image, not one row with an images array | Use two separate queries + in-memory Map grouping as shown in Domain 2 patterns |
| P5 | **`featured` column missing** | `SELECT l.featured` fails with "no such column: l.featured" if migration 0002 not applied first | Apply `0002_add_featured_column.sql` before `0003_seed_legacy_listings.sql`. Migration order matters |
| P6 | **Resend timeout blocks buyer response** | Resend has a 30s default timeout; a slow Resend response hangs the buyer's form submit | Use `Promise.allSettled([sendEmail(), sendPerfex()])` — both are awaited but errors caught individually; buyer response sent after both complete (fast on success, still fast when they fail with error logging) |
| P7 | **Perfex + D1 dual-write inconsistency** | D1 insert succeeds but Perfex fails → lead exists in D1 but not Perfex | Accepted per CONTEXT.md — D1 is source of truth. Dashboard lead inbox reads D1. Log Perfex failures. |
| P8 | **`runtime = 'edge'` on public RSC pages** | @opennextjs/cloudflare ignores it on pages but it creates confusion about which directive applies where | `runtime = 'edge'` on API routes only (established pattern). Public pages and layouts use `force-dynamic` only. |
| P9 | **`/listings/page.tsx` breaking FilterBar** | Converting from `'use client'` to RSC without extracting filter state — FilterBar needs `useState` | Extract to `ListingsClient.tsx` (`'use client'`); RSC fetches listings and passes as `initialListings` prop |
| P10 | **Seed migration before admin agents row** | `(SELECT id FROM agents WHERE is_admin = 1 LIMIT 1)` returns NULL → NOT NULL constraint on `agent_id` | Run seed AFTER: (1) Bernard logs in once (agents row created), (2) set-admin-claim runs (`is_admin=1`). Document sequencing in migration comment |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| `output: 'export'` static SSG | `@opennextjs/cloudflare` dynamic Workers | Migrated in Phase 1; ABSENT from next.config.mjs |
| JSON file dynamic imports for listings | D1 SQL queries in RSC | This phase's change |
| `params.slug` (sync, Next.js 14 pattern) | `const { slug } = await params` (async, Next.js 15) | Already in codebase; tests need updating to match |
| `@cloudflare/next-on-pages` | `@opennextjs/cloudflare` | Already migrated in Phase 1 |
| `generateStaticParams` for slug pages | `force-dynamic` + per-request D1 | This phase's change |
| Listings cache (module-level `listingsCache`) | No cache — D1 reads per request | clearListingsCache() becomes a no-op |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Cloudflare D1 (local dev) | All D1 queries | Available via wrangler dev with `initOpenNextCloudflareForDev()` | Already configured in next.config.mjs |
| `wrangler` CLI | Migration apply | Available via npx | `npx wrangler d1 migrations apply DB --local` |
| Resend API | Email delivery | External — requires API key + domain verification | Bernard must create Resend account + verify sending domain |
| Perfex CRM | Existing lead delivery | Already configured | `PERFEX_RE_URL` + `PERFEX_RE_KEY` in .dev.vars |
| `crypto.randomUUID()` | ID generation | Available | Web Crypto built into Workers runtime and Node.js 20+ |

---

## New Env Vars Required

| Var | Purpose | Example | Where Set |
|-----|---------|---------|-----------|
| `RESEND_API_KEY` | Resend API authentication | `re_xxxxxxxx` | `.dev.vars` (dev), `wrangler secret put` (prod) |
| `LEAD_FROM_EMAIL` | Verified sending address | `leads@houstonhomespotlight.com` | `.dev.vars` / wrangler secret |
| `ADMIN_NOTIFY_EMAIL` | Bernard's CC address | `bernardcpa@gmail.com` | `.dev.vars` / wrangler secret |

Existing vars (`PERFEX_RE_URL`, `PERFEX_RE_KEY`, `DB` binding) are unchanged.

---

## LeadFormData Type Note

`LeadFormData` has `listingSlug?: string` — sufficient. The API resolves `listing_id` from the slug via D1 (one extra query) rather than requiring the client to supply a UUID. This keeps `InquiryForm.tsx` unchanged.

Note: `leads` table has `listing_id NOT NULL` and `agent_id NOT NULL`. The API must require `listingSlug` in the request body (return 400 if absent) because it cannot insert a lead without a valid listing_id. The general `/contact` page uses a separate mechanism — verify by reading `src/app/contact/page.tsx` during the planning task for the leads route.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | YES | Session-derived uid; ownership check `SELECT agent_id WHERE id = ?` before any mutation; 403 on mismatch |
| V5 Input Validation | YES | Required field validation + email regex (existing); URL scheme allowlist for photo URLs (pattern from profile route: `isSafeHttpUrl()`) |
| V2 Authentication | YES | `getTokens()` from next-firebase-auth-edge — established pattern |
| V6 Cryptography | No | No new crypto operations |

| Threat Pattern | STRIDE | Mitigation |
|----------------|--------|------------|
| Cross-agent listing edit/delete | Tampering | Ownership check before mutation: `SELECT agent_id FROM listings WHERE id = ?` |
| Unpublishable agent creates listings | Elevation of Privilege | `isAgentPublishable()` gate in POST /api/agent/listings |
| SQL injection via listing fields | Tampering | D1 `.prepare().bind()` throughout — no string concatenation |
| XSS via listing description | Tampering | RSC renders text via React (auto-escaped); JSON-LD built server-side from trusted DB values |
| Forged listing_id in lead submission | Spoofing | API resolves listing_id from slug via D1 — never trusts a body-supplied UUID |
| Resend API key exposure | Information Disclosure | Env var only; never logged; never sent to client |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resend REST API at `https://api.resend.com/emails` works via raw `fetch` in Workers with no SDK | Domain 1 | Low — REST APIs always work in Workers; confirmed by CONTEXT.md established patterns note |
| A2 | Awaiting `Promise.allSettled([email, perfex])` before returning the response is the correct Workers best-effort pattern | Domain 1 | Low — allSettled catches errors; the only downside vs. background promise is latency, which is acceptable |
| A3 | `src/app/contact/page.tsx` uses a different mechanism than `/api/leads`, so requiring `listingSlug` in `/api/leads` is safe | LeadFormData section | Medium — read `src/app/contact/page.tsx` during planning to confirm |
| A4 | `strftime('%s', '<ISO string>')` converts ISO 8601 to epoch seconds in D1 (SQLite-compatible) | Domain 4 seed SQL | Low — standard SQLite; fallback is hardcoded integer epoch in migration |

---

## Open Questions

1. **General contact form:** Does `src/app/contact/page.tsx` POST to `/api/leads`? If yes, the route must handle a missing `listingSlug` gracefully (or the contact form needs a separate route). Read that file during the planning task for the leads route extension.

2. **Resend domain verification:** Has Bernard verified a sending domain with Resend? Email delivery cannot be tested end-to-end without this. Should be completed before the human verification step at phase end.

3. **listings-client RSC/client split:** The `/listings` page currently mixes client state and data loading. The RSC refactor requires creating `ListingsClient.tsx`. Confirm this does not regress the filtering UX during planning.

---

## Sources

### Primary (HIGH confidence — verified by direct codebase read)
- `next.config.mjs` — confirms `output: 'export'` is ABSENT
- `src/app/api/agent/profile/route.ts` — canonical pattern for edge API routes + D1 binding
- `src/app/(dashboard)/layout.tsx` — canonical pattern for D1 access in RSC
- `src/lib/subscription.ts` — AGENT_PUBLISHABLE_SQL definition and usage
- `db/migrations/0001_initial_schema.sql` — exact schema for all tables
- `src/tests/listing-detail-page.test.ts` — exact failing assertion strings
- `src/app/listings/[slug]/page.tsx` — current params pattern (async, Next.js 15)
- `src/app/listings/page.tsx` — current 'use client' structure
- `src/lib/data.ts` — current JSON-backed function signatures
- `src/types/index.ts` — Listing, LeadFormData, FilterOptions interfaces
- All 3 JSON listing files — exact data for seed migration
- `npm test` output — confirms exactly 4 failures and their descriptions

### Secondary (MEDIUM confidence — training knowledge)
- Resend REST API endpoint and request/response shape
- Cloudflare Workers execution lifecycle behavior
- Next.js 15 async params pattern
- @opennextjs/cloudflare `force-dynamic` behavior

### Tertiary (LOW confidence — [ASSUMED])
- Workers promise behavior nuances post-response (A2 — conservative approach used)
- Contact page routing (A3 — marked for verification during planning)
