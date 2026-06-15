---
phase: 05-admin-panel-agent-profiles
fixed_at: 2026-06-14T00:00:00Z
review_path: .planning/phases/05-admin-panel-agent-profiles/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 3
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-06-14
**Source review:** .planning/phases/05-admin-panel-agent-profiles/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Blocker + Critical + Warnings): 6
- Fixed: 6
- Skipped: 3 (all Info — out of critical_warning scope / non-trivial / by-design)
- Tests: 1133 pass / 0 fail (baseline was 1120; +13 new regression assertions)
- Typecheck: clean

## Fixed Issues

### BL-01: Admin pages read D1 and render PII without calling requireAdmin()

**Files modified:** `src/app/(admin)/layout.tsx`, `src/app/(admin)/admin/agents/page.tsx`, `src/app/(admin)/admin/stats/page.tsx`, `src/tests/admin-pages.test.ts`
**Commit:** c1ebb55
**Applied fix:** Converted the `(admin)` layout to an async RSC that calls `requireAdmin()` as a single choke point for `/admin`, `/admin/agents`, and `/admin/stats`. On rejection (missing token OR non-admin claim) it calls `notFound()` (404, does not reveal the admin surface) before any child page reads D1 or renders agent email/stats. Added `export const dynamic = 'force-dynamic'` so the session check runs per-request. Updated the two admin-page security doc comments to reflect the layout guard. Added 3 regression tests asserting the layout calls `requireAdmin`, rejects via `isAdminRejection` + `notFound`, and is async.

### CR-01: Unbounded slug-collision while(true) loop (resource-exhaustion vector)

**Files modified:** `src/app/api/agent/profile/route.ts`, `src/tests/agent-slug.test.ts`
**Commit:** c7d11bf
**Applied fix:** Replaced the unbounded `while (true)` collision resolver with a bounded `for` loop capped at `MAX_SLUG_COLLISION_ATTEMPTS = 50` D1 round-trips; after the cap it falls back to `${baseSlug}-${crypto.randomUUID().slice(0, 8)}` (mirroring the existing empty-base fallback), letting the `agents.slug` UNIQUE constraint be the backstop. Updated the existing suffix-loop test to accept `suffix++` and added 2 regression tests asserting the bound (`MAX_SLUG_COLLISION_ATTEMPTS`, no `while (true)`) and the random-suffix fallback.

### WR-01: Truthy (not strict) admin-claim check

**Files modified:** `src/lib/admin.ts`, `middleware.ts`, `src/tests/admin-agents-api.test.ts`, `src/tests/auth-edge.test.ts`
**Commit:** 0183633
**Applied fix:** Changed `requireAdmin`'s guard from `if (!claims['admin'])` to strict `if (claims['admin'] !== true)`, and the middleware `/admin` gate from `!decodedToken.admin` to `claims['admin'] !== true`. A truthy non-boolean claim (e.g. the string `"false"`) no longer grants admin. Strengthened the existing `requireAdmin` claim test and added regression tests asserting strict `!== true` and the absence of the loose checks in both files.

### WR-02: Suspend toggle never checks affected-row count

**Files modified:** `src/lib/admin.ts`, `src/app/api/admin/agents/[id]/route.ts`, `src/tests/admin-agents-api.test.ts`
**Commit:** f2728e4
**Applied fix:** `setAgentSuspended` now returns `result.meta?.changes ?? 0` (signature `Promise<void>` → `Promise<number>`). The PATCH `/api/admin/agents/[id]` handler returns `404 { success: false, message: 'Agent not found.' }` when `changed === 0` (deleted/stale/fabricated id) instead of falsely reporting success. Added 2 regression tests (returns changed-count; route 404s on 0 rows).

### WR-03: Pagination page param accepts huge values producing absurd OFFSET/UI

**Files modified:** `src/app/(admin)/admin/agents/page.tsx`, `src/app/api/admin/agents/route.ts`, `src/tests/admin-pages.test.ts` (GET-route clamp test added in admin-agents-api.test.ts, committed alongside WR-04)
**Commit:** bf219b2
**Applied fix:** Clamped `?page` to `[1, MAX_PAGE]` (`MAX_PAGE = 1_000_000`) in both the API route and the page, bounding OFFSET. On the page, the displayed `page` is additionally re-clamped to `Math.min(requestedPage, Math.max(1, totalPages))` so an out-of-range request never renders "Page 999999999999999 of N" with nonsensical Prev/Next links. Added a page-clamp regression test.

### WR-04: listAgentsPaginated returns rowsResult.results without a null-guard

**Files modified:** `src/lib/admin.ts`, `src/tests/admin-agents-api.test.ts`
**Commit:** 36da75f
**Applied fix:** Changed `agents: rowsResult.results` to `agents: rowsResult.results ?? []`, symmetric with the existing `countResult?.total ?? 0` guard, so an unexpected null result shape can't 500 the admin page when it calls `agents.length` / `agents.map(...)`. Added a WR-04 regression test (the WR-03 GET-route clamp test rode along in this commit).

## Skipped Issues

### IN-01: 0004_backfill_agent_slugs.sql can produce duplicate or divergent slugs

**File:** `db/migrations/0004_backfill_agent_slugs.sql:28-47`
**Reason:** skipped — out of critical_warning scope and not a trivial fix. Resolving it requires a design decision (document the backfill as best-effort with agent re-save, vs. re-implementing the backfill in app code reusing `slugifyName` + the collision loop) and confirming the `agents.slug` UNIQUE-vs-abort behavior. Needs human direction.
**Original issue:** The SQLite backfill approximates `slugifyName` with chained `replace()` (no punctuation stripping; no numeric-suffix collision resolution), so output can diverge from the app slug or collide for duplicate names.

### IN-02: Suspension banner fails to false on D1 read error

**File:** `src/app/(dashboard)/layout.tsx:111`
**Reason:** skipped — out of critical_warning scope and explicitly flagged by the reviewer as "No action required" / cosmetic. Enforcement is correctly server-side at the mutation routes (403); the banner is advisory only. Changing the fail-open-banner behavior is a deliberate design choice, not a defect.
**Original issue:** `isSuspended` defaults to `false` on a transient D1 read error, so a suspended agent momentarily sees no banner.

### IN-03: isAdminRejection type guard is structurally fragile

**File:** `src/lib/admin.ts:92-94`
**Reason:** skipped — out of critical_warning scope and not trivial. Adding an explicit `kind: 'ok' | 'reject'` discriminant changes the `AdminTokenResult` / `AdminTokenRejection` shapes and the `requireAdmin` return sites, and the guard is security-relevant (an authZ decision) — refactoring it warrants human verification rather than an automated minimal fix. The current two-shape `in`-probing is correct for today's shapes.
**Original issue:** `'status' in result && 'message' in result && !('uid' in result)` could misclassify if a future success shape carries `message` or a rejection gains `uid`.

---

_Fixed: 2026-06-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
