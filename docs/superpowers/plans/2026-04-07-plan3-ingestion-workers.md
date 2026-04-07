# Listing Automation — Plan 3: Ingestion Workers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three Cloudflare Workers that automatically pull new listings from HAR MLS (RESO Web API), Zillow API, and email (Cloudflare Email Routing) into D1 as drafts on a 30-minute schedule.

**Architecture:** Each worker is a standalone Cloudflare Worker with its own entry point in `workers/`. Shared logic (field normalization, deduplication, notifications) lives in `workers/lib/`. Cron triggers are defined in `wrangler.toml`. The email worker is triggered by Cloudflare Email Routing rather than a cron schedule. All workers write to the same D1 `listings` table used by the public site and admin dashboard.

**Tech Stack:** Cloudflare Workers, Cloudflare D1 (shared with site), Cloudflare Email Routing, `wrangler` CLI, `node:test`.

**Prerequisite:** Plans 1 and 2 must be complete — D1 schema exists and `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars are configured.

---

### Task 1: Shared worker utilities

**Files:**
- Create: `workers/lib/notify.ts`
- Create: `workers/lib/mapper.ts`
- Create: `workers/lib/dedup.ts`
- Create: `workers/tests/utils.test.ts`

- [ ] **Step 1: Write the failing test**

`workers/tests/utils.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';

const { slugify, normalizePrice } = await import('../lib/mapper.ts');
const { isDuplicate } = await import('../lib/dedup.ts');

describe('worker utilities', () => {
  describe('slugify', () => {
    it('converts address to URL slug', () => {
      assert.strictEqual(slugify('2611 Wichita Street, Houston TX'), '2611-wichita-street-houston-tx');
    });

    it('strips special characters', () => {
      assert.strictEqual(slugify('123 Oak & Elm Dr.'), '123-oak-elm-dr');
    });

    it('trims leading and trailing hyphens', () => {
      assert.strictEqual(slugify('  Main St  '), 'main-st');
    });
  });

  describe('normalizePrice', () => {
    it('returns number from number', () => {
      assert.strictEqual(normalizePrice(500000), 500000);
    });

    it('parses string with dollar sign', () => {
      assert.strictEqual(normalizePrice('$1,250,000'), 1250000);
    });

    it('returns 0 for invalid input', () => {
      assert.strictEqual(normalizePrice('N/A'), 0);
    });
  });

  describe('isDuplicate', () => {
    const mockDB = (found: boolean) => ({
      prepare: () => ({
        bind: () => ({
          first: async () => found ? { id: 'existing' } : null,
        }),
      }),
    }) as unknown as D1Database;

    it('returns true when source_id already exists', async () => {
      assert.strictEqual(await isDuplicate(mockDB(true), 'har', 'MLS123'), true);
    });

    it('returns false when source_id is new', async () => {
      assert.strictEqual(await isDuplicate(mockDB(false), 'har', 'MLS123'), false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd workers && node --test tests/utils.test.ts
```

Expected: FAIL — files don't exist.

- [ ] **Step 3: Create workers/lib/mapper.ts**

```typescript
import { randomUUID } from 'crypto';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizePrice(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function generateId(): string {
  return randomUUID();
}

export interface NormalizedListing {
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
  videoUrl: string | null;
  featured: number;
  status: 'draft';
  source: string;
  sourceId: string;
  sourceImages: string; // JSON string
  images: string;       // JSON string (empty initially)
  createdAt: string;
  updatedAt: string;
}

export function buildInsertSQL(listing: NormalizedListing): { sql: string; params: unknown[] } {
  const sql = `
    INSERT OR IGNORE INTO listings (
      id, slug, address, city, state, zip, price, beds, baths, sqft,
      description, video_url, featured, status, source, source_id,
      source_images, images, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    listing.id,
    listing.slug,
    listing.address,
    listing.city,
    listing.state,
    listing.zip,
    listing.price,
    listing.beds,
    listing.baths,
    listing.sqft,
    listing.description,
    listing.videoUrl,
    listing.featured,
    listing.status,
    listing.source,
    listing.sourceId,
    listing.sourceImages,
    listing.images,
    listing.createdAt,
    listing.updatedAt,
  ];
  return { sql, params };
}
```

- [ ] **Step 4: Create workers/lib/dedup.ts**

```typescript
export async function isDuplicate(db: D1Database, source: string, sourceId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM listings WHERE source = ? AND source_id = ?')
    .bind(source, sourceId)
    .first();
  return row !== null;
}
```

- [ ] **Step 5: Create workers/lib/notify.ts**

```typescript
export async function notifyNewDrafts(
  webhookUrl: string,
  source: string,
  count: number
): Promise<void> {
  if (!webhookUrl || count === 0) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${count} new draft listing(s) from ${source} are ready for review.\nhttps://houstonhomespotlight.com/admin`,
      }),
    });
  } catch {
    // Notification failure should not interrupt ingestion
    console.error(`Failed to send notification for ${source}`);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd workers && node --test tests/utils.test.ts
```

Expected: All utility tests pass.

- [ ] **Step 7: Commit**

```bash
git add workers/lib/ workers/tests/utils.test.ts
git commit -m "feat: add shared worker utilities (mapper, dedup, notify)"
```

---

### Task 2: Update wrangler.toml with cron triggers

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: Add cron triggers and worker entry points to wrangler.toml**

Append to the existing `wrangler.toml`:
```toml
# HAR MLS Ingestion Worker
[[workers]]
name = "ingest-har"
main = "workers/ingest-har.ts"

[[workers.triggers]]
crons = ["*/30 * * * *"]

[[workers.d1_databases]]
binding = "DB"
database_name = "houston-listings"
database_id = "YOUR_DATABASE_ID_HERE"

[workers.vars]
HAR_RESO_URL = ""

# Zillow Ingestion Worker
[[workers]]
name = "ingest-zillow"
main = "workers/ingest-zillow.ts"

[[workers.triggers]]
crons = ["*/30 * * * *"]

[[workers.d1_databases]]
binding = "DB"
database_name = "houston-listings"
database_id = "YOUR_DATABASE_ID_HERE"

# Email Ingestion Worker (triggered by Email Routing, not cron)
[[workers]]
name = "ingest-email"
main = "workers/ingest-email.ts"

[[workers.d1_databases]]
binding = "DB"
database_name = "houston-listings"
database_id = "YOUR_DATABASE_ID_HERE"
```

Note: Replace `YOUR_DATABASE_ID_HERE` with the same database_id from Task 1 of Plan 1.

- [ ] **Step 2: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add cron trigger config for ingestion workers"
```

---

### Task 3: HAR MLS RESO Worker

**Files:**
- Create: `workers/ingest-har.ts`
- Create: `workers/tests/ingest-har.test.ts`

- [ ] **Step 1: Write the failing test**

`workers/tests/ingest-har.test.ts`:
```typescript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

const { mapResoProperty } = await import('../ingest-har.ts');

describe('mapResoProperty', () => {
  const resoProperty = {
    ListingKey: 'HAR-123456',
    UnparsedAddress: '2611 Wichita Street',
    City: 'Houston',
    PostalCode: '77004',
    ListPrice: 785000,
    BedroomsTotal: 4,
    BathroomsTotalInteger: 3,
    LivingArea: 3200,
    PublicRemarks: 'Beautiful home in Houston.',
    VideoURL: null,
    Media: [
      { MediaURL: 'https://example.com/photo1.jpg', Order: 0 },
      { MediaURL: 'https://example.com/photo2.jpg', Order: 1 },
    ],
  };

  it('maps RESO fields to listing schema', () => {
    const result = mapResoProperty(resoProperty);
    assert.strictEqual(result.sourceId, 'HAR-123456');
    assert.strictEqual(result.address, '2611 Wichita Street');
    assert.strictEqual(result.city, 'Houston');
    assert.strictEqual(result.zip, '77004');
    assert.strictEqual(result.price, 785000);
    assert.strictEqual(result.beds, 4);
    assert.strictEqual(result.baths, 3);
    assert.strictEqual(result.sqft, 3200);
    assert.strictEqual(result.source, 'har');
    assert.strictEqual(result.status, 'draft');
  });

  it('maps media URLs to sourceImages', () => {
    const result = mapResoProperty(resoProperty);
    const images = JSON.parse(result.sourceImages);
    assert.strictEqual(images.length, 2);
    assert.strictEqual(images[0], 'https://example.com/photo1.jpg');
  });

  it('sets images to empty array initially', () => {
    const result = mapResoProperty(resoProperty);
    assert.deepStrictEqual(JSON.parse(result.images), []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd workers && node --test tests/ingest-har.test.ts
```

Expected: FAIL — `ingest-har.ts` does not exist.

- [ ] **Step 3: Create workers/ingest-har.ts**

```typescript
import { isDuplicate } from './lib/dedup';
import { slugify, generateId, normalizePrice, buildInsertSQL, NormalizedListing } from './lib/mapper';
import { notifyNewDrafts } from './lib/notify';

interface Env {
  DB: D1Database;
  HAR_USERNAME: string;
  HAR_PASSWORD: string;
  HAR_RESO_URL: string;
  NOTIFICATION_WEBHOOK_URL: string;
}

interface ResoMedia {
  MediaURL: string;
  Order?: number;
}

interface ResoProperty {
  ListingKey: string;
  UnparsedAddress: string;
  City: string;
  PostalCode: string;
  ListPrice: number;
  BedroomsTotal: number;
  BathroomsTotalInteger: number;
  LivingArea: number;
  PublicRemarks: string;
  VideoURL?: string | null;
  Media?: ResoMedia[];
}

export function mapResoProperty(prop: ResoProperty): NormalizedListing {
  const now = new Date().toISOString();
  const address = prop.UnparsedAddress;
  const city = prop.City;
  const mediaUrls = (prop.Media ?? [])
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL);

  return {
    id: generateId(),
    slug: slugify(`${address} ${city}`),
    address,
    city,
    state: 'TX',
    zip: prop.PostalCode,
    price: normalizePrice(prop.ListPrice),
    beds: prop.BedroomsTotal ?? 0,
    baths: prop.BathroomsTotalInteger ?? 0,
    sqft: prop.LivingArea ?? 0,
    description: prop.PublicRemarks ?? '',
    videoUrl: prop.VideoURL ?? null,
    featured: 0,
    status: 'draft',
    source: 'har',
    sourceId: prop.ListingKey,
    sourceImages: JSON.stringify(mediaUrls),
    images: JSON.stringify([]),
    createdAt: now,
    updatedAt: now,
  };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const auth = btoa(`${env.HAR_USERNAME}:${env.HAR_PASSWORD}`);
    const url =
      `${env.HAR_RESO_URL}/Property` +
      `?$filter=StandardStatus eq 'Active'` +
      `&$expand=Media` +
      `&$select=ListingKey,UnparsedAddress,City,PostalCode,ListPrice,` +
      `BedroomsTotal,BathroomsTotalInteger,LivingArea,PublicRemarks,VideoURL`;

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      console.error(`HAR RESO API error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = (await res.json()) as { value: ResoProperty[] };
    const properties = data.value ?? [];

    let newCount = 0;
    for (const prop of properties) {
      const alreadyExists = await isDuplicate(env.DB, 'har', prop.ListingKey);
      if (alreadyExists) continue;

      const listing = mapResoProperty(prop);
      const { sql, params } = buildInsertSQL(listing);
      await env.DB.prepare(sql).bind(...params).run();
      newCount++;
    }

    console.log(`HAR: inserted ${newCount} new draft(s) from ${properties.length} active listings`);
    await notifyNewDrafts(env.NOTIFICATION_WEBHOOK_URL, 'HAR MLS', newCount);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd workers && node --test tests/ingest-har.test.ts
```

Expected: All HAR tests pass.

- [ ] **Step 5: Deploy worker**

```bash
npx wrangler deploy workers/ingest-har.ts --name ingest-har
```

Expected: Worker deploys successfully.

- [ ] **Step 6: Commit**

```bash
git add workers/ingest-har.ts workers/tests/ingest-har.test.ts
git commit -m "feat: add HAR MLS RESO ingestion worker"
```

---

### Task 4: Zillow API Worker

**Files:**
- Create: `workers/ingest-zillow.ts`
- Create: `workers/tests/ingest-zillow.test.ts`

- [ ] **Step 1: Write the failing test**

`workers/tests/ingest-zillow.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';

const { mapZillowListing } = await import('../ingest-zillow.ts');

describe('mapZillowListing', () => {
  const zillowListing = {
    zpid: '98765432',
    streetAddress: '100 Elm Street',
    city: 'Houston',
    zipcode: '77005',
    price: 650000,
    bedrooms: 3,
    bathrooms: 2.5,
    livingArea: 2100,
    description: 'Lovely home near the park.',
    videoUrl: null,
    photos: [
      { mixedSources: { jpeg: [{ url: 'https://photos.zillow.com/a.jpg', width: 1000 }] } },
      { mixedSources: { jpeg: [{ url: 'https://photos.zillow.com/b.jpg', width: 1000 }] } },
    ],
  };

  it('maps Zillow fields to listing schema', () => {
    const result = mapZillowListing(zillowListing);
    assert.strictEqual(result.sourceId, '98765432');
    assert.strictEqual(result.address, '100 Elm Street');
    assert.strictEqual(result.city, 'Houston');
    assert.strictEqual(result.zip, '77005');
    assert.strictEqual(result.price, 650000);
    assert.strictEqual(result.beds, 3);
    assert.strictEqual(result.baths, 2.5);
    assert.strictEqual(result.sqft, 2100);
    assert.strictEqual(result.source, 'zillow');
    assert.strictEqual(result.status, 'draft');
  });

  it('extracts largest photo URLs from mixedSources', () => {
    const result = mapZillowListing(zillowListing);
    const images = JSON.parse(result.sourceImages);
    assert.strictEqual(images.length, 2);
    assert.ok(images[0].includes('zillow.com'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd workers && node --test tests/ingest-zillow.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create workers/ingest-zillow.ts**

```typescript
import { isDuplicate } from './lib/dedup';
import { slugify, generateId, normalizePrice, buildInsertSQL, NormalizedListing } from './lib/mapper';
import { notifyNewDrafts } from './lib/notify';

interface Env {
  DB: D1Database;
  ZILLOW_API_KEY: string;
  ZILLOW_API_URL: string;
  NOTIFICATION_WEBHOOK_URL: string;
}

interface ZillowPhoto {
  mixedSources?: { jpeg?: { url: string; width: number }[] };
}

interface ZillowListing {
  zpid: string;
  streetAddress: string;
  city: string;
  zipcode: string;
  price: number | string;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  description?: string;
  videoUrl?: string | null;
  photos?: ZillowPhoto[];
}

export function mapZillowListing(listing: ZillowListing): NormalizedListing {
  const now = new Date().toISOString();
  const address = listing.streetAddress;
  const city = listing.city;

  const photoUrls = (listing.photos ?? []).map((p) => {
    const jpegs = p.mixedSources?.jpeg ?? [];
    const largest = jpegs.reduce((a, b) => (b.width > a.width ? b : a), jpegs[0]);
    return largest?.url ?? '';
  }).filter(Boolean);

  return {
    id: generateId(),
    slug: slugify(`${address} ${city}`),
    address,
    city,
    state: 'TX',
    zip: listing.zipcode,
    price: normalizePrice(listing.price),
    beds: listing.bedrooms ?? 0,
    baths: listing.bathrooms ?? 0,
    sqft: listing.livingArea ?? 0,
    description: listing.description ?? '',
    videoUrl: listing.videoUrl ?? null,
    featured: 0,
    status: 'draft',
    source: 'zillow',
    sourceId: String(listing.zpid),
    sourceImages: JSON.stringify(photoUrls),
    images: JSON.stringify([]),
    createdAt: now,
    updatedAt: now,
  };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Zillow API search for Houston area active listings
    // Adjust the endpoint and params to match your specific Zillow API contract
    const searchUrl = `${env.ZILLOW_API_URL}/search?location=Houston%2C+TX&status_type=ForSale&home_type=Houses`;

    const res = await fetch(searchUrl, {
      headers: { 'X-Api-Key': env.ZILLOW_API_KEY },
    });

    if (!res.ok) {
      console.error(`Zillow API error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = (await res.json()) as { results?: ZillowListing[] };
    const listings = data.results ?? [];

    let newCount = 0;
    for (const listing of listings) {
      const alreadyExists = await isDuplicate(env.DB, 'zillow', String(listing.zpid));
      if (alreadyExists) continue;

      const normalized = mapZillowListing(listing);
      const { sql, params } = buildInsertSQL(normalized);
      await env.DB.prepare(sql).bind(...params).run();
      newCount++;
    }

    console.log(`Zillow: inserted ${newCount} new draft(s) from ${listings.length} listings`);
    await notifyNewDrafts(env.NOTIFICATION_WEBHOOK_URL, 'Zillow', newCount);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd workers && node --test tests/ingest-zillow.test.ts
```

Expected: All Zillow tests pass.

- [ ] **Step 5: Deploy worker**

```bash
npx wrangler deploy workers/ingest-zillow.ts --name ingest-zillow
```

- [ ] **Step 6: Commit**

```bash
git add workers/ingest-zillow.ts workers/tests/ingest-zillow.test.ts
git commit -m "feat: add Zillow API ingestion worker"
```

---

### Task 5: Email Ingestion Worker

**Files:**
- Create: `workers/ingest-email.ts`
- Create: `workers/tests/ingest-email.test.ts`

- [ ] **Step 1: Write the failing test**

`workers/tests/ingest-email.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';

const { parseListingFromEmail } = await import('../ingest-email.ts');

describe('parseListingFromEmail', () => {
  it('extracts price from email body', () => {
    const body = 'New listing: 123 Oak St, Houston TX 77001. Price: $450,000. 3 beds, 2 baths, 1,800 sqft.';
    const result = parseListingFromEmail('123 Oak St', body);
    assert.strictEqual(result.price, 450000);
    assert.strictEqual(result.beds, 3);
    assert.strictEqual(result.baths, 2);
    assert.strictEqual(result.sqft, 1800);
  });

  it('returns zero for fields not found in email', () => {
    const body = 'Check out this new property!';
    const result = parseListingFromEmail('456 Elm Ave', body);
    assert.strictEqual(result.price, 0);
    assert.strictEqual(result.beds, 0);
  });

  it('extracts image URLs from email body', () => {
    const body = 'See photos: https://cdn.har.com/photo1.jpg and https://cdn.har.com/photo2.jpg';
    const result = parseListingFromEmail('789 Pine St', body);
    assert.ok(result.sourceImages.includes('cdn.har.com'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd workers && node --test tests/ingest-email.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create workers/ingest-email.ts**

```typescript
import { isDuplicate } from './lib/dedup';
import { slugify, generateId, normalizePrice, buildInsertSQL } from './lib/mapper';
import { notifyNewDrafts } from './lib/notify';
import { createHash } from 'crypto';

interface Env {
  DB: D1Database;
  NOTIFICATION_WEBHOOK_URL: string;
}

export interface ParsedListing {
  address: string;
  city: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  sourceImages: string;
}

export function parseListingFromEmail(address: string, body: string): ParsedListing {
  const priceMatch = body.match(/\$[\d,]+/);
  const price = priceMatch ? normalizePrice(priceMatch[0]) : 0;

  const bedsMatch = body.match(/(\d+)\s*bed/i);
  const beds = bedsMatch ? parseInt(bedsMatch[1], 10) : 0;

  const bathsMatch = body.match(/([\d.]+)\s*bath/i);
  const baths = bathsMatch ? parseFloat(bathsMatch[1]) : 0;

  const sqftMatch = body.match(/([\d,]+)\s*sq\.?\s*ft/i);
  const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ''), 10) : 0;

  const cityMatch = body.match(/Houston|Sugar Land|Katy|Pearland|Friendswood|League City/i);
  const city = cityMatch ? cityMatch[0] : 'Houston';

  const zipMatch = body.match(/\b77\d{3}\b/);
  const zip = zipMatch ? zipMatch[0] : '';

  const imageUrlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/gi;
  const imageMatches = [...body.matchAll(imageUrlRegex)].map((m) => m[0]);

  return { address, city, zip, price, beds, baths, sqft, sourceImages: imageMatches.join(',') };
}

function extractEmailAddressFromHeader(raw: string): string {
  const match = raw.match(/<([^>]+)>/) ?? raw.match(/[\w.-]+@[\w.-]+/);
  return match ? match[1] ?? match[0] : '';
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    const subject = message.headers.get('subject') ?? '';
    const from = message.headers.get('from') ?? '';
    const date = message.headers.get('date') ?? new Date().toISOString();

    // Compute dedup key from email metadata
    const sourceId = createHash('sha256')
      .update(`${from}:${subject}:${date}`)
      .digest('hex')
      .slice(0, 16);

    const alreadyExists = await isDuplicate(env.DB, 'email', sourceId);
    if (alreadyExists) {
      console.log(`Email already processed: ${sourceId}`);
      return;
    }

    // Read email body (plain text)
    const reader = message.raw.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const rawBody = new TextDecoder().decode(
      chunks.reduce((a, b) => {
        const merged = new Uint8Array(a.length + b.length);
        merged.set(a); merged.set(b, a.length);
        return merged;
      }, new Uint8Array(0))
    );

    // Try to extract an address from the subject line (common in MLS alert emails)
    const addressMatch = subject.match(/(\d+\s+[\w\s]+(?:St|Ave|Dr|Blvd|Way|Ln|Ct|Rd|Circle|Place))/i);
    const address = addressMatch ? addressMatch[1].trim() : subject.slice(0, 60);

    const parsed = parseListingFromEmail(address, rawBody);
    const now = new Date().toISOString();
    const imageUrls = parsed.sourceImages ? parsed.sourceImages.split(',') : [];

    const { sql, params } = buildInsertSQL({
      id: generateId(),
      slug: slugify(address),
      address: parsed.address,
      city: parsed.city,
      state: 'TX',
      zip: parsed.zip,
      price: parsed.price,
      beds: parsed.beds,
      baths: parsed.baths,
      sqft: parsed.sqft,
      description: `Imported from email alert. Subject: ${subject}`,
      videoUrl: null,
      featured: 0,
      status: 'draft',
      source: 'email',
      sourceId,
      sourceImages: JSON.stringify(imageUrls),
      images: JSON.stringify([]),
      createdAt: now,
      updatedAt: now,
    });

    await env.DB.prepare(sql).bind(...params).run();
    console.log(`Email: created draft from "${subject}"`);
    await notifyNewDrafts(env.NOTIFICATION_WEBHOOK_URL, 'Email', 1);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd workers && node --test tests/ingest-email.test.ts
```

Expected: All email parser tests pass.

- [ ] **Step 5: Configure Cloudflare Email Routing**

In the Cloudflare Dashboard:
1. Go to **Email** → **Email Routing** for `houstonhomespotlight.com`
2. Enable Email Routing
3. Add a custom address: `listings@houstonhomespotlight.com` → Action: **Send to Worker** → Select `ingest-email`

- [ ] **Step 6: Deploy email worker**

```bash
npx wrangler deploy workers/ingest-email.ts --name ingest-email
```

- [ ] **Step 7: Commit**

```bash
git add workers/ingest-email.ts workers/tests/ingest-email.test.ts
git commit -m "feat: add email ingestion worker with listing alert parser"
```

---

### Task 6: Set production secrets and verify end-to-end

- [ ] **Step 1: Set HAR secrets in Cloudflare**

```bash
npx wrangler secret put HAR_USERNAME --name ingest-har
npx wrangler secret put HAR_PASSWORD --name ingest-har
npx wrangler secret put HAR_RESO_URL --name ingest-har
npx wrangler secret put NOTIFICATION_WEBHOOK_URL --name ingest-har
```

Enter the values when prompted.

- [ ] **Step 2: Set Zillow secrets**

```bash
npx wrangler secret put ZILLOW_API_KEY --name ingest-zillow
npx wrangler secret put ZILLOW_API_URL --name ingest-zillow
npx wrangler secret put NOTIFICATION_WEBHOOK_URL --name ingest-zillow
```

- [ ] **Step 3: Set email worker secret**

```bash
npx wrangler secret put NOTIFICATION_WEBHOOK_URL --name ingest-email
```

- [ ] **Step 4: Trigger a manual test run of the HAR worker**

```bash
npx wrangler dispatch-event ingest-har --trigger scheduled
```

Expected: Worker runs, logs appear. Check D1 for new draft rows:

```bash
npx wrangler d1 execute houston-listings --command="SELECT id, address, source, status FROM listings WHERE source='har' LIMIT 5"
```

- [ ] **Step 5: Trigger a manual test run of the Zillow worker**

```bash
npx wrangler dispatch-event ingest-zillow --trigger scheduled
```

Check D1:
```bash
npx wrangler d1 execute houston-listings --command="SELECT id, address, source, status FROM listings WHERE source='zillow' LIMIT 5"
```

- [ ] **Step 6: Test the email worker**

Send an email to `listings@houstonhomespotlight.com` with a test listing alert (or forward a real HAR alert email). Check D1 for a new draft with `source = 'email'`.

- [ ] **Step 7: Verify new drafts appear in admin dashboard**

Log in to `https://houstonhomespotlight.com/admin` — new drafts from HAR and Zillow should appear in the queue. Review one listing and publish it. Verify it appears on the public `/listings` page.

- [ ] **Step 8: Run all tests**

```bash
npm test
cd workers && node --test tests/*.test.ts
```

Expected: All tests pass.

- [ ] **Step 9: Final commit**

```bash
git add -p
git commit -m "feat: complete ingestion workers — HAR RESO, Zillow, Email"
```

---

**Plan 3 complete.** New listings now flow automatically from HAR MLS, Zillow, and email alerts into the admin draft queue on a 30-minute schedule. Bernard reviews and publishes them with one click.

**HAR MCP upgrade path:** When HAR MCP server credentials become available, replace the `fetch()` calls in `workers/ingest-har.ts` with MCP tool calls. The `mapResoProperty()` function and all D1 insert logic remain unchanged.
