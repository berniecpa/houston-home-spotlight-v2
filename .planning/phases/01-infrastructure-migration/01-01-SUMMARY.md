---
phase: 01-infrastructure-migration
plan: "01"
subsystem: build-system
tags:
  - cloudflare-workers
  - opennextjs
  - d1
  - adapter-migration
dependency_graph:
  requires: []
  provides:
    - "@opennextjs/cloudflare adapter configured"
    - "wrangler.toml Workers config"
    - "D1 migration schema"
    - "Workers env var pattern in /api/leads"
  affects:
    - "02-d1-schema-health-check"
    - "03-ci-cd-pipeline"
tech_stack:
  added:
    - "@opennextjs/cloudflare@1.19.11"
    - "wrangler@4.99.0"
    - "@cloudflare/workers-types@4.20260610.1"
    - "next@15.5.19 (upgraded from 15.5.2)"
  patterns:
    - "getCloudflareContext({ async: true }).env for all Workers env reads"
    - "defineCloudflareConfig() in open-next.config.ts"
    - "initOpenNextCloudflareForDev() conditional guard in next.config.mjs"
key_files:
  created:
    - open-next.config.ts
    - db/migrations/0001_initial_schema.sql
  modified:
    - package.json
    - next.config.mjs
    - wrangler.toml
    - src/app/api/leads/route.ts
    - src/tests/cloudflare-deployment.test.ts
    - src/tests/integration.test.ts
    - src/tests/leads-api.test.ts
    - src/tests/project-setup.test.ts
decisions:
  - "Upgraded next to 15.5.19 to satisfy @opennextjs/cloudflare@1.19.11 peer dependency (required next>=15.5.18)"
  - "Created db/migrations/0001_initial_schema.sql in Plan 01 (technically Plan 02 scope) because cloudflare-deployment.test.ts Block 5 asserts its existence and npm test must pass"
  - "43 pre-existing test failures (listing-detail-page, listings-page) are confirmed pre-existing and deferred to Phase 4 — NOT caused by this plan"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-10"
  tasks_completed: 2
  files_modified: 8
  files_created: 2
requirements:
  - INFRA-01
  - INFRA-02
---

# Phase 01 Plan 01: OpenNext Adapter Migration Summary

**One-liner:** Replaced archived @cloudflare/next-on-pages with @opennextjs/cloudflare, rewired wrangler.toml for Workers runtime, migrated /api/leads env vars to getCloudflareContext, applied D1 schema, and rewrote deployment tests for Workers assertions.

## What Was Built

This plan migrated the build system and Cloudflare adapter from the archived static Pages export approach to the dynamic Workers runtime approach.

**Adapter swap:** `@cloudflare/next-on-pages` removed; `@opennextjs/cloudflare@1.19.11`, `wrangler@4.99.0`, `@cloudflare/workers-types@4.20260610.1` installed.

**next.config.mjs:** Removed `output: 'export'` and `distDir: 'dist'`. Added `initOpenNextCloudflareForDev()` conditional guard for local dev D1 binding resolution.

**open-next.config.ts:** New file with `defineCloudflareConfig()` default export — required by `opennextjs-cloudflare build`.

**wrangler.toml:** Full rewrite from Pages config (`[build]`, `[[pages_build_output]]`, `bucket = "dist"`) to Workers config (`main = ".open-next/worker.js"`, `compatibility_date = "2024-12-30"`, `nodejs_compat`, `[assets]`, `[[services]]`, `[[d1_databases]]`, `[vars]`).

**package.json scripts:** Removed `pages:build`, `pages:deploy`, `pages:preview`. Added `cf:build`, `cf:preview`, `cf:deploy`, `cf:typegen`, `db:migrate:local`, `db:migrate:remote`.

**src/app/api/leads/route.ts:** Replaced `process.env.PERFEX_RE_URL` and `process.env.PERFEX_RE_KEY` with `getCloudflareContext({ async: true }).env` pattern.

**db/migrations/0001_initial_schema.sql:** D1 schema with 6 tables: `agents`, `listings`, `listing_images`, `subscriptions`, `stripe_events`, `leads` plus 6 indexes.

**Tests:** Rewrote `cloudflare-deployment.test.ts` with 6 Workers assertion blocks (43 tests, all passing). Updated 3 other test files to fix assertions broken by migration.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install OpenNext adapter, rewrite wrangler.toml and next.config.mjs | 7486fba | package.json, package-lock.json, next.config.mjs, open-next.config.ts, wrangler.toml |
| 2 | Fix /api/leads Workers env vars, rewrite deployment tests, add D1 schema | 8641a25 | src/app/api/leads/route.ts, src/tests/cloudflare-deployment.test.ts, src/tests/integration.test.ts, src/tests/leads-api.test.ts, src/tests/project-setup.test.ts, db/migrations/0001_initial_schema.sql |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js version peer dependency conflict**
- **Found during:** Task 1 (npm install)
- **Issue:** `@opennextjs/cloudflare@1.19.11` requires `next>=15.5.18`, but project had `next@^15.5.2` (installed at 15.5.2). Conflict also triggered by `@cloudflare/next-on-pages` requiring `next<=15.5.2`, preventing simultaneous install.
- **Fix:** Uninstalled `@cloudflare/next-on-pages` first, then upgraded `next` to `15.5.19` to satisfy peer dependency. This is a patch-level upgrade within the existing `^15.5.x` semver range intent.
- **Files modified:** package.json, package-lock.json
- **Commit:** 7486fba

**2. [Rule 2 - Missing Critical] D1 migration file created in Plan 01 (not Plan 02)**
- **Found during:** Task 2 (test rewrite)
- **Issue:** `cloudflare-deployment.test.ts` Block 5 asserts `db/migrations/0001_initial_schema.sql` exists and contains CREATE TABLE statements for agents, listings, and leads. The plan's task is to rewrite the test file AND ensure `npm test` passes. Without the migration file, Block 5 would fail.
- **Fix:** Created `db/migrations/0001_initial_schema.sql` using the exact schema from RESEARCH.md Pattern 6.
- **Files created:** db/migrations/0001_initial_schema.sql
- **Commit:** 8641a25

**3. [Rule 1 - Bug] Fixed 4 additional test files broken by migration**
- **Found during:** Task 2 (npm test run)
- **Issue:** After Task 1 changes, 4 tests broke due to stale assertions:
  - `integration.test.ts`: `wrangler.toml should have bucket configuration` — now Workers config has no `bucket`
  - `project-setup.test.ts`: `next.config.mjs should have output: export` — removed by migration
  - `project-setup.test.ts`: `Next.js should be version 14.x` — upgraded to 15.5.19
  - `leads-api.test.ts` (x2): `should read PERFEX_RE_URL/KEY from process.env` — migrated to Workers env
- **Fix:** Updated all 4 test files to assert the new Workers patterns.
- **Files modified:** src/tests/integration.test.ts, src/tests/project-setup.test.ts, src/tests/leads-api.test.ts
- **Commit:** 8641a25

## Known Stubs

None — all configuration files have real values. `PERFEX_RE_URL = ""` in wrangler.toml `[vars]` is intentionally empty (non-secret placeholder; real value set via Cloudflare Dashboard vars).

The D1 `database_id = "PLACEHOLDER_RUN_wrangler_d1_create_to_get_UUID"` is an intentional placeholder — the real UUID requires `wrangler d1 create houston-home-spotlight` (which requires Cloudflare auth) and is documented in RESEARCH.md Pitfall 5. This does not block the plan's goal.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-01-01 | wrangler.toml | PERFEX_RE_URL set as empty string in [vars] (correct — non-secret only); PERFEX_RE_KEY absent from file (correct — must use wrangler secret put) |
| threat_flag: T-01-02 | src/app/api/leads/route.ts | Both process.env reads replaced; Block 6 test confirms no process.env.PERFEX remains |

T-01-SC (package legitimacy): All three packages approved in RESEARCH.md Package Legitimacy Audit prior to installation.

## Pre-existing Deferred Items

43 test failures confirmed pre-existing (before Plan 01 execution) via git stash verification:
- `src/tests/listing-detail-page.test.ts`: 4 failures — Next.js 14-style params vs 15 Promise params
- `src/tests/listings-page.test.ts`: 39 failures — stale assertions against unimplemented spec

Documented in `.planning/phases/01-infrastructure-migration/deferred-items.md`.

## Test Results

| Suite | Tests | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| cloudflare-deployment.test.ts | 43 | 43 | 0 | All new Workers assertions pass |
| integration.test.ts | 45 | 45 | 0 | Fixed wrangler.toml assertion |
| leads-api.test.ts | 35 | 35 | 0 | Fixed env var assertions |
| project-setup.test.ts | 19 | 19 | 0 | Fixed next.config.mjs + version assertions |
| All other suites | 464 | 421 | 43 | 43 pre-existing failures (deferred) |
| **Total** | **606** | **563** | **43** | All 43 failures pre-existing |

## Self-Check: PASSED

All files verified:
- open-next.config.ts: FOUND
- wrangler.toml: FOUND (Workers format)
- next.config.mjs: FOUND (no output:export)
- db/migrations/0001_initial_schema.sql: FOUND
- 01-01-SUMMARY.md: FOUND

All commits verified:
- 7486fba: FOUND (Task 1)
- 8641a25: FOUND (Task 2)
