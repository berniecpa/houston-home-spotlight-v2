---
phase: quick-260616-okh
plan: "01"
subsystem: agent-dashboard
tags:
  - csv-import
  - listings
  - dashboard
  - bulk-upload
dependency_graph:
  requires:
    - src/lib/listings-db.ts (createListing, isSafeHttpUrl, makeUniqueSlug)
    - src/lib/auth-edge.ts (authEdgeConfig)
  provides:
    - POST /api/agent/listings/import
    - parseCsv (src/lib/csv-import.ts)
    - validateListingRow (src/lib/csv-import.ts)
    - makeUniqueSlug (src/lib/listings-db.ts)
    - Import CSV button + results panel (ListingsManager dashboard)
  affects:
    - src/components/dashboard/ListingsManager.tsx
    - src/lib/listings-db.ts
    - package.json (test runner)
tech_stack:
  added: []
  patterns:
    - RFC-4180 hand-rolled CSV parser (no npm dep)
    - Per-row independent validation and insert (one failure does not abort batch)
    - Within-batch slug dedup via Set + numeric suffix counter
    - multipart FormData file upload (hidden input, fetch POST)
key_files:
  created:
    - src/lib/csv-import.ts
    - src/app/api/agent/listings/import/route.ts
    - src/tests/csv-import.test.ts
    - src/tests/agent-listings-import-api.test.ts
  modified:
    - src/lib/listings-db.ts (added makeUniqueSlug export)
    - src/components/dashboard/ListingsManager.tsx (Import CSV button + results panel)
    - package.json (test runner: node --test -> tsx --test)
decisions:
  - "CSV parser is hand-rolled (no npm dep) per plan constraint T-IMP-SC"
  - "admin and agents share the same auth gate — no requireAdmin branch; Bernard's verified session uid suffices"
  - "test runner updated to tsx --test (tsx already in devDependencies) to support TypeScript imports in unit tests"
  - "ListingsManager pre-existing line count violation (706 lines before this task) not addressed — pre-existing"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
---

# Phase quick-260616-okh Plan 01: CSV Bulk Import Summary

## One-Liner

Dependency-free CSV bulk import for agents/admin via POST /api/agent/listings/import with per-row validation, within-batch slug dedup, ordered image insertion, and a dashboard upload button + results panel.

## What Was Built

### Task 1: CSV parser lib + makeUniqueSlug helper

**src/lib/csv-import.ts** (283 lines)
- `parseCsv(text)`: hand-rolled RFC-4180 parser — handles quoted fields (commas inside quotes, `""` escape), CRLF and LF line endings, lower-cased/trimmed header names, skips blank lines. Zero npm dependencies.
- `validateListingRow(record)`: maps raw CSV strings to typed listing fields with full schema enforcement — required fields (title, address, price, beds, baths), numeric coercion (price integer, beds integer, baths decimal, sqft optional integer), city/state defaults ('Houston'/'TX'), featured boolean-ish coercion ('1'/'0'/'true'/'false'), comma-separated image URL splitting + isSafeHttpUrl validation per URL.
- `CsvRowResult` discriminated union: `{ ok: true, fields, imageUrls, featured }` or `{ ok: false, reason }`.
- Security: agent_id/slug/status are NEVER read from the record.

**src/lib/listings-db.ts** (added `makeUniqueSlug` export)
- `makeUniqueSlug(base, taken: Set<string>)`: if base is not in taken, returns it; otherwise appends `-1`, `-2`, etc. until unique. Used by import route for within-batch slug dedup before the DB UNIQUE constraint.

**src/tests/csv-import.test.ts** (31 tests)
- Pure unit tests (no D1, no network): parseCsv (6 tests), validateListingRow valid (4), required field failures (5), numeric validation (4), featured field (6), image URL validation (3), makeUniqueSlug (3).

**package.json** (test script)
- Changed `node --test` to `tsx --test` so the test runner resolves TypeScript imports and `@/` path aliases. `tsx` was already in devDependencies. All 1325 tests pass.

### Task 2: Import route + dashboard UI + source-grep tests

**src/app/api/agent/listings/import/route.ts** (258 lines)
- POST handler: auth via `getTokens(cookieStore, authEdgeConfig)` with 401/403 gates.
- Accepts multipart FormData (`file` field) or raw text/csv body.
- Parses CSV, validates each row independently (failures push to results and continue — one bad row does NOT abort the batch).
- Derives base slug via inline `slugify(title, address)`, deduplicates with `makeUniqueSlug(base, taken)`.
- Image count gate: rows with zero valid image URLs fail with 'at least one image URL required'.
- Inserts via `createListing(db, uid, {...fields, slug}, imageUrls)`.
- Sets `featured=1` via parameterized `UPDATE listings SET featured = ? WHERE id = ?` when requested.
- Returns `{ success: true, imported, failed, results: [{ row, success, id?, slug?, reason? }] }`.
- No `runtime = 'edge'` export.

**src/components/dashboard/ListingsManager.tsx** (additions)
- Added `ImportRowResult` and `ImportResponse` interfaces.
- Added `isImporting`, `importResults` state and `importFileRef` ref.
- `handleImportCsv()` handler: reads chosen file, POSTs FormData to `/api/agent/listings/import`, stores per-row results, calls `refreshListings()` on any successful imports.
- Header row: hidden `<input type="file" accept=".csv">` triggered by "Import CSV" button (`btn-accent touch-target`, aria-labelled, disabled while importing/loading).
- Results panel: dismissable, scrollable list showing "Row N: imported (slug)" or "Row N: failed — reason" for each row.

**src/tests/agent-listings-import-api.test.ts** (12 source-grep tests)
- Verifies: POST exported, no edge runtime, getTokens + authEdgeConfig, 401/403 returns, csv-import imports, listings-db imports, no agent_id from CSV (T-IMP-01), results/row/reason contract, imported/failed counts, uid from decodedToken, parameterized featured UPDATE.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test runner upgrade to tsx**
- **Found during:** Task 1 verification
- **Issue:** The pre-written `csv-import.test.ts` uses direct TypeScript module imports (`import { parseCsv } from '../lib/csv-import.js'`). The existing test runner (`node --test`) cannot resolve `.js` to `.ts` remapping or `@/` path aliases — the test file would fail with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Updated `package.json` `"test"` script from `"node --test"` to `"tsx --test"`. `tsx` was already in devDependencies (`"tsx": "^4.22.4"`). All 1282 existing source-grep tests continue to pass; 43 new tests also pass.
- **Files modified:** `package.json`
- **Commits:** `ce8001d`, `f76461c`

**2. [Pre-existing] ListingsManager.tsx line count**
- The file was already 706 lines before this task (the project's 500-line limit was already violated). Adding the Import CSV feature added approximately 118 lines, bringing it to 824 lines. This pre-existing violation is out of scope for this task.

## Threat Surface Scan

All new endpoints and data flows were covered by the plan's threat model (T-IMP-01 through T-IMP-05). No new security-relevant surface was introduced beyond what the plan specified.

| Flag | File | Description |
|------|------|-------------|
| (none) | — | All surface covered in STRIDE register |

## Known Stubs

None. The import route is fully wired: parseCsv to validateListingRow to createListing to per-row results. The dashboard Import CSV button is wired to the real `/api/agent/listings/import` endpoint.

## Self-Check: PASSED

- src/lib/csv-import.ts: FOUND
- src/app/api/agent/listings/import/route.ts: FOUND
- src/tests/csv-import.test.ts: FOUND
- src/tests/agent-listings-import-api.test.ts: FOUND
- Commit ce8001d: FOUND
- Commit f76461c: FOUND
- npm test: 1325/1325 pass, 0 fail
- typecheck: clean
- lint: clean
- No `export const runtime = 'edge'` in import/route.ts: confirmed
