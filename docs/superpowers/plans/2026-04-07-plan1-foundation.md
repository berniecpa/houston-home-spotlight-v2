# Listing Automation — Plan 1: Foundation (D1 + Runtime Switch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static JSON listing files with Cloudflare D1 (SQLite), switch the Next.js site from static export to edge runtime, and migrate the 3 existing listings into D1 — leaving the public site looking and behaving identically.

**Architecture:** The Next.js site removes `output: 'export'` from `next.config.mjs` and adds `export const runtime = 'edge'` to pages that query listings. `src/lib/listings.ts` replaces hardcoded JSON imports with D1 queries via a `getDB()` helper. Existing public pages and components are untouched except for the runtime declaration.

**Tech Stack:** Cloudflare D1 (SQLite), `@cloudflare/next-on-pages` (already installed), `wrangler` CLI, `tsx` + `node:test` for tests.

---

### Task 0: Install tsx for TypeScript test execution

**Files:**
- Modify: `package.json`

The project uses `node --test` which cannot import TypeScript modules directly. New tests need to import TS modules (D1 mocks, auth helpers). Install `tsx` to enable this.

- [ ] **Step 1: Install tsx**

```bash
npm install --save-dev tsx
```

- [ ] **Step 2: Update test script in package.json**

Change the `"test"` script from:
```json
"test": "node --test"
```
To:
```json
"test": "npx tsx --test src/tests/*.test.ts"
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npm test
```

Expected: All existing tests pass (the file-based tests are TypeScript-compatible with tsx).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add tsx for TypeScript-aware test execution"
```

---

### Task 1: Create wrangler.toml and local dev secrets

**Files:**
- Create: `wrangler.toml`
- Create: `.dev.vars`
- Modify: `.gitignore`

- [ ] **Step 1: Create wrangler.toml**

```toml
name = "houston-home-spotlight"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[[d1_databases]]
binding = "DB"
database_name = "houston-listings"
database_id = "PLACEHOLDER"

[[r2_buckets]]
binding = "R2"
bucket_name = "houston-listings-images"
```

- [ ] **Step 2: Create D1 database and update the database_id**

Run:
```bash
npx wrangler d1 create houston-listings
```

Expected output contains a line like:
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Replace `PLACEHOLDER` in `wrangler.toml` with the actual database_id.

- [ ] **Step 3: Create .dev.vars for local secrets**

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
SESSION_SECRET=dev-secret-minimum-32-characters-long
HAR_USERNAME=
HAR_PASSWORD=
HAR_RESO_URL=
ZILLOW_API_KEY=
ZILLOW_API_URL=
NOTIFICATION_WEBHOOK_URL=
```

- [ ] **Step 4: Add .dev.vars to .gitignore**

Open `.gitignore` and add:
```
.dev.vars
```

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml .gitignore
git commit -m "chore: add wrangler.toml with D1 and R2 bindings"
```

---

### Task 2: Create D1 schema and apply locally

**Files:**
- Create: `schema.sql`

- [ ] **Step 1: Create schema.sql**

```sql
CREATE TABLE IF NOT EXISTS listings (
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
  featured      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft',
  source        TEXT NOT NULL DEFAULT 'manual',
  source_id     TEXT,
  source_images TEXT NOT NULL DEFAULT '[]',
  images        TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_dedup
  ON listings(source, source_id)
  WHERE source_id IS NOT NULL;
```

- [ ] **Step 2: Apply schema to local D1**

```bash
npx wrangler d1 execute houston-listings --file=schema.sql --local
```

Expected output:
```
🌀 Executing on local database houston-listings...
✅ Applied migration
```

- [ ] **Step 3: Verify the table was created**

```bash
npx wrangler d1 execute houston-listings --command="SELECT name FROM sqlite_master WHERE type='table'" --local
```

Expected output includes `listings` in the results.

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "feat: add D1 schema for listings table"
```

---

### Task 3: Create src/lib/db.ts with testable D1 accessor

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/types/cloudflare.d.ts`
- Create: `src/tests/db.test.ts`

- [ ] **Step 1: Write the failing test**

`src/tests/db.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('db.ts', () => {
  it('should export getDB function', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'lib', 'db.ts'), 'utf-8');
    assert.ok(content.includes('export function getDB'), 'should export getDB');
  });

  it('should export setDB function for testing', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'lib', 'db.ts'), 'utf-8');
    assert.ok(content.includes('export function setDB'), 'should export setDB');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `db.ts` does not exist yet.

- [ ] **Step 3: Create src/types/cloudflare.d.ts**

```typescript
interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  HAR_USERNAME: string;
  HAR_PASSWORD: string;
  HAR_RESO_URL: string;
  ZILLOW_API_KEY: string;
  ZILLOW_API_URL: string;
  NOTIFICATION_WEBHOOK_URL: string;
}
```

- [ ] **Step 4: Create src/lib/db.ts**

```typescript
import { getRequestContext } from '@cloudflare/next-on-pages';

// Allows tests to inject a mock DB without module mocking
let _testDB: D1Database | null = null;

export function setDB(db: D1Database | null): void {
  _testDB = db;
}

export function getDB(): D1Database {
  if (_testDB) return _testDB;
  const ctx = getRequestContext();
  return (ctx.env as CloudflareEnv).DB;
}

export function getEnv(): CloudflareEnv {
  const ctx = getRequestContext();
  return ctx.env as CloudflareEnv;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test
```

Expected: PASS for all db.ts tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/types/cloudflare.d.ts src/tests/db.test.ts
git commit -m "feat: add D1 db accessor with test injection support"
```

---

### Task 4: Rewrite src/lib/listings.ts to query D1

**Files:**
- Modify: `src/lib/listings.ts`
- Modify: `src/tests/listings.test.ts`
- Create: `src/tests/listings-d1.test.ts`

- [ ] **Step 1: Write the failing D1 test**

`src/tests/listings-d1.test.ts`:
```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setDB } from '../lib/db.ts';
import { loadListings, getListingBySlug, getFeaturedListings, filterListings } from '../lib/listings.ts';

// Minimal mock row matching D1 row structure
const mockRow = {
  id: 'test-1',
  slug: 'test-listing',
  address: '123 Main St',
  city: 'Houston',
  state: 'TX',
  zip: '77001',
  price: 500000,
  beds: 3,
  baths: 2,
  sqft: 1800,
  description: 'A test listing',
  video_url: null,
  featured: 0,
  status: 'published',
  source: 'manual',
  source_id: null,
  source_images: '[]',
  images: '["https://example.com/photo.jpg"]',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function makeMockDB(rows: typeof mockRow[]) {
  return {
    prepare: (sql: string) => ({
      all: async () => ({ results: rows }),
      bind: (..._args: unknown[]) => ({
        all: async () => ({ results: rows }),
        first: async () => rows[0] ?? null,
      }),
      first: async () => rows[0] ?? null,
    }),
  } as unknown as D1Database;
}

describe('listings.ts D1 queries', () => {
  beforeEach(() => setDB(makeMockDB([mockRow])));
  afterEach(() => setDB(null));

  it('loadListings returns mapped listings', async () => {
    const listings = await loadListings();
    assert.strictEqual(listings.length, 1);
    assert.strictEqual(listings[0].id, 'test-1');
    assert.strictEqual(listings[0].slug, 'test-listing');
    assert.strictEqual(listings[0].price, 500000);
    assert.deepStrictEqual(listings[0].images, ['https://example.com/photo.jpg']);
    assert.strictEqual(listings[0].featured, false);
  });

  it('getListingBySlug returns matching listing', async () => {
    const listing = await getListingBySlug('test-listing');
    assert.ok(listing);
    assert.strictEqual(listing.slug, 'test-listing');
  });

  it('getListingBySlug returns undefined for unknown slug', async () => {
    setDB(makeMockDB([]));
    const listing = await getListingBySlug('not-found');
    assert.strictEqual(listing, undefined);
  });

  it('getFeaturedListings returns featured listings', async () => {
    const featured = await getFeaturedListings();
    assert.strictEqual(featured.length, 1);
  });

  it('filterListings applies price filter', async () => {
    const results = await filterListings({ minPrice: 400000, maxPrice: 600000 });
    assert.strictEqual(results.length, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `listings.ts` still uses JSON imports, not D1.

- [ ] **Step 3: Rewrite src/lib/listings.ts**

```typescript
import { Listing, FilterOptions } from '@/types';
import { getDB } from '@/lib/db';

interface ListingRow {
  id: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  video_url: string | null;
  featured: number;
  images: string;
  created_at: string;
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    slug: row.slug,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    description: row.description,
    images: JSON.parse(row.images),
    videoUrl: row.video_url ?? undefined,
    featured: Boolean(row.featured),
    createdAt: row.created_at,
  };
}

export async function loadListings(): Promise<Listing[]> {
  const db = getDB();
  const result = await db
    .prepare("SELECT * FROM listings WHERE status = 'published' ORDER BY created_at DESC")
    .all<ListingRow>();
  return result.results.map(rowToListing);
}

export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  const db = getDB();
  const row = await db
    .prepare("SELECT * FROM listings WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<ListingRow>();
  return row ? rowToListing(row) : undefined;
}

export async function getFeaturedListings(): Promise<Listing[]> {
  const db = getDB();
  const result = await db
    .prepare("SELECT * FROM listings WHERE status = 'published' AND featured = 1 ORDER BY created_at DESC")
    .all<ListingRow>();
  return result.results.map(rowToListing);
}

export async function filterListings(filters: FilterOptions): Promise<Listing[]> {
  const db = getDB();
  const conditions: string[] = ["status = 'published'"];
  const params: (string | number)[] = [];

  if (filters.minPrice !== undefined) {
    conditions.push('price >= ?');
    params.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push('price <= ?');
    params.push(filters.maxPrice);
  }
  if (filters.minBeds !== undefined) {
    conditions.push('beds >= ?');
    params.push(filters.minBeds);
  }

  const query = `SELECT * FROM listings WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
  const result = await db.prepare(query).bind(...params).all<ListingRow>();
  return result.results.map(rowToListing);
}
```

- [ ] **Step 4: Update src/tests/listings.test.ts**

In the `Data Loader Module` describe block, update the test that checks for `clearListingsCache` — remove that assertion since we no longer cache:

Find this section:
```typescript
it('should contain required function exports in listings.ts', () => {
  // ...
  assert.ok(content.includes('export function clearListingsCache'), 'should export clearListingsCache');
});
```

Replace with:
```typescript
it('should contain required function exports in listings.ts', () => {
  const utilsDir = path.join(__dirname, '..', 'lib');
  const content = fs.readFileSync(path.join(utilsDir, 'listings.ts'), 'utf-8');

  assert.ok(content.includes('export async function loadListings'), 'should export loadListings');
  assert.ok(content.includes('export async function getListingBySlug'), 'should export getListingBySlug');
  assert.ok(content.includes('export async function getFeaturedListings'), 'should export getFeaturedListings');
  assert.ok(content.includes('export async function filterListings'), 'should export filterListings');
});
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
npm test
```

Expected: All tests pass including the new D1 mock tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/listings.ts src/tests/listings.test.ts src/tests/listings-d1.test.ts
git commit -m "feat: replace static JSON imports with D1 queries in listings.ts"
```

---

### Task 5: Switch Next.js from static export to edge runtime

**Files:**
- Modify: `next.config.mjs`
- Modify: `src/app/page.tsx`
- Modify: `src/app/listings/page.tsx`
- Modify: `src/app/listings/[slug]/page.tsx` (if it exists)
- Modify: `src/app/api/leads/route.ts`

- [ ] **Step 1: Update next.config.mjs**

Replace the entire file with:
```javascript
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

- [ ] **Step 2: Add edge runtime to public pages**

At the top of `src/app/page.tsx`, add:
```typescript
export const runtime = 'edge';
```

At the top of `src/app/listings/page.tsx`, add:
```typescript
export const runtime = 'edge';
```

Find the listing detail page (check `src/app/listings/[slug]/page.tsx`). If it exists, add:
```typescript
export const runtime = 'edge';
```

At the top of `src/app/api/leads/route.ts`, add:
```typescript
export const runtime = 'edge';
```

- [ ] **Step 3: Run build to verify no compile errors**

```bash
npm run build
```

Expected: Build completes without errors. (It will warn that D1 is not bound locally — that's expected until the migration runs.)

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs src/app/page.tsx src/app/listings/page.tsx src/app/api/leads/route.ts
git add src/app/listings/
git commit -m "feat: switch to Cloudflare edge runtime, remove static export"
```

---

### Task 6: Migrate existing JSON listings to D1

**Files:**
- Create: `scripts/migrate-json-to-d1.sql`

- [ ] **Step 1: Create the migration SQL file**

`scripts/migrate-json-to-d1.sql`:
```sql
INSERT OR IGNORE INTO listings
  (id, slug, address, city, state, zip, price, beds, baths, sqft,
   description, video_url, featured, status, source, source_id,
   source_images, images, created_at, updated_at)
VALUES
  (
    '1',
    'riverside-terrace-modern-craftsman',
    '2611 Wichita Street',
    'Houston', 'TX', '77004',
    785000, 4, 3.5, 3200,
    'Stunning modern craftsman home in the historic Riverside Terrace neighborhood. This beautifully renovated property features an open-concept living space with vaulted ceilings, a chef''s kitchen with quartz countertops and stainless steel appliances, and a spacious master suite with a spa-like bathroom. The backyard oasis includes a covered patio, perfect for entertaining. Walking distance to Hermann Park and the Medical Center. Move-in ready with recent updates including new HVAC, roof, and energy-efficient windows.',
    NULL,
    1,
    'published', 'manual', NULL,
    '["https://picsum.photos/seed/houston1-1/1200/800","https://picsum.photos/seed/houston1-2/1200/800","https://picsum.photos/seed/houston1-3/1200/800","https://picsum.photos/seed/houston1-4/1200/800","https://picsum.photos/seed/houston1-5/1200/800"]',
    '["https://picsum.photos/seed/houston1-1/1200/800","https://picsum.photos/seed/houston1-2/1200/800","https://picsum.photos/seed/houston1-3/1200/800","https://picsum.photos/seed/houston1-4/1200/800","https://picsum.photos/seed/houston1-5/1200/800"]',
    '2025-02-15T10:00:00Z',
    '2025-02-15T10:00:00Z'
  ),
  (
    '2',
    'heights-bungalow-historic',
    '1421 Ashland Street',
    'Houston', 'TX', '77008',
    625000, 3, 2, 1850,
    'Charming 1920s bungalow in the heart of the Heights! This meticulously maintained home retains its original character with hardwood floors, vintage light fixtures, and a cozy front porch. Updated kitchen with farmhouse sink and butcher block counters. Large lot with mature oak trees and a detached garage with potential for workshop or studio space. Blocks from Heights Boulevard''s hike and bike trail, local boutiques, and award-winning restaurants. Zoned to top-rated Harvard Elementary.',
    NULL,
    0,
    'published', 'manual', NULL,
    '["https://picsum.photos/seed/houston2-1/1200/800","https://picsum.photos/seed/houston2-2/1200/800","https://picsum.photos/seed/houston2-3/1200/800","https://picsum.photos/seed/houston2-4/1200/800"]',
    '["https://picsum.photos/seed/houston2-1/1200/800","https://picsum.photos/seed/houston2-2/1200/800","https://picsum.photos/seed/houston2-3/1200/800","https://picsum.photos/seed/houston2-4/1200/800"]',
    '2025-02-28T14:30:00Z',
    '2025-02-28T14:30:00Z'
  ),
  (
    '3',
    'sugarland-estate-pool',
    '1523 Riverstone Ranch Drive',
    'Sugar Land', 'TX', '77479',
    925000, 5, 4, 4100,
    'Exceptional family estate in the sought-after Riverstone community! This spacious home offers 5 bedrooms plus a study, formal dining, and a massive game room upstairs. Gourmet kitchen features double ovens, gas cooktop, and walk-in pantry. Primary retreat downstairs with sitting area and luxurious bath. Resort-style backyard with saltwater pool, spa, and summer kitchen. Excellent Fort Bend ISD schools and resort-style community amenities including pools, tennis courts, and walking trails. Easy access to Highway 59 and a short commute to the Medical Center and Galleria.',
    'https://www.youtube.com/watch?v=example-tour-3',
    0,
    'published', 'manual', NULL,
    '["https://picsum.photos/seed/houston3-1/1200/800","https://picsum.photos/seed/houston3-2/1200/800","https://picsum.photos/seed/houston3-3/1200/800","https://picsum.photos/seed/houston3-4/1200/800","https://picsum.photos/seed/houston3-5/1200/800"]',
    '["https://picsum.photos/seed/houston3-1/1200/800","https://picsum.photos/seed/houston3-2/1200/800","https://picsum.photos/seed/houston3-3/1200/800","https://picsum.photos/seed/houston3-4/1200/800","https://picsum.photos/seed/houston3-5/1200/800"]',
    '2025-03-05T09:15:00Z',
    '2025-03-05T09:15:00Z'
  );
```

- [ ] **Step 2: Apply migration to local D1**

```bash
npx wrangler d1 execute houston-listings --file=scripts/migrate-json-to-d1.sql --local
```

Expected:
```
🌀 Executing on local database houston-listings...
✅ Applied migration
```

- [ ] **Step 3: Verify data is in D1**

```bash
npx wrangler d1 execute houston-listings --command="SELECT id, slug, status, source FROM listings" --local
```

Expected: 3 rows, all `status = published`, all `source = manual`.

- [ ] **Step 4: Apply schema and migration to remote D1 (production)**

```bash
npx wrangler d1 execute houston-listings --file=schema.sql
npx wrangler d1 execute houston-listings --file=scripts/migrate-json-to-d1.sql
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-json-to-d1.sql
git commit -m "feat: SQL migration script for existing listings to D1"
```

---

### Task 7: Verify full local dev works end-to-end

- [ ] **Step 1: Run the Cloudflare dev server**

```bash
npm run pages:build && npx wrangler pages dev
```

Expected: Server starts, no D1 binding errors.

- [ ] **Step 2: Check home page loads**

Visit `http://localhost:8788` — verify the featured listing appears (Riverside Terrace Modern Craftsman).

- [ ] **Step 3: Check listings page**

Visit `http://localhost:8788/listings` — verify all 3 listings appear.

- [ ] **Step 4: Check a listing detail page**

Visit `http://localhost:8788/listings/heights-bungalow-historic` — verify full listing details show.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit (if any fixes were needed during verification)**

```bash
git add -p
git commit -m "fix: resolve any issues found during local D1 verification"
```

---

**Plan 1 complete.** The public site now reads from D1. The 3 existing listings are live. The static JSON files in `src/data/listings/` can remain in the repo as reference but are no longer used by the application.

Proceed to Plan 2 (Admin Dashboard) next.
