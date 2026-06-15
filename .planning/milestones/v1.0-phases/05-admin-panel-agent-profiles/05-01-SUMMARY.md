---
phase: 05-admin-panel-agent-profiles
plan: 01
subsystem: api
tags: [cloudflare-d1, suspension, visibility-gate, slug-generation, firebase-auth]

requires:
  - phase: 04-listing-management
    provides: AGENT_PUBLISHABLE_SQL, listings CRUD API routes, dashboard layout
  - phase: 03-subscription-billing
    provides: AGENT_PUBLISHABLE_SQL definition in subscription.ts, isAgentPublishable

provides:
  - "AGENT_VISIBLE_SQL shared fragment (publishable AND is_suspended=0) in subscription.ts"
  - "Phase 5 visibility gate applied to getAllListings, getListingBySlug, and leads listing-lookup"
  - "Agent slug generation on profile PATCH (kebab-case + numeric suffix on collision)"
  - "Deferred backfill migration 0004_backfill_agent_slugs.sql"
  - "Mutation 403 guards (POST in listings/route.ts; PUT/DELETE/PATCH in [id]/route.ts)"
  - "Dashboard suspension read-only banner in layout.tsx"
  - "Three source-grep test files: visibility-gate, agent-slug, suspension-enforcement"

affects:
  - "05-02-PLAN (agent profile page uses AGENT_VISIBLE_SQL for public reads and agents.slug for URL)"
  - "05-03-PLAN (admin panel suspend/unsuspend toggle builds on is_suspended enforcement)"

tech-stack:
  added: []
  patterns:
    - "AGENT_VISIBLE_SQL: shared SQL fragment composing publishable gate with suspension check"
    - "checkSuspended(): shared helper in [id]/route.ts for suspension gate across PUT/DELETE/PATCH"
    - "slugifyName(): kebab-case name slugifier with empty fallback to agent-<random8>"
    - "Numeric suffix collision loop excluding caller own row (re-save same name = same slug)"

key-files:
  created:
    - db/migrations/0004_backfill_agent_slugs.sql
    - src/tests/visibility-gate.test.ts
    - src/tests/agent-slug.test.ts
    - src/tests/suspension-enforcement.test.ts
  modified:
    - src/lib/subscription.ts
    - src/lib/data.ts
    - src/app/api/leads/route.ts
    - src/app/api/agent/profile/route.ts
    - src/app/api/agent/listings/route.ts
    - src/app/api/agent/listings/[id]/route.ts
    - src/app/(dashboard)/layout.tsx
    - src/tests/data-d1.test.ts
    - src/tests/data.test.ts

key-decisions:
  - "AGENT_VISIBLE_SQL = (AGENT_PUBLISHABLE_SQL) AND a.is_suspended=0 — composition keeps subscription gate intact while adding suspension dimension"
  - "AGENT_PUBLISHABLE_SQL unchanged — remains the subscription-only eligibility gate for listing create"
  - "Backfill migration is 0004 not 0003 — 0003_seed_legacy_listings.sql already existed from Phase 4"
  - "checkSuspended() shared helper in [id]/route.ts — cleaner than inline check in each of three mutating handlers"
  - "Dashboard banner fails toward NOT blocking on D1 error — avoids indefinite lockout on transient D1 fault"

patterns-established:
  - "Visibility gate: AGENT_VISIBLE_SQL wraps publishable + suspension; extend by wrapping not duplicating"
  - "Suspension 403: SELECT is_suspended FROM agents WHERE id = session_uid; return 403 with canonical message"
  - "Slug collision: base slug + numeric suffix loop excluding own row; fallback to name-<random8> on empty"

requirements-completed: [ADMIN-02, ADMIN-04]

duration: 11min
completed: 2026-06-14
---

# Phase 05 Plan 01: Suspension Foundation + Agent Slug Summary

**Shared AGENT_VISIBLE_SQL visibility gate (publishable AND not suspended) applied to public listing browse/detail/leads, plus kebab-case slug generation on profile PATCH with deferred backfill and mutation 403 guards for suspended agents**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-14T00:15:18Z
- **Completed:** 2026-06-14T00:26:39Z
- **Tasks:** 4 executed (Task 5 is a blocking-human checkpoint returned separately)
- **Files modified:** 13 (7 implementation + 3 test files created + 2 existing tests updated + 1 migration)

## Accomplishments

- Added `AGENT_VISIBLE_SQL` to `subscription.ts` composing `AGENT_PUBLISHABLE_SQL` with `a.is_suspended = 0` — single shared fragment eliminates gate drift across browse, detail, and leads paths
- Agent slug generation on profile PATCH: `slugifyName()` (kebab-case, empty fallback to `agent-<random8>`), numeric suffix collision loop excluding own row, written atomically with other profile fields
- Suspension 403 gates on all listing mutations (POST in listings route, PUT/DELETE/PATCH in [id] route); GET remains read-only accessible; dashboard shows "Account suspended" banner with `role="alert"`
- Test suite grew from 914 to 972 (58 new assertions across three source-grep test files); 0 failures

## Task Commits

1. **Task 1: Shared AGENT_VISIBLE_SQL gate + apply to public reads and leads lookup** - `5ea6c02` (feat)
2. **Task 2: Agent slug generation on profile PATCH + deferred backfill migration** - `ac1501b` (feat)
3. **Task 3: Suspension 403 guards on mutations + dashboard read-only banner** - `711bc26` (feat)
4. **Task 4: Full suite green gate** - no new commit (regression gate only — 972 pass / 0 fail)

## Files Created/Modified

- `src/lib/subscription.ts` — Added `AGENT_VISIBLE_SQL` export; `AGENT_PUBLISHABLE_SQL` unchanged
- `src/lib/data.ts` — Import changed to `AGENT_VISIBLE_SQL`; both public query WHEREs updated
- `src/app/api/leads/route.ts` — Import changed to `AGENT_VISIBLE_SQL`; listing-lookup JOIN updated
- `src/app/api/agent/profile/route.ts` — Added `slugifyName()` helper + slug generation with collision loop; UPDATE gains `slug` column
- `src/app/api/agent/listings/route.ts` — POST gains `is_suspended` check after publishability gate
- `src/app/api/agent/listings/[id]/route.ts` — Added `checkSuspended()` helper; PUT/DELETE/PATCH call it before mutation
- `src/app/(dashboard)/layout.tsx` — AgentGateRow gains `is_suspended`; renders suspension banner when suspended
- `db/migrations/0004_backfill_agent_slugs.sql` — One-time slug backfill (application deferred)
- `src/tests/visibility-gate.test.ts` — 18 source-grep assertions (created)
- `src/tests/agent-slug.test.ts` — 20 source-grep assertions (created)
- `src/tests/suspension-enforcement.test.ts` — 20 source-grep assertions (created)
- `src/tests/data-d1.test.ts` — Updated AGENT_PUBLISHABLE_SQL assertions to AGENT_VISIBLE_SQL
- `src/tests/data.test.ts` — Updated AGENT_PUBLISHABLE_SQL assertion to AGENT_VISIBLE_SQL

## Decisions Made

- **AGENT_VISIBLE_SQL as composition** — `(${AGENT_PUBLISHABLE_SQL}) AND a.is_suspended = 0` keeps subscription gate in one place; suspension adds a dimension by wrapping, not copying.
- **AGENT_PUBLISHABLE_SQL unchanged** — Still the eligibility gate for listing create. Suspension uses a separate 403 check.
- **Backfill migration numbered 0004** — `0003_seed_legacy_listings.sql` already existed from Phase 4. Same intent, different number.
- **`checkSuspended()` shared helper** — Cleaner than inline check in each of three mutating handlers; returns `NextResponse | null` matching the `resolveOwnership` pattern already established.
- **Dashboard banner fails toward NOT blocking** — On D1 read error, `isSuspended` defaults to `false` to avoid indefinite lockout on transient infrastructure fault.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Naming] Backfill migration numbered 0004 instead of 0003**
- **Found during:** Task 2 (creating backfill migration)
- **Issue:** Plan specified `0003_backfill_agent_slugs.sql` but `0003_seed_legacy_listings.sql` already exists from Phase 4 execution
- **Fix:** Created `0004_backfill_agent_slugs.sql` — same content and intent, different number to avoid conflict
- **Files modified:** `db/migrations/0004_backfill_agent_slugs.sql`
- **Verification:** Migration file exists with UPDATE agents / WHERE slug IS NULL / DEFERRED markers; agent-slug.test.ts updated to match and passes
- **Committed in:** `ac1501b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (naming conflict)
**Impact on plan:** No behavior change — migration file number differs from plan text but all test assertions and deferred-application semantics are identical.

## Issues Encountered

None — all tasks executed cleanly; typecheck clean throughout; test suite grew from 914 to 972 with 0 failures.

## Known Stubs

None — all implementation is production-wired. The backfill migration is intentionally deferred (not a stub — it requires live agent rows before it can be applied meaningfully).

## Deferred Human Validation

1. **Slug backfill migration application** — `db/migrations/0004_backfill_agent_slugs.sql` must be applied once real agent rows exist:
   - `wrangler d1 migrations apply DB --local` (dev)
   - `wrangler d1 migrations apply DB --remote` (prod)
   - Verify: `SELECT id, display_name, slug FROM agents;` — no NULLs for real agents.

2. **Live suspension round-trip** — In wrangler dev, set an agent's `is_suspended=1` in D1; confirm:
   - Their listings disappear from `/listings` and direct slug URLs return 404
   - Dashboard shows "Account suspended — contact the administrator" banner
   - Create/edit/delete/pause API calls return 403 with the suspended message
   - Set `is_suspended=0` and confirm full restoration

3. **Suspended listing lead guard** — Submit a buyer inquiry on a suspended agent's (now hidden) listing; confirm it returns `"Listing not found."` with status 400 and no lead row is written.

## Next Phase Readiness

- `AGENT_VISIBLE_SQL` is the authoritative public visibility gate — Plans 02 and 03 can import it without re-implementing the gate logic
- `agents.slug` is now generated on profile save — Plan 02's `/agents/[slug]` route can resolve directly from D1
- Suspension enforcement is complete at the API layer — Plan 03 only needs to add the admin PATCH route to flip `is_suspended`
- No blockers for Plans 02/03 in this phase

---
*Phase: 05-admin-panel-agent-profiles*
*Completed: 2026-06-14*
