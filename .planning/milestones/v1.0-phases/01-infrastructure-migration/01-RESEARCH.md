# Phase 1: Infrastructure Migration - Research

**Researched:** 2026-06-10
**Domain:** @opennextjs/cloudflare, Cloudflare D1, Wrangler, Next.js 15 App Router
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key decisions already made at project init (from STATE.md):
- Use `@opennextjs/cloudflare` (NOT the archived `@cloudflare/next-on-pages`) — unconditional Phase 1 gate
- D1 schema: 4 tables — `agents`, `listings`, `subscriptions`, `leads`
- Local dev: `initOpenNextCloudflareForDev()` resolves D1 bindings for `wrangler dev`
- Stripe async crypto (`constructEventAsync` + `createSubtleCryptoProvider`) needed for Workers later — schema can pre-create tables
- Grace period enforced via SQL WHERE clause on every listing query — no cron job required

### Claude's Discretion
All implementation choices within the locked decisions above.

### Deferred Ideas (OUT OF SCOPE)
- D1 query helper/ORM wrapper (Drizzle ORM consideration) — deferred to Phase 4
- R2 storage setup — explicitly out of scope (v1 photos are URL-paste only)
- Cloudflare Queues / Durable Objects for async polling — deferred to Phase 6
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Platform deploys to Cloudflare Workers via `@opennextjs/cloudflare` (replaces archived `@cloudflare/next-on-pages`) | Standard Stack section; open-next.config.ts + wrangler.toml patterns |
| INFRA-02 | `output: 'export'` is removed; dynamic API routes and middleware work at runtime | Architecture Patterns section; next.config.mjs migration pattern |
| INFRA-03 | Cloudflare D1 schema is applied (agents, listings, subscriptions, leads tables) | D1 Schema Design section; migration file examples |
| INFRA-04 | Wrangler local dev workflow runs D1 locally via `initOpenNextCloudflareForDev()` | Local Dev section; initOpenNextCloudflareForDev pattern |
| INFRA-05 | GitHub Actions deploy pipeline updated to use OpenNext build + wrangler deploy | CI/CD section; GitHub Actions workflow |
</phase_requirements>

---

## Summary

This phase migrates the project from a fully-static Next.js export (`output: 'export'`) to Cloudflare Workers using `@opennextjs/cloudflare`. The migration removes three files/sections that were specific to the old Pages static export approach (`@cloudflare/next-on-pages`, `distDir: 'dist'`, `output: 'export'`) and replaces them with the Workers-compatible adapter that builds into `.open-next/`. The adapter bundles the entire Next.js app into a single `worker.js` entry point and serves static assets from a separate `assets` binding.

Cloudflare D1 is a SQLite-compatible database running at the edge. For this phase, it needs only a schema (DDL) applied — no data reads or writes happen yet. The schema design is shaped by the full application requirements (grace period via SQL WHERE, subscription status on agents, video_url on listings). D1 migrations are managed by Wrangler as sequentially-numbered SQL files in `db/migrations/`.

Local development with `next dev` continues to work, but D1 bindings are made available during `next dev` by calling `initOpenNextCloudflareForDev()` at the end of `next.config.mjs`. This function reads `wrangler.toml` at startup and creates local proxies for the D1 binding so API routes can call `getCloudflareContext().env.DB` in development without running inside a Worker process.

**Primary recommendation:** Replace `@cloudflare/next-on-pages` with `@opennextjs/cloudflare`, rewrite `wrangler.toml` for Workers (not Pages), apply the D1 schema migration, update `next.config.mjs` to remove static export and add the dev init call, and replace the GitHub Actions deploy job to use `opennextjs-cloudflare build && wrangler deploy`.

---

## Project Constraints (from CLAUDE.md)

- **Framework**: Next.js App Router — no rewrite
- **Auth**: Firebase Auth — not Clerk/NextAuth (Phase 2, not Phase 1)
- **Database**: Cloudflare D1 (SQLite) — must stay in Cloudflare ecosystem
- **Deployment**: Cloudflare Pages + Workers — `@opennextjs/cloudflare` adapter required
- **Photos v1**: URL paste only — no R2, no file upload
- **Public UX**: Existing buyer-facing listing browse/detail must not regress
- **Files under 500 lines** — CLAUDE.md convention
- **Input validation at system boundaries** — CLAUDE.md convention
- **TypeScript strict mode** — tsconfig.json
- **Named exports + default export for reusable components** — CLAUDE.md naming convention
- **`export const runtime = "edge"` is FORBIDDEN** — must never be set; `@opennextjs/cloudflare` does not support edge runtime

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static asset serving | CDN / Static | — | `.open-next/assets` served via Cloudflare Assets binding |
| API routes (`/api/health`, `/api/leads`) | API / Backend (Workers) | — | Dynamic routes run inside the Worker process |
| D1 schema (DDL only) | Database / Storage | — | Schema applied at deploy time via `wrangler d1 migrations apply` |
| Build + deploy pipeline | CI/CD | — | GitHub Actions orchestrates OpenNext build + `wrangler deploy` |
| Local dev bindings | Frontend Server (dev) | — | `initOpenNextCloudflareForDev()` proxies D1 to `next dev` |
| `next.config.mjs` runtime config | Frontend Server | — | Removes static export, adds dev init |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opennextjs/cloudflare` | 1.19.11 | Adapts Next.js for Cloudflare Workers | Official Cloudflare-maintained OpenNext adapter; replaces deprecated `@cloudflare/next-on-pages` |
| `wrangler` | 4.99.0 (latest) | CLI for D1 operations and Workers deploy | Official Cloudflare CLI; required for `wrangler d1 migrations apply` and `wrangler deploy` |
| `@cloudflare/workers-types` | 4.20260610.1 | TypeScript types for Workers env (D1, KV, etc.) | Enables typed `getCloudflareContext().env.DB` without casting |

### Existing Dependencies (unchanged)

| Library | Version | Status |
|---------|---------|--------|
| `next` | ^15.5.2 | Keep — supported by `@opennextjs/cloudflare` |
| `react` | ^18 | Keep |
| `typescript` | ^5 | Keep |

### Removed in This Phase

| Library | Why Removed |
|---------|-------------|
| `@cloudflare/next-on-pages` | Archived; replaced by `@opennextjs/cloudflare` |

**Version verification:** [CITED: opennext.js.org/cloudflare/get-started]
- `@opennextjs/cloudflare` 1.19.11 — latest on npm registry (package created 2024-09-20) [VERIFIED: npm registry]
- `wrangler` 4.99.0 — latest on npm registry (package created 2012-06-19) [VERIFIED: npm registry]
- `@cloudflare/workers-types` 4.20260610.1 — latest; date-versioned (package created 2019-06-13) [VERIFIED: npm registry]

**Installation:**
```bash
npm install --save-dev @opennextjs/cloudflare wrangler @cloudflare/workers-types
npm uninstall @cloudflare/next-on-pages
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@opennextjs/cloudflare` | npm | 1.7 yrs (Sep 2024) | 692K/wk | github.com/opennextjs/opennextjs-cloudflare | SUS (too-new version) | Approved — official Cloudflare partner project; `too-new` signal is latest version date not package age |
| `wrangler` | npm | 14 yrs (Jun 2012) | 15.7M/wk | github.com/cloudflare/workers-sdk | SUS (too-new version) | Approved — official Cloudflare CLI; daily version release cadence triggers seam flag |
| `@cloudflare/workers-types` | npm | 7 yrs (Jun 2019) | 4.3M/wk | github.com/cloudflare/workerd | SUS (too-new version) | Approved — official Cloudflare types package; date-versioned and publishes daily |

**Packages removed due to SLOP verdict:** none

**Packages flagged as suspicious (SUS):** All three are flagged `too-new` because a new version was published within the last 48 hours. The signal detects recency of the latest version, not of the package itself. All three are published from official Cloudflare GitHub organizations with millions of weekly downloads and are confirmed by official documentation. No security concern.

**Note:** `@opennextjs/cloudflare` is confirmed via [CITED: developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/] as the current official adapter.

---

## Architecture Patterns

### System Architecture Diagram

```
Request
   |
   v
Cloudflare Edge (Workers Runtime)
   |
   +-- Static assets  -->  ASSETS binding  -->  .open-next/assets/
   |
   +-- Dynamic routes -->  worker.js  -->  Next.js App Router
          |
          +-- Server Components (RSC)  -->  rendered server-side
          +-- API Routes (/api/health, /api/leads)  -->  handler functions
          |        |
          |        +-- getCloudflareContext().env.DB  -->  D1 binding
          |
          +-- Client Components  -->  JS hydration on client

D1 (Cloudflare SQLite at edge)
   +-- agents
   +-- listings
   +-- listing_images
   +-- subscriptions
   +-- stripe_events
   +-- leads

Local Dev (next dev):
   initOpenNextCloudflareForDev()
         |
         +-- reads wrangler.toml  -->  creates local D1 proxy  -->  getCloudflareContext().env.DB
```

### Recommended Project Structure

```
/
+-- src/                        # Existing — no structural changes
+-- db/
|   +-- migrations/
|       +-- 0001_initial_schema.sql   # D1 DDL for all tables
+-- open-next.config.ts         # NEW — OpenNext configuration
+-- wrangler.toml               # REWRITE — Workers config (was Pages config)
+-- next.config.mjs             # MODIFY — remove output:export, add initOpenNextCloudflareForDev
+-- cloudflare-env.d.ts         # NEW — generated by wrangler types (cf-typegen script)
+-- .dev.vars                   # NEW — local env vars (gitignored)
+-- .open-next/                 # Build output (gitignored)
|   +-- worker.js
|   +-- assets/
+-- .github/
    +-- workflows/
        +-- deploy.yml          # REWRITE — OpenNext build + wrangler deploy
```

### Pattern 1: open-next.config.ts

**What:** Minimal config that enables Cloudflare Workers adapter
**When to use:** Always required — the adapter build needs this file

```typescript
// open-next.config.ts
// Source: opennext.js.org/cloudflare/get-started
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

No options needed for Phase 1. R2 incremental cache is a v2 optimization.

### Pattern 2: next.config.mjs for Workers

**What:** Remove static export, add OpenNext dev init
**When to use:** Phase 1 migration — replaces current config

```javascript
// next.config.mjs
// Source: opennext.js.org/cloudflare/get-started
/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export' REMOVED — Workers handles dynamic routing
  // distDir: 'dist' REMOVED — build output is now .open-next/
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

### Pattern 3: wrangler.toml for Workers + D1

**What:** Full Workers config replacing the old Pages config
**When to use:** Required for `wrangler d1 migrations apply` and `wrangler deploy`

```toml
# wrangler.toml
# Source: opennext.js.org/cloudflare/get-started + developers.cloudflare.com/d1/reference/migrations/
name = "houston-home-spotlight-v2"
main = ".open-next/worker.js"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "houston-home-spotlight-v2"

[[d1_databases]]
binding = "DB"
database_name = "houston-home-spotlight"
database_id = "<REPLACE_WITH_UUID_FROM_wrangler_d1_create>"
migrations_dir = "db/migrations"
migrations_table = "d1_migrations"

[vars]
PERFEX_RE_URL = ""
# PERFEX_RE_KEY goes in wrangler secret put, not here
```

**Important:** `database_id` requires running `wrangler d1 create houston-home-spotlight` first to provision the database and get the UUID.

### Pattern 4: Accessing D1 in API Routes

**What:** Type-safe D1 access via `getCloudflareContext`
**When to use:** Any API route that queries D1 — starting with `/api/health`

```typescript
// src/app/api/health/route.ts
// Source: opennext.js.org/cloudflare/bindings
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(): Promise<NextResponse> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    if (!db) {
      return NextResponse.json(
        { ok: false, error: 'D1 binding not found' },
        { status: 503 }
      );
    }

    const result = await db
      .prepare("SELECT count(*) as table_count FROM sqlite_master WHERE type='table'")
      .first<{ table_count: number }>();

    return NextResponse.json({
      ok: true,
      runtime: 'cloudflare-workers',
      d1_tables: result?.table_count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

**Note:** `export const runtime = 'edge'` must NEVER appear. Omit the runtime export entirely to use the default (nodejs).

### Pattern 5: Updating `/api/leads` for Workers env

**What:** Replace `process.env` with `getCloudflareContext().env`
**When to use:** Required for the existing leads route to function in Workers runtime

```typescript
// In src/app/api/leads/route.ts — replace the env var reads
// OLD (Node.js only):
// const perfexUrl = process.env.PERFEX_RE_URL;
// const perfexKey = process.env.PERFEX_RE_KEY;

// NEW (Workers compatible):
const { env } = await getCloudflareContext({ async: true });
const perfexUrl = env.PERFEX_RE_URL as string | undefined;
const perfexKey = env.PERFEX_RE_KEY as string | undefined;
```

### Pattern 6: D1 Schema Migration File

**What:** SQL DDL for all application tables
**When to use:** Applied via `wrangler d1 migrations apply DB --local` and `--remote`

```sql
-- db/migrations/0001_initial_schema.sql
-- Source: REQUIREMENTS.md + STATE.md design decisions

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  phone TEXT,
  brokerage TEXT,
  license_number TEXT,
  slug TEXT UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT NOT NULL DEFAULT 'none',
  subscription_grace_until INTEGER,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Houston',
  state TEXT NOT NULL DEFAULT 'TX',
  zip TEXT,
  price INTEGER NOT NULL,
  beds INTEGER NOT NULL,
  baths REAL NOT NULL,
  sqft INTEGER,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  video_url TEXT,
  video_status TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  current_period_start INTEGER,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  email TEXT NOT NULL,
  phonenumber TEXT NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_listings_agent_id ON listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_slug ON listings(slug);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_listing_id ON leads(listing_id);
CREATE INDEX IF NOT EXISTS idx_agents_stripe_customer ON agents(stripe_customer_id);
```

**Grace period SQL pattern (locked decision):** All public listing queries in Phase 4+ must include:

```sql
JOIN agents a ON listings.agent_id = a.id
WHERE listings.status = 'active'
  AND a.is_suspended = 0
  AND (
    a.subscription_status = 'active'
    OR (a.subscription_status = 'grace' AND a.subscription_grace_until > unixepoch())
  )
```

### Pattern 7: GitHub Actions Deploy Workflow

**What:** CI/CD pipeline for Workers deployment
**When to use:** Replaces existing Pages deploy workflow entirely

```yaml
# .github/workflows/deploy.yml
# Source: github.com/cloudflare/wrangler-action + opennext.js.org
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build (OpenNext)
        run: npx opennextjs-cloudflare build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

**Required GitHub repository secrets:**
- `CLOUDFLARE_API_TOKEN` — API token with "Workers Scripts:Edit" + "D1:Edit" permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier

### Anti-Patterns to Avoid

- **`export const runtime = "edge"`**: Not supported — remove from any file if present
- **`output: 'export'` in next.config**: Must be removed — incompatible with Workers
- **`distDir: 'dist'`**: Must be removed — OpenNext outputs to `.open-next/`
- **`process.env.*` in API routes**: Replace with `getCloudflareContext().env.*`
- **`wrangler pages deploy`**: Replace with `wrangler deploy`
- **Node Middleware with Node-only imports**: Not yet supported by `@opennextjs/cloudflare`
- **Drizzle ORM in Phase 1**: Out of scope; use raw D1 SQL for health check only

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workers adapter | Custom bundling | `@opennextjs/cloudflare` | Handles RSC, ISR, edge cases in Next.js routing |
| D1 binding proxy for local dev | Mock D1 client | `initOpenNextCloudflareForDev()` | Built-in; reads wrangler.toml; hot-reloads |
| D1 migration tracking | Manual SQL versioning | `wrangler d1 migrations` | Tracks applied migrations in `d1_migrations` table |
| TypeScript env types | Manual `declare` blocks | `wrangler types` (`cf-typegen` script) | Auto-generated from wrangler.toml; always in sync |
| Workers deploy in CI | Custom curl scripts | `cloudflare/wrangler-action@v3` | Official action; handles auth and retries |

**Key insight:** The `@opennextjs/cloudflare` adapter solves dozens of edge cases in making Next.js work on Workers (streaming, chunking, RSC hydration, ISR). Any custom bundling would re-encounter all of them.

---

## Common Pitfalls

### Pitfall 1: Old wrangler.toml Sections Conflict

**What goes wrong:** The existing `wrangler.toml` has `[[pages_build_output]]` and `[build]` sections — Pages-specific config. Leaving these causes `wrangler deploy` to fail or produce wrong behavior.
**Why it happens:** Pages and Workers share `wrangler.toml` format but use different schemas.
**How to avoid:** Completely rewrite the file — do not patch in place. The new file needs `main`, `[assets]`, `[[services]]`, and `[[d1_databases]]` sections.
**Warning signs:** "Cannot use `main` with Pages build output" error.

### Pitfall 2: Existing `cloudflare-deployment.test.ts` Will Break

**What goes wrong:** `src/tests/cloudflare-deployment.test.ts` asserts `output: 'export'`, `distDir: 'dist'`, `@cloudflare/next-on-pages` in devDependencies, and `pages:build` script. All fail after migration.
**Why it happens:** Test was written for the old Pages static export setup.
**How to avoid:** Rewrite this test file in Phase 1. New assertions: (1) `wrangler.toml` has `main = ".open-next/worker.js"` and `nodejs_compat`; (2) `next.config.mjs` does NOT contain `output: 'export'`; (3) `open-next.config.ts` exists; (4) `@opennextjs/cloudflare` is in devDependencies.
**Warning signs:** `npm test` fails immediately with assertion errors.

### Pitfall 3: `compatibility_date` Too Old

**What goes wrong:** Existing `wrangler.toml` has `2024-03-17` which is below the `2024-09-23` minimum required by `@opennextjs/cloudflare`.
**Why it happens:** Workers runtime gates behavior on compatibility dates.
**How to avoid:** Set `compatibility_date = "2024-12-30"` in the new `wrangler.toml`.
**Warning signs:** Build succeeds but runtime fails on first request.

### Pitfall 4: `process.env` Does Not Work in Workers

**What goes wrong:** The existing `/api/leads` route reads `process.env.PERFEX_RE_URL` and `process.env.PERFEX_RE_KEY`. In Workers runtime, `process.env` is unavailable — the route silently fails.
**Why it happens:** Workers runtime does not expose Node.js `process.env`.
**How to avoid:** Update the leads route to use `getCloudflareContext().env`. Add `PERFEX_RE_URL` to `[vars]` in `wrangler.toml`. Add `PERFEX_RE_KEY` via `wrangler secret put PERFEX_RE_KEY`. This is a Phase 1 scope item — the route must not regress.
**Warning signs:** Leads form returns 500; logs show undefined env vars.

### Pitfall 5: D1 `database_id` Must Be Provisioned First

**What goes wrong:** `wrangler d1 migrations apply` fails because the `database_id` placeholder in `wrangler.toml` does not match a real provisioned D1 database.
**Why it happens:** D1 databases are provisioned resources — they must exist in Cloudflare before they can be referenced.
**How to avoid:** First execution step: `wrangler d1 create houston-home-spotlight` (or confirm existing via `wrangler d1 list`). Insert the output UUID into `wrangler.toml`. Requires `wrangler login` / authenticated Cloudflare session.
**Warning signs:** `Error: D1 database not found`.

### Pitfall 6: Cloudflare API Token Permission Scope

**What goes wrong:** Existing `CLOUDFLARE_API_TOKEN` may have "Cloudflare Pages:Edit" scope only. Workers deployment requires "Workers Scripts:Edit" and "D1:Edit" permissions.
**Why it happens:** Pages and Workers deployments require different token scopes.
**How to avoid:** Bernard should verify token permissions in Cloudflare dashboard before the CI step runs. May need a new token.
**Warning signs:** CI deploy step: "Authentication error" or "Forbidden".

### Pitfall 7: `global_fetch_strictly_public` Restricts Internal Fetches

**What goes wrong:** The `global_fetch_strictly_public` flag required by OpenNext prevents `fetch()` calls to internal/localhost URLs in Worker code.
**Why it happens:** Security flag enforced by Cloudflare Workers runtime.
**How to avoid:** The existing leads route fetches `${perfexUrl}/api/v1/leads` — this is fine as long as `PERFEX_RE_URL` is a public HTTPS URL. Never call `fetch('http://localhost:...')` from Worker code.
**Warning signs:** `fetch` calls fail in production but work locally.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@cloudflare/next-on-pages` | `@opennextjs/cloudflare` | Sep 2024 | OpenNext is the official standard; `next-on-pages` is archived |
| `wrangler pages deploy` | `wrangler deploy` | Sep 2024 | Deploy to Workers, not Pages Functions |
| `.vercel/output/static` build path | `.open-next/` build path | Sep 2024 | Different artifact directory |
| `process.env.*` for Workers env vars | `getCloudflareContext().env.*` | Always for Workers | Node.js `process.env` unavailable in Workers |
| `output: 'export'` (fully static) | Dynamic Workers with optional ISR | Phase 1 | Enables auth, D1 queries, webhooks at runtime |

**Deprecated/outdated:**
- `@cloudflare/next-on-pages`: Archived; do not use
- `export const runtime = "edge"`: Not supported; remove
- `wrangler pages dev dist`: Old Pages preview; replaced by `opennextjs-cloudflare preview`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | Build, npm test | ✓ | v26.0.0 | — |
| npm | Package install | ✓ | 11.12.1 | — |
| wrangler CLI | D1 migrations, deploy | ✓ | 4.51.0 (4.99.0 available) | — |
| Cloudflare account login | `wrangler d1 create`, deploy | [ASSUMED] | — | Manual dashboard creation |
| CLOUDFLARE_API_TOKEN (GitHub secret) | CI/CD deploy | [ASSUMED] exists | — | Must be re-scoped if Pages-only |
| CLOUDFLARE_ACCOUNT_ID (GitHub secret) | CI/CD deploy | [ASSUMED] exists | — | — |
| PERFEX_RE_KEY (Wrangler secret) | `/api/leads` | Must be migrated | — | `wrangler secret put PERFEX_RE_KEY` |

**Missing dependencies with no fallback:**
- D1 database must be provisioned before migrations run: `wrangler d1 create houston-home-spotlight`

**Missing dependencies with fallback:**
- wrangler 4.51.0 is installed; update to 4.99.0 is recommended for latest features but not blocking

---

## Security Domain

> `security_enforcement` is enabled (default). ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2) | — |
| V3 Session Management | No (Phase 2) | — |
| V4 Access Control | No (Phase 2) | — |
| V5 Input Validation | Yes — `/api/health` and `/api/leads` | Existing validation in `leads/route.ts`; health has no input |
| V6 Cryptography | No | — |
| V7 Error Handling | Yes | Never expose stack traces; return typed error shapes |
| V14 Configuration | Yes | Secrets via `wrangler secret put`, never committed to `wrangler.toml` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret in `wrangler.toml` | Information Disclosure | `PERFEX_RE_KEY` via `wrangler secret put`; only non-secret `PERFEX_RE_URL` in `[vars]` |
| API route regression after env var migration | Tampering (accidental) | Update `/api/leads` to `getCloudflareContext().env`; verify end-to-end |
| Overpermissioned Cloudflare API token | Elevation of Privilege | Scope to "Workers Scripts:Edit" + "D1:Edit" only |
| D1 injection via raw SQL | Tampering | Phase 1 is DDL-only; no user input touches D1 yet; use `db.prepare().bind()` when queries added in Phase 4 |

---

## Open Questions

1. **Is the D1 database already provisioned in Bernard's Cloudflare account?**
   - What we know: No `database_id` in current `wrangler.toml` (Pages config, not Workers).
   - What's unclear: Whether `wrangler d1 create` has been run previously.
   - Recommendation: First execution step — `wrangler d1 list` to check, then `wrangler d1 create houston-home-spotlight` if absent. Commit UUID to `wrangler.toml`.

2. **Does the existing `CLOUDFLARE_API_TOKEN` have Workers permission?**
   - What we know: Token exists (used for Pages deploy). Scopes may be Pages-only.
   - What's unclear: Token permission scope.
   - Recommendation: Bernard verifies token has "Workers Scripts:Edit" and "D1:Edit" before CI step runs.

3. **How to handle `PERFEX_RE_KEY` in local dev?**
   - What we know: Workers dev uses `.dev.vars` instead of `.env.local`.
   - What's unclear: Whether Bernard has a local `.env` file with these values.
   - Recommendation: Create `.dev.vars` (gitignored) with both `PERFEX_RE_URL` and `PERFEX_RE_KEY` for local dev. Document in plan Wave 0.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Top-level `await import(...)` works in `next.config.mjs` at the project's Next.js 15.5.2 version | Pattern 2 (next.config.mjs) | If ESM top-level await fails, must use `.ts` config extension or synchronous require pattern |
| A2 | `CLOUDFLARE_API_TOKEN` secret exists in repo and can be re-scoped to include Workers+D1 | Environment Availability | Would delay CI/CD until Bernard creates or updates the token |
| A3 | `[[services]] WORKER_SELF_REFERENCE` is required even when no middleware is present | Pattern 3 (wrangler.toml) | If not required, it is harmless extra config |
| A4 | `process.env.NODE_ENV === "production"` during `opennextjs-cloudflare build`, preventing dev-only code from running | Pattern 2 (next.config.mjs) | If NODE_ENV is wrong at build time, `initOpenNextCloudflareForDev()` runs during build and may fail |

---

## Sources

### Primary (MEDIUM confidence)
- [CITED: opennext.js.org/cloudflare/get-started] — open-next.config.ts, wrangler.toml structure, package.json scripts, initOpenNextCloudflareForDev
- [CITED: opennext.js.org/cloudflare/bindings] — getCloudflareContext() binding access pattern
- [CITED: opennext.js.org/cloudflare] — supported Next.js versions, Node Middleware limitation
- [CITED: developers.cloudflare.com/d1/reference/migrations/] — wrangler d1 migrations workflow
- [CITED: developers.cloudflare.com/d1/get-started/] — wrangler d1 create, wrangler d1 execute
- [CITED: github.com/cloudflare/wrangler-action] — GitHub Actions workflow with wrangler-action@v3

### Secondary (MEDIUM confidence — cross-verified)
- [CITED: developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/] — nodejs_compat requirement, compatibility_date minimum
- npm registry — package versions confirmed via `npm view`: @opennextjs/cloudflare@1.19.11, wrangler@4.99.0, @cloudflare/workers-types@4.20260610.1

### Tertiary (LOW confidence)
- freecodecamp.org — workflow shape reference (confirmed against official wrangler-action docs)
- github.com/opennextjs/opennextjs-cloudflare/issues — known bugs: Node Middleware (#525), instrumentation hook (#667)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: MEDIUM — packages confirmed on npm registry; versions from official docs
- Architecture: MEDIUM — patterns from official OpenNext and Cloudflare docs
- D1 Schema: MEDIUM — schema design from REQUIREMENTS.md locked decisions; DDL conventions from D1 docs
- Pitfalls: MEDIUM — mix of official docs and reproducible gotchas (env vars, old wrangler.toml format)

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days — stable APIs; wrangler releases frequently but API shape is stable)
