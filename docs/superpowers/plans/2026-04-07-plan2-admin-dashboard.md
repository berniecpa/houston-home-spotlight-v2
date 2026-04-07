# Listing Automation — Plan 2: Admin Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected `/admin` section of the existing Next.js site where Bernard can review draft listings (from ingestion workers or manual entry), edit fields and images, and publish/reject listings with a single click.

**Architecture:** Auth uses a signed HttpOnly cookie validated against `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`SESSION_SECRET` env vars. `middleware.ts` guards all `/admin/*` routes. Admin-specific D1 queries live in `src/lib/admin-listings.ts` (separate from the public `listings.ts`). Image uploads go to Cloudflare R2 via a `/api/admin/images/upload` route.

**Tech Stack:** Next.js 15 App Router, edge runtime, Cloudflare D1, Cloudflare R2, `crypto.subtle` (Web Crypto API) for session signing, Tailwind CSS (existing), `node:test`.

**Prerequisite:** Plan 1 (Foundation) must be complete — D1 schema exists and `getDB()`/`getEnv()` are available.

---

### Task 1: Auth helpers and session management

**Files:**
- Create: `src/lib/admin-auth.ts`
- Create: `src/tests/admin-auth.test.ts`

- [ ] **Step 1: Write the failing test**

`src/tests/admin-auth.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import after creation
const { createSessionToken, verifySessionToken } = await import('../lib/admin-auth.ts');

describe('admin-auth.ts', () => {
  const secret = 'test-secret-minimum-32-characters-long';

  it('createSessionToken returns a non-empty string', async () => {
    const token = await createSessionToken(secret);
    assert.strictEqual(typeof token, 'string');
    assert.ok(token.length > 0);
  });

  it('verifySessionToken returns true for a valid token', async () => {
    const token = await createSessionToken(secret);
    const valid = await verifySessionToken(token, secret);
    assert.strictEqual(valid, true);
  });

  it('verifySessionToken returns false for a tampered token', async () => {
    const valid = await verifySessionToken('invalid-token', secret);
    assert.strictEqual(valid, false);
  });

  it('verifySessionToken returns false for wrong secret', async () => {
    const token = await createSessionToken(secret);
    const valid = await verifySessionToken(token, 'wrong-secret-minimum-32-characters-x');
    assert.strictEqual(valid, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `admin-auth.ts` does not exist.

- [ ] **Step 3: Create src/lib/admin-auth.ts**

```typescript
export const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(secret: string): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return btoa(JSON.stringify({ payload, sig: sigB64 }));
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const { payload, sig: sigB64 } = JSON.parse(atob(token));
    const { exp } = JSON.parse(payload);
    if (Date.now() > exp) return false;

    const key = await getKey(secret);
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: All admin-auth tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-auth.ts src/tests/admin-auth.test.ts
git commit -m "feat: add session token helpers for admin auth"
```

---

### Task 2: Auth API routes (login + logout)

**Files:**
- Create: `src/app/api/admin/auth/login/route.ts`
- Create: `src/app/api/admin/auth/logout/route.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/admin-auth.test.ts`:
```typescript
it('login and logout route files exist', () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  const loginRoute = path.join(__dirname, '..', 'app', 'api', 'admin', 'auth', 'login', 'route.ts');
  const logoutRoute = path.join(__dirname, '..', 'app', 'api', 'admin', 'auth', 'logout', 'route.ts');
  
  assert.ok(fs.existsSync(loginRoute), 'login route should exist');
  assert.ok(fs.existsSync(logoutRoute), 'logout route should exist');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — route files don't exist.

- [ ] **Step 3: Create the login route**

`src/app/api/admin/auth/login/route.ts`:
```typescript
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE } from '@/lib/admin-auth';
import { getEnv } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();
  const env = getEnv();

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSessionToken(env.SESSION_SECRET);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
  return response;
}
```

- [ ] **Step 4: Create the logout route**

`src/app/api/admin/auth/logout/route.ts`:
```typescript
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/auth/
git commit -m "feat: add admin login and logout API routes"
```

---

### Task 3: Admin middleware (route protection)

**Files:**
- Create: `src/middleware.ts`
- Create: `src/tests/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

`src/tests/middleware.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('middleware.ts', () => {
  it('middleware.ts file exists at project root src/', () => {
    const middlewarePath = path.join(__dirname, '..', 'middleware.ts');
    assert.ok(fs.existsSync(middlewarePath), 'middleware.ts should exist');
  });

  it('middleware matches /admin routes', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf-8');
    assert.ok(content.includes('/admin'), 'middleware should reference /admin routes');
  });

  it('middleware redirects to login when no session', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf-8');
    assert.ok(content.includes('/admin/login'), 'middleware should redirect to /admin/login');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `middleware.ts` does not exist.

- [ ] **Step 3: Create src/middleware.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/admin-auth';

export const config = {
  matcher: ['/admin/:path*'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page through without auth check
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  const secret = (request as unknown as { cloudflare?: { env?: { SESSION_SECRET?: string } } })
    .cloudflare?.env?.SESSION_SECRET ?? process.env.SESSION_SECRET ?? '';

  const valid = await verifySessionToken(token, secret);
  if (!valid) {
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: All middleware tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/tests/middleware.test.ts
git commit -m "feat: add admin route protection middleware"
```

---

### Task 4: Admin listing queries (src/lib/admin-listings.ts)

**Files:**
- Create: `src/lib/admin-listings.ts`
- Create: `src/tests/admin-listings.test.ts`

- [ ] **Step 1: Write the failing test**

`src/tests/admin-listings.test.ts`:
```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setDB } from '../lib/db.ts';

const { getDraftListings, getAdminListing, upsertListing, setListingStatus } =
  await import('../lib/admin-listings.ts');

const baseRow = {
  id: 'draft-1',
  slug: 'test-draft',
  address: '100 Test St',
  city: 'Houston',
  state: 'TX',
  zip: '77001',
  price: 400000,
  beds: 3,
  baths: 2,
  sqft: 1500,
  description: 'Test draft listing',
  video_url: null,
  featured: 0,
  status: 'draft',
  source: 'manual',
  source_id: null,
  source_images: '[]',
  images: '[]',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const executedStatements: string[] = [];

function makeMockDB(rows: typeof baseRow[]) {
  return {
    prepare: (sql: string) => ({
      all: async () => ({ results: rows }),
      bind: (..._args: unknown[]) => ({
        all: async () => ({ results: rows }),
        first: async () => rows[0] ?? null,
        run: async () => {
          executedStatements.push(sql);
          return { success: true };
        },
      }),
      run: async () => {
        executedStatements.push(sql);
        return { success: true };
      },
      first: async () => rows[0] ?? null,
    }),
  } as unknown as D1Database;
}

describe('admin-listings.ts', () => {
  beforeEach(() => {
    setDB(makeMockDB([baseRow]));
    executedStatements.length = 0;
  });
  afterEach(() => setDB(null));

  it('getDraftListings returns listings with status draft', async () => {
    const listings = await getDraftListings();
    assert.strictEqual(listings.length, 1);
    assert.strictEqual(listings[0].id, 'draft-1');
  });

  it('getAdminListing returns a listing by id regardless of status', async () => {
    const listing = await getAdminListing('draft-1');
    assert.ok(listing);
    assert.strictEqual(listing.id, 'draft-1');
  });

  it('setListingStatus executes an UPDATE statement', async () => {
    await setListingStatus('draft-1', 'published');
    assert.ok(executedStatements.some(s => s.includes('UPDATE')), 'should run UPDATE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `admin-listings.ts` does not exist.

- [ ] **Step 3: Create src/lib/admin-listings.ts**

```typescript
import { getDB } from '@/lib/db';

export interface AdminListing {
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
  featured: boolean;
  status: 'draft' | 'published' | 'rejected';
  source: string;
  sourceId: string | null;
  sourceImages: string[];
  images: string[];
  createdAt: string;
  updatedAt: string;
}

interface AdminRow {
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
  status: string;
  source: string;
  source_id: string | null;
  source_images: string;
  images: string;
  created_at: string;
  updated_at: string;
}

function rowToAdminListing(row: AdminRow): AdminListing {
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
    videoUrl: row.video_url,
    featured: Boolean(row.featured),
    status: row.status as AdminListing['status'],
    source: row.source,
    sourceId: row.source_id,
    sourceImages: JSON.parse(row.source_images),
    images: JSON.parse(row.images),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getDraftListings(): Promise<AdminListing[]> {
  const db = getDB();
  const result = await db
    .prepare("SELECT * FROM listings WHERE status = 'draft' ORDER BY created_at DESC")
    .all<AdminRow>();
  return result.results.map(rowToAdminListing);
}

export async function getPublishedListings(): Promise<AdminListing[]> {
  const db = getDB();
  const result = await db
    .prepare("SELECT * FROM listings WHERE status = 'published' ORDER BY created_at DESC")
    .all<AdminRow>();
  return result.results.map(rowToAdminListing);
}

export async function getAdminListing(id: string): Promise<AdminListing | null> {
  const db = getDB();
  const row = await db
    .prepare('SELECT * FROM listings WHERE id = ?')
    .bind(id)
    .first<AdminRow>();
  return row ? rowToAdminListing(row) : null;
}

export async function setListingStatus(
  id: string,
  status: 'draft' | 'published' | 'rejected'
): Promise<void> {
  const db = getDB();
  await db
    .prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
}

export async function upsertListing(listing: Partial<AdminListing> & { id: string }): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();
  await db
    .prepare(`
      INSERT INTO listings (id, slug, address, city, state, zip, price, beds, baths, sqft,
        description, video_url, featured, status, source, source_id, source_images, images,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        address = excluded.address,
        city = excluded.city,
        state = excluded.state,
        zip = excluded.zip,
        price = excluded.price,
        beds = excluded.beds,
        baths = excluded.baths,
        sqft = excluded.sqft,
        description = excluded.description,
        video_url = excluded.video_url,
        featured = excluded.featured,
        images = excluded.images,
        updated_at = excluded.updated_at
    `)
    .bind(
      listing.id,
      listing.slug ?? '',
      listing.address ?? '',
      listing.city ?? 'Houston',
      listing.state ?? 'TX',
      listing.zip ?? '',
      listing.price ?? 0,
      listing.beds ?? 0,
      listing.baths ?? 0,
      listing.sqft ?? 0,
      listing.description ?? '',
      listing.videoUrl ?? null,
      listing.featured ? 1 : 0,
      listing.status ?? 'draft',
      listing.source ?? 'manual',
      listing.sourceId ?? null,
      JSON.stringify(listing.sourceImages ?? []),
      JSON.stringify(listing.images ?? []),
      now,
      now
    )
    .run();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All admin-listings tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-listings.ts src/tests/admin-listings.test.ts
git commit -m "feat: add admin listing CRUD queries"
```

---

### Task 5: Admin listing API routes

**Files:**
- Create: `src/app/api/admin/listings/route.ts`
- Create: `src/app/api/admin/listings/[id]/route.ts`
- Create: `src/app/api/admin/listings/[id]/status/route.ts`

- [ ] **Step 1: Create the listings collection route**

`src/app/api/admin/listings/route.ts`:
```typescript
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getDraftListings, getPublishedListings, upsertListing } from '@/lib/admin-listings';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'draft';

  const listings = status === 'published'
    ? await getPublishedListings()
    : await getDraftListings();

  return NextResponse.json(listings);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const id = randomUUID();
  const slug = body.address
    ? body.address.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : id;

  await upsertListing({ ...body, id, slug, status: 'draft', source: 'manual' });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Create the single listing route**

`src/app/api/admin/listings/[id]/route.ts`:
```typescript
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminListing, upsertListing } from '@/lib/admin-listings';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await getAdminListing(id);
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(listing);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getAdminListing(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  await upsertListing({ ...existing, ...body, id });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create the status route**

`src/app/api/admin/listings/[id]/status/route.ts`:
```typescript
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { setListingStatus } from '@/lib/admin-listings';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await request.json();

  if (!['draft', 'published', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await setListingStatus(id, status);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run build to verify no TypeScript errors**

```bash
npm run build
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: add admin CRUD and status API routes"
```

---

### Task 6: Admin login page

**Files:**
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Create the login page**

`src/app/admin/login/page.tsx`:
```typescript
export const runtime = 'edge';

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    });

    setLoading(false);
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Invalid username or password.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              name="username"
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run build to verify no errors**

```bash
npm run build
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/
git commit -m "feat: add admin login page"
```

---

### Task 7: Admin layout and shared components

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx` (draft queue)

- [ ] **Step 1: Create admin layout**

`src/app/admin/layout.tsx`:
```typescript
export const runtime = 'edge';

import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-gray-900">NB Elite Realty — Admin</span>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Drafts</Link>
          <Link href="/admin/listings" className="text-sm text-gray-600 hover:text-gray-900">Published</Link>
          <Link href="/admin/listings/new" className="text-sm text-gray-600 hover:text-gray-900">Add Listing</Link>
        </div>
        <form action="/api/admin/auth/logout" method="POST">
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
        </form>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create the draft queue page**

`src/app/admin/page.tsx`:
```typescript
export const runtime = 'edge';

import Link from 'next/link';
import { getDraftListings } from '@/lib/admin-listings';

export default async function AdminDashboard() {
  const drafts = await getDraftListings();

  const sourceLabels: Record<string, string> = {
    har: 'HAR MLS',
    zillow: 'Zillow',
    email: 'Email',
    rss: 'RSS',
    manual: 'Manual',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Draft Queue
          {drafts.length > 0 && (
            <span className="ml-3 bg-yellow-100 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {drafts.length}
            </span>
          )}
        </h1>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No pending drafts. Nice work!</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Address', 'Price', 'Beds/Baths', 'Source', 'Received'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {drafts.map((listing) => (
                <tr key={listing.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/admin/listings/${listing.id}`} className="text-blue-600 hover:underline font-medium">
                      {listing.address}, {listing.city}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    ${listing.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {listing.beds}bd / {listing.baths}ba
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                      {sourceLabels[listing.source] ?? listing.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(listing.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add admin layout and draft queue dashboard"
```

---

### Task 8: Listing review/edit page

**Files:**
- Create: `src/app/admin/listings/[id]/page.tsx`
- Create: `src/app/api/admin/images/upload/route.ts`

- [ ] **Step 1: Create the image upload route**

`src/app/api/admin/images/upload/route.ts`:
```typescript
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/db';

export async function POST(request: NextRequest) {
  const env = getEnv();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const sourceUrl = formData.get('sourceUrl') as string | null;

  if (!file && !sourceUrl) {
    return NextResponse.json({ error: 'file or sourceUrl required' }, { status: 400 });
  }

  let buffer: ArrayBuffer;
  let contentType: string;
  let fileName: string;

  if (file) {
    buffer = await file.arrayBuffer();
    contentType = file.type || 'image/jpeg';
    fileName = `listings/${Date.now()}-${file.name.replace(/[^a-z0-9.\-]/gi, '-')}`;
  } else {
    // Fetch image from source URL and copy to R2
    const res = await fetch(sourceUrl!);
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch source image' }, { status: 502 });
    buffer = await res.arrayBuffer();
    contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.split('/')[1] ?? 'jpg';
    fileName = `listings/${Date.now()}.${ext}`;
  }

  await env.R2.put(fileName, buffer, { httpMetadata: { contentType } });

  // Return public URL — requires R2 public bucket or custom domain
  const r2PublicUrl = `https://images.houstonhomespotlight.com/${fileName}`;
  return NextResponse.json({ url: r2PublicUrl });
}
```

- [ ] **Step 2: Create the listing review page**

`src/app/admin/listings/[id]/page.tsx`:
```typescript
export const runtime = 'edge';

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminListing } from '@/lib/admin-listings';

export default function ListingReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<AdminListing | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/admin/listings/${id}`)
      .then((r) => r.json())
      .then((data: AdminListing) => {
        setListing(data);
        setSelectedImages(data.images.length > 0 ? data.images : data.sourceImages.slice(0, 3));
      });
  }, [id]);

  if (!listing) return <div className="py-16 text-center text-gray-400">Loading…</div>;

  async function save(status?: AdminListing['status']) {
    setSaving(true);
    setMessage('');

    const updates: Partial<AdminListing> & { status?: string } = {
      address: listing!.address,
      city: listing!.city,
      zip: listing!.zip,
      price: listing!.price,
      beds: listing!.beds,
      baths: listing!.baths,
      sqft: listing!.sqft,
      description: listing!.description,
      videoUrl: listing!.videoUrl,
      featured: listing!.featured,
      images: selectedImages,
    };

    if (status) updates.status = status;

    await fetch(`/api/admin/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (status && status !== 'draft') {
      await fetch(`/api/admin/listings/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    }

    setSaving(false);
    if (status === 'published') {
      setMessage('Published! Listing is now live.');
      setTimeout(() => router.push('/admin'), 1500);
    } else if (status === 'rejected') {
      router.push('/admin');
    } else {
      setMessage('Draft saved.');
    }
  }

  async function copyToR2(sourceUrl: string) {
    const formData = new FormData();
    formData.append('sourceUrl', sourceUrl);
    const res = await fetch('/api/admin/images/upload', { method: 'POST', body: formData });
    const { url } = await res.json();
    setSelectedImages((prev) =>
      prev.map((u) => (u === sourceUrl ? url : u)).concat(prev.includes(sourceUrl) ? [] : [url])
    );
  }

  const field = (label: string, key: keyof AdminListing, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={String(listing![key] ?? '')}
        onChange={(e) => {
          const val = type === 'number' ? Number(e.target.value) : e.target.value;
          setListing((l) => l ? { ...l, [key]: val } : l);
        }}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Listing</h1>
        <span className="text-sm text-gray-500 uppercase bg-gray-100 px-3 py-1 rounded">
          {listing.source}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {field('Address', 'address')}
        {field('City', 'city')}
        {field('ZIP', 'zip')}
        {field('Price ($)', 'price', 'number')}
        {field('Beds', 'beds', 'number')}
        {field('Baths', 'baths', 'number')}
        {field('Sqft', 'sqft', 'number')}
        {field('Video URL', 'videoUrl')}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={5}
          value={listing.description}
          onChange={(e) => setListing((l) => l ? { ...l, description: e.target.value } : l)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={listing.featured}
            onChange={(e) => setListing((l) => l ? { ...l, featured: e.target.checked } : l)}
          />
          Feature on home page
        </label>
      </div>

      {/* Image Panel */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Images</h2>
        <div className="grid grid-cols-3 gap-3">
          {listing.sourceImages.map((url) => {
            const isSelected = selectedImages.includes(url);
            const inR2 = !url.includes('picsum') && url.includes('houstonhomespotlight');
            return (
              <div key={url} className="relative border rounded overflow-hidden">
                <img src={url} alt="" className="w-full h-32 object-cover" />
                <div className="p-2 bg-white space-y-1">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        setSelectedImages((prev) =>
                          e.target.checked ? [...prev, url] : prev.filter((u) => u !== url)
                        )
                      }
                    />
                    Use this image
                  </label>
                  {!inR2 && (
                    <button
                      onClick={() => copyToR2(url)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Copy to R2
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Selected: {selectedImages.length} image(s). Drag to reorder not yet supported — first selected = hero.
        </p>
      </div>

      {message && <p className="text-green-600 text-sm mb-4">{message}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => save('published')}
          disabled={saving || selectedImages.length === 0}
          className="bg-green-600 text-white px-6 py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Publish
        </button>
        <button
          onClick={() => save()}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          onClick={() => save('rejected')}
          disabled={saving}
          className="bg-red-100 text-red-700 px-6 py-2 rounded font-medium hover:bg-red-200 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run build to verify no errors**

```bash
npm run build
```

Expected: Builds cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/listings/ src/app/api/admin/images/
git commit -m "feat: add listing review page and R2 image upload route"
```

---

### Task 9: Published listings page and Add Listing page

**Files:**
- Create: `src/app/admin/listings/page.tsx`
- Create: `src/app/admin/listings/new/page.tsx`

- [ ] **Step 1: Create published listings page**

`src/app/admin/listings/page.tsx`:
```typescript
export const runtime = 'edge';

import Link from 'next/link';
import { getPublishedListings } from '@/lib/admin-listings';

export default async function PublishedListingsPage() {
  const listings = await getPublishedListings();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Published Listings</h1>
        <Link
          href="/admin/listings/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Add Listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No published listings.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Address', 'Price', 'Beds/Baths', 'Featured', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {listings.map((listing) => (
                <tr key={listing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {listing.address}, {listing.city}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">${listing.price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{listing.beds}bd / {listing.baths}ba</td>
                  <td className="px-4 py-3 text-sm">
                    {listing.featured ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Yes</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 flex gap-3 text-sm">
                    <Link href={`/admin/listings/${listing.id}`} className="text-blue-600 hover:underline">Edit</Link>
                    <Link href={`/listings/${listing.slug}`} target="_blank" className="text-gray-500 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the Add Listing page**

`src/app/admin/listings/new/page.tsx`:
```typescript
export const runtime = 'edge';

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewListingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    const body = {
      address: form.get('address'),
      city: form.get('city'),
      zip: form.get('zip'),
      price: Number(form.get('price')),
      beds: Number(form.get('beds')),
      baths: Number(form.get('baths')),
      sqft: Number(form.get('sqft')),
      description: form.get('description'),
      videoUrl: form.get('videoUrl') || null,
      featured: form.get('featured') === 'on',
      source: 'manual',
      sourceImages: [],
      images: [],
    };

    const res = await fetch('/api/admin/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const { id } = await res.json();
    router.push(`/admin/listings/${id}`);
  }

  const fieldClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Listing</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
            <input name="address" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <input name="city" defaultValue="Houston" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
            <input name="zip" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
            <input name="price" type="number" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beds *</label>
            <input name="beds" type="number" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Baths *</label>
            <input name="baths" type="number" step="0.5" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sqft *</label>
            <input name="sqft" type="number" required className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
            <input name="videoUrl" type="url" className={fieldClass} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea name="description" rows={5} required className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="featured" />
          Feature on home page
        </label>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Draft'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-600 px-4 py-2 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Run build to verify no errors**

```bash
npm run build
```

Expected: Builds cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/listings/
git commit -m "feat: add published listings page and manual add listing form"
```

---

### Task 10: End-to-end admin verification

- [ ] **Step 1: Start local dev server**

```bash
npm run pages:build && npx wrangler pages dev
```

- [ ] **Step 2: Verify login**

Visit `http://localhost:8788/admin` — should redirect to `/admin/login`.
Enter `admin` / `changeme` — should redirect to `/admin` draft queue.

- [ ] **Step 3: Verify draft queue is empty**

The queue should show "No pending drafts." since all 3 listings are `published`, not `draft`.

- [ ] **Step 4: Verify published listings**

Visit `/admin/listings` — all 3 migrated listings should appear.

- [ ] **Step 5: Verify edit flow**

Click a listing → edit a field → Save Draft → confirm change persists.

- [ ] **Step 6: Verify Add Listing**

Click Add Listing → fill in a test property → Create Draft → confirm it appears in the draft queue → Publish → confirm it appears on `/listings`.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Final commit**

```bash
git add -p
git commit -m "feat: complete admin dashboard — auth, draft queue, review, publish"
```

---

**Plan 2 complete.** Bernard can now log in at `/admin`, review draft listings from any source, edit fields and images, and publish with one click.

Proceed to Plan 3 (Ingestion Workers) next.
