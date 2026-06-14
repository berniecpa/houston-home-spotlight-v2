---
phase: 04-listings-migration-and-leads
plan: "04"
subsystem: leads-pipeline
tags: [leads, d1, resend, perfex, best-effort, allSettled, dashboard-inbox]
dependency_graph:
  requires: [04-01]
  provides: [d1-lead-source-of-truth, resend-agent-email, perfex-parallel, agent-lead-inbox]
  affects: []
tech_stack:
  added: []
  patterns:
    - D1 INSERT as source of truth before best-effort side effects (LEAD-01)
    - Promise.allSettled for concurrent best-effort Resend + Perfex (LEAD-04)
    - Resend via raw fetch (no SDK) — Workers-compatible (LEAD-02)
    - Slug-to-listing JOIN resolution — never trust body UUID (T-04-11)
    - env as unknown as Record<string, string | undefined> for untyped Workers secrets
    - force-dynamic RSC with getTokens + D1 for dashboard read pages
key_files:
  created:
    - src/lib/leads.ts
    - src/tests/leads-route.test.ts
  modified:
    - src/app/api/leads/route.ts
    - src/app/(dashboard)/dashboard/leads/page.tsx
    - src/tests/leads-api.test.ts
decisions:
  - D1 INSERT is the sole operation that can return 500 — Resend/Perfex failures are logged and swallowed
  - env cast via unknown to Record<string, string | undefined> for secrets not in wrangler-generated CloudflareEnv type
  - leads.ts helper module extracted for testability and separation of concerns
  - No runtime=edge on dashboard page per plan-checker W3 (force-dynamic only)
  - leads.message column mapped from body.description (InquiryForm field name)
metrics:
  duration: "18 minutes"
  completed: "2026-06-14T02:52:35Z"
  tasks_completed: 3
  files_modified: 5
---

# Phase 04 Plan 04: Lead Pipeline — D1 + Resend + Perfex + Inbox Summary

**One-liner:** D1-first lead capture with slug-to-agent JOIN resolution, best-effort Resend agent email (reply_to=buyer, cc=Bernard) and Perfex CRM via Promise.allSettled, plus a force-dynamic dashboard inbox scoped to the signed-in agent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | leads.ts helper + reworked /api/leads route | 4cd7ec5 | src/lib/leads.ts, src/app/api/leads/route.ts, src/tests/leads-route.test.ts, src/tests/leads-api.test.ts |
| 3 | Dashboard lead inbox — per-agent D1 read table | 80bb25e | src/app/(dashboard)/dashboard/leads/page.tsx |

## What Was Built

### src/lib/leads.ts — Best-effort Delivery Helpers

Two exported async helpers, both non-throwing, both designed for Promise.allSettled:

**sendLeadEmail(params)**
- Raw fetch to https://api.resend.com/emails (no SDK — Workers compatible)
- from: LEAD_FROM_EMAIL (must be DNS-verified in Resend dashboard)
- to: listing agent's email (resolved from D1, not trusted from body)
- cc: ADMIN_NOTIFY_EMAIL (Bernard — LEAD-03)
- reply_to: buyer's email (so agent reply goes directly to buyer — LEAD-02)
- Subject: "New Inquiry: ${listingAddress}"
- On non-2xx: logs console.error, does NOT throw

**sendToPerfex(body, env)**
- Extracted verbatim from old route.ts — preserves existing Perfex integration
- POSTs to ${PERFEX_RE_URL}/api/v1/leads with authtoken: PERFEX_RE_KEY
- Returns early (with log) when credentials absent (dev environment)
- On CRM error: logs, does NOT throw

### src/app/api/leads/route.ts — Reworked POST Handler

**Listing inquiry path (listingSlug present):**
1. Validate required fields + email regex (400 before any side effect)
2. JOIN query resolves listing_id + agent_id + agent_email + address from slug — never trusts a body UUID (T-04-11 spoofing mitigation, T-04-15 parameterized bind)
3. 400 if slug resolves to no listing
4. crypto.randomUUID() → INSERT into D1 leads (source of truth — LEAD-01)
5. Only D1 INSERT failure returns 500 (LEAD-04 durability gate)
6. Promise.allSettled([sendLeadEmail(...), sendToPerfex(...)]) — log rejections, never let them alter the 200 response (T-04-14)
7. Return 200 with leadId

**General contact path (no listingSlug):**
- leads.listing_id is NOT NULL — no D1 insert possible
- Best-effort sendToPerfex only
- Returns 200 success — preserves /contact page behavior with zero regression

### src/app/(dashboard)/dashboard/leads/page.tsx — Agent Lead Inbox

- RSC with export const dynamic = 'force-dynamic' (no runtime='edge' per plan-checker W3)
- Re-derives uid from getTokens(cookies(), authEdgeConfig)
- D1 query: SELECT ... FROM leads WHERE agent_id = ? ORDER BY created_at DESC
- Scope enforced by parameterized agent_id = uid — no cross-agent visibility (LEAD-05, T-04-12)
- Renders table: Name, Email (mailto link), Phone (tel link), Message, Date (epoch to locale)
- Empty-state row when agent has no leads
- DB error banner on D1 failure

## Test Results

**npm run typecheck:** CLEAN (0 errors)

**npm test:** 884 pass / 0 fail (up from 850 baseline; 34 new tests from leads-route.test.ts)

**leads-route.test.ts (new):** 34/34 passing — covers D1 insert, allSettled, slug-resolution, no-slug branch, agent_id scoping, all 5 inbox columns, empty state

**leads-api.test.ts (updated):** 43/43 passing — updated to use combined route+leads source for Perfex patterns now in helper module

## Deviations from Plan

### Auto-fixed Issues

**[Rule 1 - Bug] Updated leads-api.test.ts to check combined source after Perfex extraction**
- **Found during:** Task 2 verification run
- **Issue:** 15 of 43 tests in leads-api.test.ts checked route.ts for Perfex patterns (field mapping, CRM API call, authtoken) that were extracted to src/lib/leads.ts. Tests failed.
- **Fix:** Added routeAndLeads() helper concatenating route.ts + leads.ts. Updated 6 describe blocks to use combined source. Updated 500 count from >= 2 to >= 1.
- **Files modified:** src/tests/leads-api.test.ts
- **Commit:** 4cd7ec5

**[Rule 1 - Bug] Fixed TypeScript env cast for untyped Workers secrets**
- **Found during:** Task 2 typecheck run
- **Issue:** env.RESEND_API_KEY fails TS2339 (not in CloudflareEnv). Direct cast also fails TS2352 (insufficient overlap).
- **Fix:** Used env as unknown as Record<string, string | undefined> to safely access runtime secrets.
- **Files modified:** src/app/api/leads/route.ts
- **Commit:** 4cd7ec5

## Deferred Human Validation

1. **D1 lead capture:** Apply migrations 0002+0003 per 04-01, then submit inquiry form in wrangler dev. Confirm D1 leads row written with correct listing_id + agent_id. Confirm 200 success returns to buyer.

2. **Resend agent email + Bernard CC (LEAD-02, LEAD-03):** Set RESEND_API_KEY, LEAD_FROM_EMAIL, ADMIN_NOTIFY_EMAIL in .dev.vars. Submit inquiry — confirm agent receives email with reply_to=buyer; confirm Bernard receives CC. Test best-effort: set invalid RESEND_API_KEY, resubmit — buyer still sees success and D1 row exists.

3. **Perfex CRM parallel delivery:** Ensure PERFEX_RE_URL + PERFEX_RE_KEY present. Submit inquiry — confirm Perfex receives lead in parallel with D1 insert.

4. **General contact form regression:** Submit /contact form (no listingSlug) — confirm 200 success with no D1 insert error.

5. **Dashboard lead inbox (LEAD-05):** Log in as agent, open /dashboard/leads — confirm inquiry appears with all 5 columns. Confirm another agent's leads are NOT visible.

## Known Stubs

None — all code paths are fully wired to real D1 / Resend / Perfex integrations via env vars. No placeholder values.

## Threat Surface Scan

No new trust boundaries beyond the plan's threat model. All mitigations implemented:

| Flag | File | Description |
|------|------|-------------|
| T-04-11 mitigated | src/app/api/leads/route.ts | listing_id + agent_id resolved from slug JOIN, never from request body |
| T-04-12 mitigated | src/app/(dashboard)/dashboard/leads/page.tsx | WHERE agent_id = ? scoped to session uid |
| T-04-13 mitigated | src/lib/leads.ts | RESEND_API_KEY accessed from env only, never logged or returned |
| T-04-14 mitigated | src/app/api/leads/route.ts | Promise.allSettled + per-branch log; buyer success decoupled |
| T-04-15 mitigated | src/app/api/leads/route.ts, src/lib/leads.ts | All D1 queries use .prepare().bind() |

## Self-Check: PASSED

Files verified present on disk:
- src/lib/leads.ts: EXISTS
- src/app/api/leads/route.ts: EXISTS (D1 + allSettled implementation)
- src/tests/leads-route.test.ts: EXISTS (34/34 passing)
- src/tests/leads-api.test.ts: EXISTS (43/43 passing, updated)
- src/app/(dashboard)/dashboard/leads/page.tsx: EXISTS (force-dynamic RSC inbox)

Commits verified:
- 4cd7ec5: Task 1+2 — leads.ts + route.ts + test files
- 80bb25e: Task 3 — dashboard leads inbox page
