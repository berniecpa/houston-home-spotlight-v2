---
phase: 05-admin-panel-agent-profiles
plan: 02
subsystem: public-profile
tags: [cloudflare-d1, public-profile, pii-safety, force-dynamic, agent-profile, listing-card]

requires:
  - phase: 05-admin-panel-agent-profiles
    plan: 01
    provides: AGENT_VISIBLE_SQL, agents.slug generation, suspension gate

provides:
  - "getAgentProfileBySlug in data.ts: public-safe agent profile + active visible listings query"
  - "src/app/agents/[slug]/page.tsx: force-dynamic RSC returning 404 for unknown/suspended agents"
  - "src/components/AgentProfileHeader.tsx: pure server component with no email/phone props"
  - "48 new source-grep assertions across agent-profile-query.test.ts and agent-profile-page.test.ts"

affects:
  - "05-03-PLAN (admin suspend toggle; profile page now depends on agents.is_suspended via getAgentProfileBySlug)"
  - "public SEO — /agents/[slug] pages are indexable, linked from listings grid"

tech-stack:
  added: []
  patterns:
    - "getAgentProfileBySlug: two-step agent lookup + scoped listings query with two-query image grouping"
    - "AgentProfile interface: public-safe shape (display_name, photo_url, brokerage, license_number, slug, listings)"
    - "force-dynamic RSC with async params (Next.js 15): const { slug } = await params"
    - "AgentProfileHeaderProps: interface with no email/phone fields — PII omission pattern"
    - "Fallback avatar SVG when photo_url is null"

key-files:
  created:
    - src/app/agents/[slug]/page.tsx
    - src/components/AgentProfileHeader.tsx
    - src/tests/agent-profile-query.test.ts
    - src/tests/agent-profile-page.test.ts
  modified:
    - src/lib/data.ts

key-decisions:
  - "Two-step D1 query in getAgentProfileBySlug: (1) agent lookup by slug, (2) scoped active listings + image grouping — avoids JOIN fanout and reuses rowToListing"
  - "is_suspended check in TypeScript (not SQL): agent row fetched first; null returned if is_suspended=1 before listings query runs — clean short-circuit"
  - "AgentProfile exported from data.ts as a TypeScript interface — allows page to type-check the return without duplicating the shape"
  - "force-dynamic + no runtime='edge' on page.tsx per CONTEXT.md and autonomous directive — consistent with listings/[slug]/page.tsx pattern"
  - "Empty-state message rendered in JSX when profile.listings.length === 0 — avoids blank grid on agents with no active listings"

metrics:
  duration: 6min
  started: 2026-06-14T15:31:23Z
  completed: 2026-06-14T15:37:14Z
  tasks: 3 executed (Task 4 is a human-verify checkpoint deferred per autonomous directive)
  files_modified: 1
  files_created: 4
---

# Phase 05 Plan 02: Public Agent Profile Page Summary

**Public /agents/[slug] force-dynamic RSC using getAgentProfileBySlug (PII-safe query with AGENT_VISIBLE_SQL gate, suspension null return) + AgentProfileHeader with no email/phone props, ListingCard grid reuse, and 48 new source-grep tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-14T15:31:23Z
- **Completed:** 2026-06-14T15:37:14Z
- **Tasks:** 3 executed (Task 4 is a human-verify checkpoint deferred per autonomous directive)
- **Files created:** 4 (page, component, 2 test files)
- **Files modified:** 1 (data.ts)

## Accomplishments

- Added `getAgentProfileBySlug(slug)` to `data.ts`: Step 1 fetches agent by slug (public-safe columns only, no email/phone), returns null if missing or `is_suspended=1`; Step 2 runs two-query image grouping scoped to that agent with `AGENT_VISIBLE_SQL AND l.status='active'` and maps via `rowToListing`
- Created `AgentProfile` interface exported from `data.ts` with `display_name, photo_url, brokerage, license_number, slug, listings` — no email/phone
- Created `/agents/[slug]/page.tsx` as force-dynamic RSC (no `runtime='edge'`): awaits async Next.js 15 params, calls `notFound()` on null return (unknown slug OR suspended agent), renders `AgentProfileHeader` + `ListingCard` grid with empty-state fallback
- Created `AgentProfileHeader.tsx` as pure server component: `AgentProfileHeaderProps` omits email/phone; renders agent photo via `next/image` with fallback SVG avatar; displays brokerage and license number
- Test suite grew from 972 to 1020 (48 new assertions across two source-grep test files); 0 failures

## Task Commits

1. **Task 1: getAgentProfileBySlug + agent-profile-query.test.ts** — `7d1d8d5` (feat)
2. **Task 2: /agents/[slug] page + AgentProfileHeader + agent-profile-page.test.ts** — `15eae55` (feat)
3. **Task 3: Full suite green gate** — no new commit (regression gate only — 1020 pass / 0 fail)

## Files Created/Modified

- `src/lib/data.ts` — Added `AgentProfile` interface + `getAgentProfileBySlug()` function (~100 lines)
- `src/app/agents/[slug]/page.tsx` — New force-dynamic RSC public profile page (~130 lines)
- `src/components/AgentProfileHeader.tsx` — New pure server presentation component (~110 lines)
- `src/tests/agent-profile-query.test.ts` — 20 source-grep assertions for data.ts (created)
- `src/tests/agent-profile-page.test.ts` — 28 source-grep assertions for page + header (created)

## Decisions Made

- **Two-step D1 query** — Agent row fetched first; on null or `is_suspended=1`, function returns null immediately without hitting the listings query. Clean short-circuit; avoids unnecessary D1 reads for suspended/unknown agents.
- **is_suspended check in TypeScript not SQL** — The agent profile query selects `is_suspended` and the TypeScript code checks it before querying listings. Simpler than adding a WHERE clause condition while still SELECT-ing the column.
- **AgentProfile exported interface** — Exported so the page and future consumers can type-check the return shape without duplicating field declarations.
- **No `runtime = 'edge'` on page** — Per CONTEXT.md and the autonomous directive. Consistent with `listings/[slug]/page.tsx`.
- **Empty-state in JSX** — When `profile.listings.length === 0`, renders a card with "no active listings" message rather than an empty grid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test false positive: 'use client' in JSDoc comment matched string check**
- **Found during:** Task 2 test authoring
- **Issue:** `AgentProfileHeader.tsx` JSDoc comment says "No 'use client' directive" — the phrase appears inside `/** ... */`. The initial test assertion `!header.includes("'use client'")` failed because of the comment text, not an actual directive.
- **Fix:** Strip block comments and line comments from the header source before checking for the directive string. Changed to `header.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')` before the `includes()` check.
- **Files modified:** `src/tests/agent-profile-page.test.ts`
- **Commit:** Inline fix during Task 2 (same commit `15eae55`)

## Known Stubs

None — all implementation is production-wired. `getAgentProfileBySlug` queries live D1; the page and header render real data. No hardcoded placeholders in the rendering path.

## Threat Flags

No new threat surface beyond what the plan's threat model covered. All mitigations implemented:

- T-05-06: email/phone never selected in query; `AgentProfileHeaderProps` has no email/phone fields; page never renders them
- T-05-07: `is_suspended === 1` causes null return; `notFound()` on null in page
- T-05-08: slug bound via `.bind()` — no string concatenation
- T-05-09: `photo_url` rendered via `next/image src` (not raw `<img>`)

## Deferred Human Validation

1. **Visual profile page render** — Visit `/agents/[slug]` in wrangler dev (after slug backfill from Plan 01 is applied): confirm display_name, photo, brokerage, license number render; confirm no email/phone in page source.
2. **Listings grid on profile** — Confirm active visible listings appear as `ListingCard` components; confirm suspended/non-subscribed agent listings are hidden.
3. **Empty-state** — Create a test agent with no active listings; confirm empty-state message renders.
4. **404 for unknown slug** — Visit `/agents/unknown-slug`; confirm HTTP 404.
5. **Suspension round-trip** — Set `is_suspended=1` on a real agent in D1; confirm `/agents/[slug]` returns 404; set back to 0 and confirm profile returns.

## Self-Check: PASSED

- src/lib/data.ts — FOUND
- src/app/agents/[slug]/page.tsx — FOUND
- src/components/AgentProfileHeader.tsx — FOUND
- src/tests/agent-profile-query.test.ts — FOUND
- src/tests/agent-profile-page.test.ts — FOUND
- .planning/phases/05-admin-panel-agent-profiles/05-02-SUMMARY.md — FOUND
- Commit 7d1d8d5 — FOUND
- Commit 15eae55 — FOUND
- getAgentProfileBySlug in data.ts — FOUND
- No email in page.tsx — CONFIRMED
- No phone in page.tsx — CONFIRMED
