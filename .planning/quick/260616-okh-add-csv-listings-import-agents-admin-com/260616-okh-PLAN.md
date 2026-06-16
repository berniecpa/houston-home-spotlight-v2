---
phase: quick-260616-okh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/csv-import.ts
  - src/lib/listings-db.ts
  - src/app/api/agent/listings/import/route.ts
  - src/components/dashboard/ListingsManager.tsx
  - src/tests/csv-import.test.ts
  - src/tests/agent-listings-import-api.test.ts
autonomous: true
requirements: [CSV-IMPORT-01, CSV-IMPORT-02, CSV-IMPORT-03, CSV-IMPORT-04, CSV-IMPORT-05, CSV-IMPORT-06]
must_haves:
  truths:
    - "An authenticated agent or admin can upload a CSV from the dashboard and see per-row import results"
    - "Each imported listing is owned by the importer's session uid (never a CSV-supplied agent_id)"
    - "A single malformed row reports its own failure reason and does NOT abort the rest of the import"
    - "Comma-separated image URLs in a CSV cell become ordered listing_images rows"
    - "Auto-generated slugs are unique even when two CSV rows share a title (numeric/short-id suffix on collision)"
    - "Unauthenticated requests to the import route are rejected with 401"
    - "The project's existing 1282 tests remain green"
  artifacts:
    - path: "src/lib/csv-import.ts"
      provides: "Dependency-free CSV parser + per-row schema validation/normalization"
      min_lines: 80
      exports: ["parseCsv", "validateListingRow", "type CsvRowResult"]
    - path: "src/app/api/agent/listings/import/route.ts"
      provides: "POST import route — auth, per-row validate, bulk insert, per-row results"
      exports: ["POST"]
    - path: "src/tests/csv-import.test.ts"
      provides: "Unit tests for parser + validation (quoted fields, defaults, bad rows)"
    - path: "src/tests/agent-listings-import-api.test.ts"
      provides: "Source-grep tests for route auth + per-row result contract"
  key_links:
    - from: "src/app/api/agent/listings/import/route.ts"
      to: "src/lib/csv-import.ts"
      via: "parseCsv + validateListingRow import"
      pattern: "from '@/lib/csv-import'"
    - from: "src/app/api/agent/listings/import/route.ts"
      to: "src/lib/listings-db.ts"
      via: "createListing + isSafeHttpUrl reuse"
      pattern: "from '@/lib/listings-db'"
    - from: "src/components/dashboard/ListingsManager.tsx"
      to: "/api/agent/listings/import"
      via: "fetch POST with FormData body"
      pattern: "api/agent/listings/import"
---

<objective>
Add CSV bulk-import of property listings for authenticated agents and admin. An importer uploads a CSV from the dashboard; the server parses it, validates each row independently against the listings schema, bulk-inserts valid rows (with comma-separated image URLs becoming ordered listing_images), and returns per-row results (imported rows with new id/slug, failed rows with a reason). Each listing is owned by the importer's session uid.

Purpose: Lets agents/admin onboard many listings at once instead of one-at-a-time form entry, reusing the existing create/insert/auth plumbing.
Output: A new CSV parsing/validation lib, a slug-uniqueness helper, a POST import route, a dashboard upload entry point, and tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/lib/listings-db.ts
@src/app/api/agent/listings/route.ts
@src/app/api/agent/listings/[id]/route.ts
@src/components/dashboard/ListingsManager.tsx
@src/lib/admin.ts
@src/tests/agent-listings-api.test.ts

Schema reference (db/migrations/0001_initial_schema.sql):
- listings: id, agent_id, title, slug (UNIQUE), address, city DEFAULT 'Houston', state DEFAULT 'TX', zip, price INTEGER, beds INTEGER, baths REAL, sqft, description, status DEFAULT 'active', featured INTEGER (migration 0002), video_url, video_status, created_at, updated_at
- listing_images: id, listing_id (FK ON DELETE CASCADE), url, display_order, created_at

Key constraints (CLAUDE.md):
- OpenNext/Workers Node runtime — do NOT add `runtime = 'edge'`.
- URL-paste image model only — no file upload, no R2. Image cells are comma-separated URLs.
- Reuse `createListing` and `isSafeHttpUrl` from src/lib/listings-db.ts; do NOT duplicate insert/URL logic.
- JSDoc on all exports; error shape `{ success: boolean, message: string }`; files <500 lines; validate at boundaries.
- Tests are source-grep + pure-unit style (node --test, src/tests/*.test.ts) — no live D1 in tests.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: CSV parser + per-row validation lib and shared slug-uniqueness helper</name>
  <files>src/lib/csv-import.ts, src/lib/listings-db.ts, src/tests/csv-import.test.ts</files>
  <behavior>
    parseCsv:
    - Test: parses a simple header + 2 data rows into array of record objects keyed by header.
    - Test: handles quoted fields containing commas (e.g. "Houston, TX") as a single value.
    - Test: handles quoted fields containing escaped double-quotes ("" -> ").
    - Test: trims a trailing blank line and ignores fully-empty lines.
    validateListingRow(record):
    - Test: valid row returns { ok: true, fields, imageUrls } with city default 'Houston', state default 'TX'.
    - Test: missing title -> { ok: false, reason } mentioning "title".
    - Test: missing address / missing price / missing beds / missing baths each -> ok:false with field-named reason.
    - Test: non-numeric price/beds/baths/sqft -> ok:false with reason naming the offending field (e.g. "price not numeric").
    - Test: featured accepts "1"/"0"/"true"/"false" (case-insensitive) -> 1/0; anything else -> ok:false reason "featured".
    - Test: images cell splits comma-separated URLs into an ordered array; an unsafe (javascript:) URL -> ok:false reason naming images. Empty images cell -> imageUrls: [] (allowed at lib layer; route decides).
    makeUniqueSlug (in listings-db.ts):
    - Test: given a base slug and a Set of taken slugs that already contains it, returns base + a suffix and the returned value is not in the taken set.
    - Test: given a base slug not taken, returns the base unchanged.
  </behavior>
  <action>
    Create src/lib/csv-import.ts (dependency-free, per the constraints — no new npm dep). Export:
    - parseCsv(text): a small hand-rolled parser that handles RFC-4180-style quoted fields (commas inside quotes, doubled double-quote escapes, CRLF/LF). First non-empty line is the header; map each subsequent row to an object keyed by lower-cased trimmed header names. Skip fully-empty lines. Return an array of Record string-to-string.
    - type CsvRowResult: discriminated union — ok:true with { fields (ListingWriteFields minus slug), imageUrls (string array), featured (0 or 1) } OR ok:false with { reason (string) }.
    - validateListingRow(record): implement the column mapping and per-field rules from the locked requirements — required title/address/price/beds/baths; price/beds/baths/sqft numeric (price integer USD, beds integer, baths decimal, sqft optional integer); city default 'Houston', state default 'TX'; featured boolean-ish ("1"/"0"/"true"/"false") to 0 or 1; description/zip optional; images = split the images cell on commas, trim, drop empties, validate each via isSafeHttpUrl (imported from listings-db) — any unsafe URL makes the row fail with a reason naming images. Return ok:false with a human-readable reason (e.g. "price not numeric") on the FIRST failed rule so callers can show "row N: reason". Do NOT read agent_id, slug, or status from the record. Add JSDoc to every export.
    In src/lib/listings-db.ts, add and export makeUniqueSlug(base, taken: Set of string): if base is not in taken, return it; otherwise append a hyphen plus a short suffix (incrementing counter and/or crypto.randomUUID().slice(0,4)) until the result is not in taken. JSDoc it. This dedupes slugs WITHIN one CSV batch (in addition to the DB UNIQUE check), reusing the existing slug derivation style.
    Do NOT relocate the existing inline slugify out of route.ts in this task; the route (Task 2) will derive the base slug and call makeUniqueSlug. Keep each file under 500 lines.
    Create src/tests/csv-import.test.ts covering the behaviors above using node --test + node:assert/strict, matching the existing src/tests style (describe/it, relative imports with .js extensions). Do NOT require live D1.
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -20 && npm run typecheck</automated>
  </verify>
  <done>parseCsv, validateListingRow, CsvRowResult exported from csv-import.ts; makeUniqueSlug exported from listings-db.ts; csv-import.test.ts passes; typecheck clean; existing tests still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST import route (auth + per-row insert) and dashboard upload entry point</name>
  <files>src/app/api/agent/listings/import/route.ts, src/components/dashboard/ListingsManager.tsx, src/tests/agent-listings-import-api.test.ts</files>
  <behavior>
    Route source-grep contracts (matching src/tests/agent-listings-api.test.ts style):
    - Test: route exports POST.
    - Test: route does NOT contain `runtime = 'edge'`.
    - Test: route derives uid via getTokens with authEdgeConfig and returns 401 when tokens are absent.
    - Test: route imports parseCsv + validateListingRow from '@/lib/csv-import'.
    - Test: route imports createListing and makeUniqueSlug from '@/lib/listings-db' (reuse, not re-implement insert).
    - Test: route never reads an agent_id from the parsed CSV record (uid comes from the token).
    - Test: response includes a per-row results array (grep for `results`, a `row` index field, and `reason`).
  </behavior>
  <action>
    Create src/app/api/agent/listings/import/route.ts (Node runtime — NO `runtime = 'edge'`; copy the no-edge comment from the sibling route). Implement POST:
    1. Auth: derive uid via cookies() + getTokens(authEdgeConfig), exactly like src/app/api/agent/listings/route.ts. Return 401 if no tokens; 403 if not email_verified. This covers BOTH agents and admin because admin (Bernard) is also an agent row with a session uid (locked decision 1) — no admin-specific branch; do NOT call requireAdmin.
    2. Read the CSV text: accept a multipart FormData file field named `file` (preferred when content-type is multipart) OR a raw text/csv body via await request.text(). Reject an empty body with 400.
    3. parseCsv(text) into records. If zero data rows, return 400 with message 'CSV has no data rows.'
    4. Get D1 via getCloudflareContext. Seed a per-batch `taken` Set for slug dedupe; rely on the listings.slug UNIQUE constraint as the DB backstop. For each record (track 1-based row index for messages):
       - validateListingRow(record); if ok:false, push { row, success:false, reason } and CONTINUE (one bad row must not abort — locked decision 4).
       - Derive the base slug from title (+address) using the same slugify approach as the sibling route (re-derive inline or import a shared helper); makeUniqueSlug(base, taken); add the result to taken.
       - Image rule parity with create: a row with zero valid image URLs fails with reason 'at least one image URL required' (matches createListing expectations). Document this in JSDoc.
       - Call createListing(env.DB, uid, { ...fields, slug }, imageUrls) inside try/catch; on success push { row, success:true, id, slug }; on a UNIQUE/DB error push { row, success:false, reason:'duplicate slug or database error' } and continue.
       - featured: createListing does not write featured today; when featured===1, issue a parameterized follow-up UPDATE listings SET featured=? WHERE id=? (prepare().bind()). Keep it parameterized.
    5. Return 200 with { success:true, imported:<count>, failed:<count>, results:[...] }. Wrap the whole handler in try/catch returning 500 with the standard { success:false, message } shape. JSDoc the handler and module. Keep file under 500 lines.
    In src/components/dashboard/ListingsManager.tsx, add an "Import CSV" entry point next to the "+ Create listing" button: a hidden file input (accept .csv) triggered by a button, plus a handler that reads the chosen file and POSTs it to /api/agent/listings/import (FormData with field `file`). Store the returned per-row results in component state and render a results panel listing each row outcome ("Row N: imported (slug)" / "Row N: failed — reason"). On success, call the existing refreshListings() so imported rows appear in the table. Follow existing client conventions (useState, setActionError, btn-primary/touch-target classes, aria attributes). Keep the file under 500 lines.
    Create src/tests/agent-listings-import-api.test.ts as source-grep tests mirroring src/tests/agent-listings-api.test.ts, asserting the behaviors listed above.
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -25 && npm run typecheck && npm run lint</automated>
  </verify>
  <done>POST /api/agent/listings/import exists with no edge runtime, 401 on unauthenticated, reuses csv-import + listings-db helpers, returns per-row results, owns rows via session uid; ListingsManager has an Import CSV button + results panel; new tests pass; typecheck + lint clean; full suite (1282 + new) green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| dashboard client → /api/agent/listings/import | Untrusted CSV bytes + session cookie cross here |
| import route → D1 | Validated, parameterized writes only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-IMP-01 | Spoofing | agent_id ownership | mitigate | uid derived from getTokens session token; agent_id NEVER read from CSV/body (locked decision 1) |
| T-IMP-02 | Elevation | unauthenticated import | mitigate | 401 when no tokens; 403 when email unverified — same gate as sibling create route |
| T-IMP-03 | Tampering | SQL injection via CSV cells | mitigate | All writes go through createListing/makeUniqueSlug using prepare().bind(); featured UPDATE parameterized |
| T-IMP-04 | Tampering | hostile image URLs (javascript:/data:) | mitigate | isSafeHttpUrl validates every image URL in validateListingRow before insert (T-04-07 parity) |
| T-IMP-05 | Denial of Service | very large CSV upload | accept | Single authenticated low-volume admin/agent tool; Workers request size limits apply. Re-evaluate if abused |
| T-IMP-SC | Tampering | npm/pip/cargo installs | mitigate | No new dependencies added — CSV parser is hand-rolled per the constraints; nothing to audit |
</threat_model>

<verification>
- npm test — full suite green (existing 1282 + csv-import.test.ts + agent-listings-import-api.test.ts).
- npm run typecheck — no type errors.
- npm run lint — clean.
- grep -rn "runtime = 'edge'" src/app/api/agent/listings/import/ returns nothing.
- Route reads uid from getTokens and not from a CSV agent_id column.
</verification>

<success_criteria>
- An authenticated agent OR admin can POST a CSV to /api/agent/listings/import and receive per-row results.
- Valid rows are inserted into listings + ordered listing_images and owned by the importer's uid.
- A malformed row reports "row N: reason" and does not abort the batch.
- Slugs are unique within a batch and against the DB UNIQUE constraint.
- Unauthenticated requests get 401.
- Dashboard ListingsManager shows an Import CSV control and a results panel; table refreshes on success.
- All tests pass; typecheck and lint clean.
</success_criteria>

<output>
Create `.planning/quick/260616-okh-add-csv-listings-import-agents-admin-com/260616-okh-SUMMARY.md` when done.
</output>
