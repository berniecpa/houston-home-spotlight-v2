# Phase 1: Infrastructure Migration - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 8
**Analogs found:** 5 / 8 (3 new-file types with no codebase analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `next.config.mjs` | config | request-response | `next.config.mjs` (self — existing) | exact (modify in place) |
| `open-next.config.ts` | config | — | none | no analog |
| `wrangler.toml` | config | — | existing `wrangler.toml` (Pages) | partial (full rewrite) |
| `package.json` | config | — | `package.json` (self — existing) | exact (modify in place) |
| `db/migrations/0001_initial_schema.sql` | migration | batch | none | no analog |
| `src/app/api/health/route.ts` | route (API) | request-response | `src/app/api/leads/route.ts` | exact (same role + data flow) |
| `src/app/api/leads/route.ts` | route (API) | request-response | self | exact (modify env var reads) |
| `.github/workflows/deploy.yml` | config (CI/CD) | — | `.github/workflows/deploy.yml` (self — existing) | exact (modify in place) |
| `src/tests/cloudflare-deployment.test.ts` | test | — | self (existing, rewrite) | exact (same structure, new assertions) |
| `cloudflare-env.d.ts` | config (types) | — | none | no analog |

---

## Pattern Assignments

### `src/app/api/health/route.ts` (route, request-response)

**Analog:** `src/app/api/leads/route.ts`

**Imports pattern** (`src/app/api/leads/route.ts` lines 10-11):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { LeadFormData, LeadSubmissionResponse } from '@/types';
```

For health route, replace with:
```typescript
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
```

**JSDoc module header pattern** (`src/app/api/leads/route.ts` lines 1-8):
```typescript
/**
 * Health API Route
 *
 * Verifies Cloudflare Workers runtime and D1 binding availability.
 *
 * @module app/api/health/route
 */
```

**Handler signature pattern** (`src/app/api/leads/route.ts` lines 19-21):
```typescript
export async function GET(): Promise<NextResponse> {
  try {
    // handler body
```

Note: GET route takes no parameters — omit `request: NextRequest`.

**Core pattern — D1 binding check** (from RESEARCH.md Pattern 4):
```typescript
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
```

**Error handling pattern** (`src/app/api/leads/route.ts` lines 138-148):
```typescript
  } catch (error) {
    console.error('Error processing lead submission:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while processing your request. Please try again.'
      },
      { status: 500 }
    );
  }
```

For health route, use `{ ok: false, error: String(error) }` shape to distinguish from `LeadSubmissionResponse`.

**FORBIDDEN:** Do not add `export const runtime = 'edge'` — explicitly prohibited by RESEARCH.md.

---

### `src/app/api/leads/route.ts` — modify env var reads (route, request-response)

**Analog:** self (lines 53-54 — the lines being changed)

**Current pattern to replace** (`src/app/api/leads/route.ts` lines 53-54):
```typescript
const perfexUrl = process.env.PERFEX_RE_URL;
const perfexKey = process.env.PERFEX_RE_KEY;
```

**New pattern** (RESEARCH.md Pattern 5):
```typescript
const { env } = await getCloudflareContext({ async: true });
const perfexUrl = env.PERFEX_RE_URL as string | undefined;
const perfexKey = env.PERFEX_RE_KEY as string | undefined;
```

Add to imports (after existing `next/server` import at line 10):
```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
```

All other logic in the file (validation, CRM proxy, error handling) stays unchanged.

---

### `next.config.mjs` — modify (config)

**Analog:** self (existing file, lines 1-10)

**Current file** (`next.config.mjs` lines 1-10 — full file):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

**Target pattern** (RESEARCH.md Pattern 2):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export' REMOVED
  // distDir: 'dist' REMOVED
  images: {
    unoptimized: true,
  },
};

if (process.env.NODE_ENV !== "production") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

export default nextConfig;
```

Remove `output` and `distDir` keys. Add the conditional `initOpenNextCloudflareForDev()` block after the config object, before the export.

---

### `open-next.config.ts` — create new (config)

**Analog:** none in codebase.

**Full file pattern** (RESEARCH.md Pattern 1):
```typescript
// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

No options needed for Phase 1.

---

### `wrangler.toml` — full rewrite (config)

**Analog:** existing `wrangler.toml` (Pages config — incompatible schema; do not patch, rewrite entirely).

**Target pattern** (RESEARCH.md Pattern 3):
```toml
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
# PERFEX_RE_KEY must be set via: wrangler secret put PERFEX_RE_KEY
```

Key pitfall: `compatibility_date` must be `"2024-12-30"` — the existing file has `2024-03-17` which is below OpenNext minimum.

---

### `package.json` — modify scripts and dependencies (config)

**Analog:** self (existing file)

**Scripts to remove** (`package.json` lines 12-14):
```json
"pages:build": "npx @cloudflare/next-on-pages@1",
"pages:deploy": "npm run build && wrangler pages deploy dist",
"pages:preview": "npm run build && wrangler pages dev dist"
```

**Scripts to add:**
```json
"cf:build": "opennextjs-cloudflare build",
"cf:preview": "opennextjs-cloudflare preview",
"cf:deploy": "opennextjs-cloudflare build && wrangler deploy",
"cf:typegen": "wrangler types",
"db:migrate:local": "wrangler d1 migrations apply DB --local",
"db:migrate:remote": "wrangler d1 migrations apply DB --remote"
```

**devDependencies to remove:**
```json
"@cloudflare/next-on-pages": "^1.13.12"
```

**devDependencies to add:**
```json
"@opennextjs/cloudflare": "^1.19.11",
"wrangler": "^4.99.0",
"@cloudflare/workers-types": "^4.20260610.1"
```

Keep all other scripts and dependencies unchanged.

---

### `db/migrations/0001_initial_schema.sql` — create new (migration, batch)

**Analog:** none in codebase. Pattern is pure SQL DDL.

**Full schema** is provided verbatim in RESEARCH.md Pattern 6 (lines 337-422). Key tables: `agents`, `listings`, `listing_images`, `subscriptions`, `stripe_events`, `leads`. All timestamps are `INTEGER` (Unix epoch via `unixepoch()`). All PKs are `TEXT`.

**Grace period SQL pattern** (locked — apply to all future listing queries in Phase 4+):
```sql
JOIN agents a ON listings.agent_id = a.id
WHERE listings.status = 'active'
  AND a.is_suspended = 0
  AND (
    a.subscription_status = 'active'
    OR (a.subscription_status = 'grace' AND a.subscription_grace_until > unixepoch())
  )
```

---

### `.github/workflows/deploy.yml` — rewrite (CI/CD config)

**Analog:** self (existing file lines 1-32 — full rewrite, same structure)

**Existing structure to keep:** `on.push.branches: [main]`, `jobs.deploy.runs-on: ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`, `npm ci` step.

**Steps to replace:**
```yaml
# OLD:
- name: Build
  run: npm run pages:build
- name: Deploy to Cloudflare Pages
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    command: pages deploy .vercel/output/static --project-name=houston-home-spotlight-v2 --branch=main --commit-dirty=true
```

**New steps** (RESEARCH.md Pattern 7):
```yaml
- name: Build (OpenNext)
  run: npx opennextjs-cloudflare build

- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: deploy
```

Note: add `accountId` field — required for Workers (was not in old Pages deploy command).

---

### `src/tests/cloudflare-deployment.test.ts` — rewrite (test)

**Analog:** self (existing file — same test framework, same file structure, new assertions)

**Test framework pattern to preserve** (`src/tests/cloudflare-deployment.test.ts` lines 13-19):
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
```

**JSDoc header pattern** (existing lines 1-11 — update the description):
```typescript
/**
 * Cloudflare Workers Deployment Tests
 *
 * Tests verify that:
 * 1. wrangler.toml has main = ".open-next/worker.js" and nodejs_compat
 * 2. next.config.mjs does NOT contain output: 'export' or distDir: 'dist'
 * 3. open-next.config.ts exists
 * 4. @opennextjs/cloudflare is in devDependencies
 * 5. package.json has cf:build and cf:deploy scripts
 * 6. db/migrations/0001_initial_schema.sql exists with required tables
 */
```

**Assertion pattern to copy** (existing lines 28-56 — `fs.readFileSync` + `assert.ok(content.includes(...))`):
```typescript
it('should have main pointing to worker.js', () => {
  const content = fs.readFileSync(wranglerPath, 'utf-8');
  assert.ok(content.includes('main = ".open-next/worker.js"'), 'wrangler.toml should point to worker.js');
});
```

Remove all assertions for: `output: 'export'`, `distDir: 'dist'`, `bucket = "dist"`, `[build]` section, `pages:build` script, `pages:deploy` script, `@cloudflare/next-on-pages`, and `dist/` directory existence.

---

### `cloudflare-env.d.ts` — create new (config, types)

**Analog:** none in codebase. Auto-generated by `npm run cf:typegen` (`wrangler types`).

Do not hand-write this file. Run `npm run cf:typegen` after `wrangler.toml` is finalized. The command reads `wrangler.toml` bindings and writes typed `interface CloudflareEnv` declarations. Commit the generated output.

---

## Shared Patterns

### API Route Handler Structure
**Source:** `src/app/api/leads/route.ts`
**Apply to:** `src/app/api/health/route.ts`

All API route handlers follow this structure:
- JSDoc `@module` comment at top
- Named `export async function [VERB]` (uppercase HTTP method)
- `Promise<NextResponse<T>>` return type
- Outer `try/catch` wrapping all logic
- `NextResponse.json({ ... }, { status: N })` for all returns
- `console.error(...)` for server-side errors (no structured logging)

```typescript
export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadSubmissionResponse>> {
  try {
    // ...
    return NextResponse.json({ success: true, message: '...' }, { status: 200 });
  } catch (error) {
    console.error('Error ...:', error);
    return NextResponse.json({ success: false, message: '...' }, { status: 500 });
  }
}
```

### Workers Environment Variable Access
**Source:** RESEARCH.md Pattern 4 and 5
**Apply to:** `src/app/api/health/route.ts`, `src/app/api/leads/route.ts`

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
// Inside async handler:
const { env } = await getCloudflareContext({ async: true });
```

Replace all `process.env.FOO` reads with `env.FOO as string | undefined`.

### TypeScript Strict Conventions
**Source:** `tsconfig.json` + CLAUDE.md
**Apply to:** All `.ts` and `.tsx` files

- `import type { ... }` for type-only imports
- `@/` path alias for all internal imports (exception: test files use relative `.js` extension)
- No `as any` casts — use typed generics (e.g., `.first<{ table_count: number }>()`)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `open-next.config.ts` | config | — | No OpenNext config exists in codebase; use RESEARCH.md Pattern 1 verbatim |
| `db/migrations/0001_initial_schema.sql` | migration | batch | No SQL migration files exist; use RESEARCH.md Pattern 6 verbatim |
| `cloudflare-env.d.ts` | types | — | Auto-generated by `wrangler types`; do not hand-write |

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/tests/`, root config files (`next.config.mjs`, `package.json`, `wrangler.toml`, `.github/workflows/deploy.yml`)
**Files read:** 6 source files + 2 planning docs
**Pattern extraction date:** 2026-06-10
