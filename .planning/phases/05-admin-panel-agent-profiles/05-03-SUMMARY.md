---
phase: 05-admin-panel-agent-profiles
plan: 03
subsystem: api
tags: [firebase-auth, cloudflare-d1, admin-panel, suspension, pagination]

requires:
  - phase: 05-admin-panel-agent-profiles
    plan: 01
    provides: AGENT_VISIBLE_SQL, suspension enforcement, agent slug generation

provides:
  - "requireAdmin() server-side admin-claim guard in src/lib/admin.ts (T-05-10 defense in depth)"
  - "listAgentsPaginated(db, limit, offset) paginated SELECT + COUNT(*) in src/lib/admin.ts"
  - "setAgentSuspended(db, agentId, suspended) parameterized UPDATE in src/lib/admin.ts"
  - "getPlatformStats(db) four COUNT queries in src/lib/admin.ts"
  - "GET /api/admin/agents — edge route, requireAdmin, paginated agent list"
  - "PATCH /api/admin/agents/[id] — edge route, requireAdmin, flip is_suspended (agentId from route)"
  - "GET /api/admin/stats — edge route, requireAdmin, four platform counts"
  - "AgentRow.tsx client toggle component PATCHing admin suspend endpoint + router.refresh()"
  - "Admin agents list page (force-dynamic, paginated, 4 columns, Prev/Next, noindex)"
  - "Admin stats page (force-dynamic, 4 stat cards, noindex)"
  - "Admin sidebar nav links to /admin/agents and /admin/stats"

affects:
  - "05-04-PLAN (if any): admin panel is now functional — agents list + suspend + stats wired"

tech-stack:
  added: []
  patterns:
    - "requireAdmin(): getTokens + authEdgeConfig + decodedToken.admin guard; returns typed result or rejection"
    - "isAdminRejection() type guard: routes check this and return 401/403 before D1 work"
    - "Admin edge API routes: requireAdmin first, then D1; agentId always from route params"
    - "Admin pages: force-dynamic RSC reads D1 directly (same pattern as Phase 4 dashboard)"
    - "AgentRow: 'use client', isPending disabled state, router.refresh() on success"

key-files:
  created:
    - src/lib/admin.ts
    - src/app/api/admin/agents/route.ts
    - src/app/api/admin/agents/[id]/route.ts
    - src/app/api/admin/stats/route.ts
    - src/app/(admin)/admin/agents/page.tsx
    - src/app/(admin)/admin/stats/page.tsx
    - src/components/admin/AgentRow.tsx
    - src/tests/admin-agents-api.test.ts
    - src/tests/admin-stats-api.test.ts
    - src/tests/admin-pages.test.ts
  modified:
    - src/app/(admin)/layout.tsx

key-decisions:
  - "requireAdmin returns a typed union (AdminTokenResult | AdminTokenRejection) — routes check isAdminRejection() instead of comparing status codes directly"
  - "DecodedIdToken cast through unknown — Firebase SDK does not declare custom claims; cast decodedToken as unknown as Record<string,unknown> to access .admin without TS error"
  - "Admin pages read D1 directly (not via API route) — RSC pattern consistent with Phase 4 dashboard; stats page does not need a network round-trip"
  - "agentId always from route params (T-05-11) — PATCH /api/admin/agents/[id] resolves id via await params, never from body"
  - "ADMIN_PAGE_SIZE = 25 — per CONTEXT discretion; exported from admin.ts so agents list and suspend route share the constant"

metrics:
  duration: 12min
  started: 2026-06-14T15:41:23Z
  completed: 2026-06-14T15:53:00Z
  tasks_executed: 4
  files_created: 10
  files_modified: 1
  tests_before: 972
  tests_after: 1120
  tests_added: 148
  test_failures: 0
---

# Phase 05 Plan 03: Admin Panel (Agent List + Suspend + Stats) Summary

**requireAdmin() server-side guard + paginated admin agent list with inline suspend/unsuspend toggle + platform stats page — all admin routes re-verify the Firebase admin claim before D1 access**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-14T15:41:23Z
- **Completed:** 2026-06-14T15:53:00Z
- **Tasks:** 4 executed (Task 5 is a blocking-human checkpoint — deferred per autonomous directive)
- **Files created:** 10 (7 implementation + 3 test files)
- **Files modified:** 1 (admin layout sidebar nav)

## Accomplishments

- `src/lib/admin.ts`: `requireAdmin()` reads session via `getTokens(cookieStore, authEdgeConfig)` and checks `decodedToken.admin` — returns typed `AdminTokenResult | AdminTokenRejection` (401 or 403); `listAgentsPaginated(db, limit, offset)` paginates agents via `LIMIT/OFFSET` plus a separate `COUNT(*)`; `setAgentSuspended(db, agentId, suspended)` updates `is_suspended` and `updated_at = unixepoch()` — all via `prepare().bind()`; `getPlatformStats(db)` issues four parallel COUNT queries (totalAgents, activeSubscriptions, totalListings, totalLeads)
- Three edge API routes at `/api/admin/*`: all call `requireAdmin` first (401/403 before D1), all export `runtime = 'edge'`; PATCH route extracts `agentId` from URL params (T-05-11), validates `typeof suspended === 'boolean'` (400 on non-boolean)
- `AgentRow.tsx` (`'use client'`): PATCHes `/api/admin/agents/${agent.id}` with `{ suspended: !isSuspended }`, calls `router.refresh()` on success, shows `isPending` disabled state during flight
- Admin agents page (force-dynamic RSC): reads `?page` searchParam, queries `listAgentsPaginated`, renders 4-column table (Name/Email/Subscription/Account Status) with `AgentRow` per row, Prev/Next pagination, `robots: noindex`
- Admin stats page (force-dynamic RSC): calls `getPlatformStats` directly, renders 4 stat cards (red-700 accent), `robots: noindex`
- Admin layout sidebar: added `/admin/agents` (Agents) and `/admin/stats` (Platform Stats) nav links; red-800 theme and ADMIN badge preserved
- Test suite grew from 972 to 1120 (148 new assertions across three source-grep test files); 0 failures

## Task Commits

1. **Task 1: requireAdmin guard + admin data-access helpers** — `2222e94`
2. **Task 2: Admin API routes — agent list, suspend toggle, platform stats** — `2f21184`
3. **Task 3: Admin pages — agent list, stats, AgentRow toggle, sidebar nav** — `b7b6639`
4. **Task 4: Full suite green gate** — no new commit (regression gate only — 1120 pass / 0 fail)

## Files Created / Modified

**Created:**
- `src/lib/admin.ts` — `requireAdmin`, `listAgentsPaginated`, `setAgentSuspended`, `getPlatformStats`, `AdminAgentRow`, `PlatformStats` interfaces
- `src/app/api/admin/agents/route.ts` — GET paginated agent list (edge runtime, requireAdmin)
- `src/app/api/admin/agents/[id]/route.ts` — PATCH suspend/unsuspend (edge runtime, requireAdmin, agentId from route)
- `src/app/api/admin/stats/route.ts` — GET platform stats (edge runtime, requireAdmin)
- `src/app/(admin)/admin/agents/page.tsx` — force-dynamic RSC; paginated table; AgentRow; Prev/Next; noindex
- `src/app/(admin)/admin/stats/page.tsx` — force-dynamic RSC; 4 stat cards; noindex
- `src/components/admin/AgentRow.tsx` — 'use client'; suspend toggle; isPending state; router.refresh()
- `src/tests/admin-agents-api.test.ts` — 32 assertions for admin.ts
- `src/tests/admin-stats-api.test.ts` — 34 assertions for three API routes
- `src/tests/admin-pages.test.ts` — 34 assertions for pages + AgentRow + layout

**Modified:**
- `src/app/(admin)/layout.tsx` — sidebar nav: added Agents + Platform Stats links

## Decisions Made

- **Typed requireAdmin result union** — `AdminTokenResult | AdminTokenRejection` avoids magic status codes; `isAdminRejection()` type guard makes routes readable; consistent with the project's typed-result pattern from other helpers.
- **DecodedIdToken custom claim cast** — Firebase's `DecodedIdToken` type doesn't declare custom claims like `admin`. Cast through `unknown` to access `.admin` without TS error; documented clearly in JSDoc.
- **Admin pages read D1 directly** — RSC pages call `getCloudflareContext` + `getPlatformStats` / `listAgentsPaginated` directly. Avoids unnecessary HTTP round-trip; same pattern as Phase 4 dashboard.
- **ADMIN_PAGE_SIZE = 25 exported** — constant lives in `admin.ts` and is imported by both the API route and the agents page; single source of truth prevents drift.
- **Parallel COUNT queries in getPlatformStats** — `Promise.all([...])` runs all four COUNTs concurrently; D1 handles them in parallel.

## Deviations from Plan

None — plan executed exactly as written. The only implementation note: TypeScript required casting `DecodedIdToken` through `unknown` to access the custom `admin` claim (Firebase SDK omits custom claims from its type). This is a standard Firebase pattern and does not change behavior.

## Known Stubs

None — all implementation is production-wired. Data flows from real D1 queries.

## Threat Flags

None — no new security surface beyond what the plan's threat model covers. All mitigations applied per the STRIDE threat register:
- T-05-10: requireAdmin in every admin route (401/403 before D1)
- T-05-11: agentId from route params, never body
- T-05-12: all queries via prepare().bind()
- T-05-13: robots noindex on both admin pages
- T-05-14: ADMIN_PAGE_SIZE=25 caps rows per request

## Deferred Human Validation

1. **Admin agent list round-trip** — In wrangler dev (as Bernard with admin claim):
   - Navigate to `/admin/agents` — confirm paginated table shows name/email/subscription status/account status.
   - Click "Suspend" on an agent — confirm the toggle flips and the row shows "Suspended" after router.refresh().
   - Click "Unsuspend" — confirm restoration to "Active".
   - Navigate pages with Prev/Next — confirm pagination works.

2. **Platform stats round-trip** — Navigate to `/admin/stats`:
   - Confirm 4 cards render with counts matching D1 (cross-check: SELECT COUNT(*) FROM agents, etc.).

3. **403 enforcement (non-admin direct call)** — As a standard agent:
   - Call GET /api/admin/agents and PATCH /api/admin/agents/<anyId> directly.
   - Confirm both return 403 with "Forbidden: admin access required" (server-side, not just middleware).

4. **Suspension cross-check with Plan 01/02** — After suspending via admin toggle:
   - Listings disappear from /listings browse.
   - /agents/<slug> returns 404 while suspended.
   - Dashboard shows "Account suspended" banner.
   - Unsuspending restores all of the above.

## Self-Check

- [x] src/lib/admin.ts exists and exports requireAdmin/listAgentsPaginated/setAgentSuspended/getPlatformStats
- [x] src/app/api/admin/agents/route.ts exists (GET paginated agents)
- [x] src/app/api/admin/agents/[id]/route.ts exists (PATCH suspend)
- [x] src/app/api/admin/stats/route.ts exists (GET stats)
- [x] src/app/(admin)/admin/agents/page.tsx exists (force-dynamic, AgentRow, pagination)
- [x] src/app/(admin)/admin/stats/page.tsx exists (force-dynamic, 4 stat cards)
- [x] src/components/admin/AgentRow.tsx exists ('use client', toggle)
- [x] Commits: 2222e94, 2f21184, b7b6639
- [x] Suite: 1120 pass / 0 fail
- [x] Typecheck: clean

## Self-Check: PASSED
