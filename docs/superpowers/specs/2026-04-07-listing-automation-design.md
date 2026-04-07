# Listing Automation & Admin Dashboard — Design Spec

**Date:** 2026-04-07  
**Project:** Houston Home Spotlight v2  
**Status:** Approved

---

## 1. Overview

Automate the ingestion of real estate listings from multiple sources (HAR MLS, Zillow API, email alerts) into a semi-automated review workflow. Listings land as drafts in an admin dashboard where Bernard reviews, edits, and publishes them to the public site with a single click. Publishing is instant — no site rebuild required.

---

## 2. Architecture

```
Sources                    Cloudflare Edge              Public Site
─────────────────────────────────────────────────────────────────
HAR MLS (RESO API) ───┐
Zillow API ────────────┼──► Cron Workers ──► D1 Database ──► Next.js (edge)
Email Inbox ───────────┘    (every 30 min)   (draft/pub)     reads D1
RSS (future) ──────────┘
                              │
                         Admin Dashboard (/admin)
                         Review → Approve/Reject
                              │
                         R2 (optional image storage)
```

**Key architectural shift:** The Next.js site moves from `output: 'export'` (static) to Cloudflare Pages Functions (edge runtime). Pages query D1 at request time instead of importing hardcoded JSON files at build time. The public site appearance and behavior is unchanged.

---

## 3. Database Schema (Cloudflare D1)

```sql
CREATE TABLE listings (
  id            TEXT PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'TX',
  zip           TEXT NOT NULL,
  price         REAL NOT NULL,
  beds          INTEGER NOT NULL,
  baths         REAL NOT NULL,
  sqft          INTEGER NOT NULL,
  description   TEXT NOT NULL,
  video_url     TEXT,
  featured      INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean (0/1)

  -- Workflow status
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | published | rejected

  -- Ingestion metadata
  source        TEXT NOT NULL DEFAULT 'manual', -- har | zillow | email | rss | manual
  source_id     TEXT,          -- external ID for deduplication (MLS#, zpid, etc.)
  source_images TEXT NOT NULL DEFAULT '[]',  -- JSON array: original source image URLs
  images        TEXT NOT NULL DEFAULT '[]',  -- JSON array: final chosen image URLs (R2 or source)

  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Prevents duplicate imports from the same source
CREATE UNIQUE INDEX idx_source_dedup ON listings(source, source_id)
  WHERE source_id IS NOT NULL;
```

### Status Workflow
```
[ingestor] → draft → [admin reviews] → published (live on site)
                                     → rejected (hidden, kept for records)
```

---

## 4. Ingestion Workers

Three Cloudflare Workers running on a **30-minute cron schedule**. Each follows the same pattern:
1. Fetch listings from source API
2. Check `source_id` against D1 — skip if already exists
3. Map source fields → D1 schema
4. Insert new listings as `status: 'draft'`
5. Send notification if new drafts were added

### 4.1 HAR MLS Worker (`workers/ingest-har.ts`)

**Method:** RESO Web API (REST + OData), to be swapped for HAR MCP server when credentials become available.

**Env vars:**
- `HAR_USERNAME` — HAR member username
- `HAR_PASSWORD` — HAR member password  
- `HAR_RESO_URL` — RESO Web API base URL (e.g., `https://api.har.com/reso/odata`)

**Query:**
```
GET /Property?$filter=City eq 'Houston' and StandardStatus eq 'Active'
             &$expand=Media
             &$select=ListingKey,ListingId,UnparsedAddress,City,PostalCode,
                      ListPrice,BedroomsTotal,BathroomsTotalInteger,LivingArea,
                      PublicRemarks,VideosCount,VideoURL
```

**Field mapping:**
| RESO Field | Listing Field |
|---|---|
| `ListingKey` | `source_id` |
| `UnparsedAddress` | `address` |
| `PostalCode` | `zip` |
| `ListPrice` | `price` |
| `BedroomsTotal` | `beds` |
| `BathroomsTotalInteger` | `baths` |
| `LivingArea` | `sqft` |
| `PublicRemarks` | `description` |
| `VideoURL` | `video_url` |
| `Media[].MediaURL` | `source_images` |

**MCP upgrade path:** When HAR MCP server credentials are available, replace the RESO HTTP calls with MCP tool calls. The field mapping and D1 insert logic remain unchanged.

### 4.2 Zillow Worker (`workers/ingest-zillow.ts`)

**Env vars:**
- `ZILLOW_API_KEY`
- `ZILLOW_API_URL`

**Source ID:** Zillow's `zpid` field.

Maps Zillow response fields to the `Listing` schema. Stores Zillow photo URLs in `source_images`.

### 4.3 Email Worker (`workers/ingest-email.ts`)

**Method:** Cloudflare Email Routing forwards `listings@houstonhomespotlight.com` to this Worker.

Parses inbound emails (HTML + plaintext) from:
- HAR listing alert emails
- Zillow saved search notifications
- Realtor.com alerts
- Any other listing alert email

Uses structured regex patterns to extract: address, price, beds, baths, sqft, and any linked images or URLs. Email-sourced listings always land as `draft` (parsing is best-effort, not guaranteed accurate).

**Source ID:** SHA-256 hash of `from_address + subject + date` to prevent duplicate processing of forwarded/re-sent emails.

### 4.4 Notifications

All workers call a shared `notifyNewDrafts(count: number)` helper that sends a notification email to Bernard when new drafts are added. Implemented as a simple `fetch` to Cloudflare Email API or a configured webhook URL (`NOTIFICATION_WEBHOOK_URL` env var).

### 4.5 Future: RSS Worker

Placeholder for a future `workers/ingest-rss.ts` that polls configured RSS feed URLs stored in a `rss_feeds` D1 table. No implementation required now.

---

## 5. Admin Dashboard (`/admin`)

A protected section of the existing Next.js app.

### 5.1 Authentication

- **Login page:** `/admin/login` — username + password form
- **Validation:** compared against `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars
- **Session:** signed `HttpOnly` cookie using `SESSION_SECRET` env var (no database session storage)
- **Middleware:** `middleware.ts` intercepts all `/admin/*` routes, redirects to `/admin/login` if no valid session

### 5.2 Draft Queue (`/admin`)

- Table of all `status: 'draft'` listings
- Columns: address, price, beds/baths/sqft, source badge (HAR/Zillow/Email/Manual), date received
- Badge in header showing pending draft count
- Clicking a row opens the review screen

### 5.3 Listing Review (`/admin/listings/[id]`)

- **Preview panel:** renders the listing using the same component as the public detail page
- **Edit panel:** all fields editable (address, price, beds, baths, sqft, description, featured toggle, video URL)
- **Image panel:**
  - Displays all `source_images` (original URLs from MLS/Zillow)
  - Checkbox to select which images to keep
  - "Copy to R2" button per image — uploads to Cloudflare R2, replaces URL with R2 URL
  - Drag-to-reorder (first image = hero photo)
  - Final selected/ordered URLs saved to `images` field
- **Action buttons:**
  - **Publish** — sets `status: 'published'`, listing immediately visible on public site
  - **Save Draft** — saves edits, stays in draft
  - **Reject** — sets `status: 'rejected'`, removes from queue

### 5.4 Published Listings (`/admin/listings`)

- Table of all `status: 'published'` listings
- Edit any listing (same review form, pre-populated)
- Unpublish (reverts to `draft`)
- **Add Listing** button — opens blank review form for manual entry (`source: 'manual'`)

---

## 6. Public Site Changes

### 6.1 Runtime Switch

Remove `output: 'export'` from `next.config.js`. Add `@cloudflare/next-on-pages` adapter. Pages now run as Cloudflare Pages Functions (edge runtime).

### 6.2 Data Layer (`src/lib/listings.ts`)

Replace hardcoded JSON imports with D1 queries:

```ts
export async function loadListings(): Promise<Listing[]> {
  const db = getDB(); // Cloudflare D1 binding via env
  const result = await db.prepare(
    "SELECT * FROM listings WHERE status = 'published' ORDER BY created_at DESC"
  ).all();
  return result.results.map(rowToListing);
}

export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  const db = getDB();
  const row = await db.prepare(
    "SELECT * FROM listings WHERE slug = ? AND status = 'published'"
  ).bind(slug).first();
  return row ? rowToListing(row) : undefined;
}
```

All existing components, filters, pages, and the Perfex CRM lead form remain unchanged.

### 6.3 Migration Script (`scripts/migrate-json-to-d1.ts`)

Runs once on first deploy. Reads the 3 existing JSON files from `src/data/listings/` and inserts them into D1 as `status: 'published'`, `source: 'manual'`. Idempotent — skips records that already exist.

---

## 7. Environment Variables

| Variable | Purpose |
|---|---|
| `ADMIN_USERNAME` | Admin dashboard login username |
| `ADMIN_PASSWORD` | Admin dashboard login password |
| `SESSION_SECRET` | Signs the admin session cookie |
| `HAR_USERNAME` | HAR MLS RESO API username |
| `HAR_PASSWORD` | HAR MLS RESO API password |
| `HAR_RESO_URL` | HAR RESO Web API base URL |
| `ZILLOW_API_KEY` | Zillow API key |
| `ZILLOW_API_URL` | Zillow API base URL |
| `CLOUDFLARE_R2_BUCKET` | R2 bucket name for image storage |
| `NOTIFICATION_WEBHOOK_URL` | Webhook URL for new draft notifications |

---

## 8. What Does Not Change

- All existing UI components (`ListingCard`, `PhotoGallery`, `FilterBar`, etc.)
- All existing pages (`/`, `/listings`, `/listings/[slug]`, `/contact`)
- Perfex CRM lead form integration (`/api/leads`)
- Tailwind design system and responsive layout
- Cloudflare Pages deployment pipeline
- Umami analytics

---

## 9. Out of Scope (This Phase)

- RSS feed ingestion (infrastructure placeholder only)
- HAR MCP server integration (swap in when credentials available)
- Bulk editing of listings in admin
- Listing expiration / auto-unpublish
- Image cropping or editing in admin
- Multi-user admin access
