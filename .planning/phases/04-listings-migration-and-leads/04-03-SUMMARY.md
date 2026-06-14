---
phase: 04-listings-migration-and-leads
plan: "03"
subsystem: ui
tags: [next.js, rsc, force-dynamic, d1, listings, cloudflare, filter]

requires:
  - phase: 04-01
    provides: d1-listing-read-path (getAllListings/getListingBySlug with AGENT_PUBLISHABLE_SQL gate)

provides:
  - force-dynamic detail page (no generateStaticParams, subscription gate via getListingBySlug)
  - RSC browse page (force-dynamic, D1 getAllListings, delegates to ListingsClient)
  - ListingsClient client component (filter state, FilterBar, responsive grid, empty states)
  - force-dynamic home page (featured grid reads D1 per request)
  - test suite sealed at 0 failures (850 passing)

affects: [04-04, 04-05]

tech-stack:
  added: []
  patterns:
    - RSC + client component split for force-dynamic data + interactive filters
    - export const dynamic = 'force-dynamic' on pages (no runtime='edge' -- @opennextjs/cloudflare ignores on pages)
    - Server component fetches D1, client component receives data as initialListings prop
    - notFound() on subscription-gated 404 (hidden/lapsed/paused null return triggers notFound)

key-files:
  created:
    - src/app/listings/ListingsClient.tsx
  modified:
    - src/app/listings/[slug]/page.tsx
    - src/app/listings/page.tsx
    - src/app/page.tsx
    - src/tests/listings-page.test.ts
    - src/tests/responsive-design.test.ts

key-decisions:
  - "force-dynamic on all public listing pages (not runtime='edge') -- @opennextjs/cloudflare ignores runtime on pages"
  - "RSC+ListingsClient split: server fetches D1 once, client handles filter state with no loading spinner (data pre-loaded)"
  - "generateStaticParams removed from detail page -- D1 read path is per-request, not build-time static"
  - "responsive-design.test.ts updated to check both page.tsx and ListingsClient.tsx for grid class after RSC split"

patterns-established:
  - "RSC page + client component: page.tsx is force-dynamic RSC that fetches data; *Client.tsx receives it as props"
  - "No loading spinner in RSC pattern -- data arrives pre-loaded from server, client renders immediately"

requirements-completed: [LIST-04, LIST-07]

duration: 4min
completed: "2026-06-14"
---

# Phase 04 Plan 03: Public Read Path — Force-Dynamic D1 Conversion Summary

**force-dynamic D1 read path: /listings (RSC+ListingsClient), /listings/[slug] (no generateStaticParams), and home featured grid all read Cloudflare D1 per request with subscription gate; test suite sealed at 850 pass / 0 fail**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-06-14T02:36:22Z
- **Completed:** 2026-06-14T02:40:00Z
- **Tasks:** 2 auto tasks completed (checkpoint deferred per autonomous directive)
- **Files modified:** 5

## Accomplishments

- Converted `/listings/[slug]/page.tsx` to force-dynamic: removed `generateStaticParams` and `getAllListings` import, added `export const dynamic = 'force-dynamic'`; fixes all 4 pre-existing test failures from 04-01
- Converted `/listings/page.tsx` to RSC: removed `'use client'`, hooks, JSON dynamic imports; reads D1 via `getAllListings()` and delegates to new `ListingsClient` component
- Created `src/app/listings/ListingsClient.tsx` — `'use client'` component with verbatim filter UX (hero, breadcrumb, FilterBar, results-count, both empty states, responsive ListingCard grid, no loading spinner)
- Added `export const dynamic = 'force-dynamic'` to home page so featured grid reads D1 per request
- Sealed test suite at 850 pass / 0 fail (was 844 pass / 4 fail before this plan)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Detail page force-dynamic + home page force-dynamic | b705fbe | src/app/listings/[slug]/page.tsx, src/app/page.tsx |
| 2 | Browse page RSC + ListingsClient + test updates | 797b8f2 | src/app/listings/page.tsx, src/app/listings/ListingsClient.tsx, src/tests/listings-page.test.ts, src/tests/responsive-design.test.ts |

**Plan metadata commit:** (see final docs commit recorded below)

## Files Created/Modified

- `src/app/listings/[slug]/page.tsx` — Added `export const dynamic = 'force-dynamic'`; removed `generateStaticParams` function and `getAllListings` import
- `src/app/page.tsx` — Added `export const dynamic = 'force-dynamic'` for per-request D1 featured grid
- `src/app/listings/page.tsx` — Rewritten as force-dynamic RSC: fetches D1 via `getAllListings()`, renders `<ListingsClient initialListings={listings} />`
- `src/app/listings/ListingsClient.tsx` — New `'use client'` component with full filter UX (created)
- `src/tests/listings-page.test.ts` — Rewritten to assert RSC architecture (page.tsx: force-dynamic/no-hooks; ListingsClient.tsx: use-client/filters/grid)
- `src/tests/responsive-design.test.ts` — Updated grid-layout check to scan both page.tsx and ListingsClient.tsx

## Decisions Made

- Used `export const dynamic = 'force-dynamic'` on all public pages, NOT `runtime='edge'` per plan constraint (@opennextjs/cloudflare ignores runtime on pages)
- RSC+ListingsClient split chosen: server fetches D1 once per request, client receives as prop — no loading spinner (data pre-loaded server-side)
- `generateStaticParams` fully removed (not retained as empty function) — force-dynamic is incompatible with static param generation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated responsive-design.test.ts grid check to scan both files**
- **Found during:** Task 2 (after converting page.tsx to RSC)
- **Issue:** `responsive-design.test.ts` line 138-144 read `listings/page.tsx` for `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — this class is now in `ListingsClient.tsx` (RSC split moves grid JSX to client component). Test failed with 1 remaining failure after Task 2.
- **Fix:** Updated assertion to read both `page.tsx` and `ListingsClient.tsx` and check the combined content for the grid class
- **Files modified:** `src/tests/responsive-design.test.ts`
- **Verification:** `npm test` returned 850 pass / 0 fail
- **Committed in:** 797b8f2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test checked wrong file after RSC split refactor)
**Impact on plan:** Fix necessary to maintain 0-failure test requirement. No scope creep — same behavioral assertion, updated to correct file location.

## Issues Encountered

None — all changes executed cleanly. The responsive-design.test.ts issue was detected immediately after Task 2 test run and fixed in the same commit.

## Deferred Human Validation

Per the autonomous directive (live D1 round-trips deferred until migrations applied):

1. **Apply D1 migrations** (from 04-01):
   - `npx wrangler d1 migrations apply DB --local` (applies 0002 featured column + 0003 seed)
   - Prerequisite: Bernard admin agents row must exist (log in once, run set-admin-claim script)

2. **Live /listings browse verification**:
   - `wrangler dev` or `npm run dev`
   - Visit `/listings` — confirm 3 legacy listings render with hero, filters, results count, and responsive card grid
   - Apply price/beds filter — confirm instant client-side filtering works

3. **Live /listings/[slug] detail verification**:
   - Visit `/listings/heights-bungalow-historic`, `/listings/riverside-terrace-modern-craftsman`, `/listings/sugarland-estate-pool`
   - Confirm gallery, stats, description, and inquiry form intact at original URLs

4. **Home featured grid verification**:
   - Visit home page — confirm featured grid shows riverside-terrace listing (featured=1 in seed)

5. **Subscription gate verification**:
   - Pause a listing in D1: `UPDATE listings SET status='paused' WHERE slug='heights-bungalow-historic'`
   - Confirm it disappears from /listings and its slug URL returns 404

## Known Stubs

None — all pages wire to D1-backed data layer (live read path fully implemented). Validation of live behavior pending human verification (migrations must be applied first).

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary surfaces introduced. Subscription gate enforced by `getAllListings` and `getListingBySlug` in `src/lib/data.ts` (AGENT_PUBLISHABLE_SQL + status='active' constraint). T-04-09 (Information Disclosure on /listings) is mitigated as designed.

## Next Phase Readiness

- Public listing read path is fully D1-backed with subscription gate — ready for 04-04 (listing CRUD API) and 04-05 (agent dashboard listings UI)
- The 3 legacy slugs will resolve at original URLs once migration 0003 is applied
- Test suite sealed at 0 failures — all downstream work starts from a green baseline

## Self-Check: PASSED

Files verified present:
- src/app/listings/[slug]/page.tsx: EXISTS (force-dynamic, no generateStaticParams)
- src/app/listings/page.tsx: EXISTS (RSC, no 'use client')
- src/app/listings/ListingsClient.tsx: EXISTS (new, 'use client')
- src/app/page.tsx: EXISTS (force-dynamic)
- src/tests/listings-page.test.ts: EXISTS (updated for RSC architecture)
- src/tests/responsive-design.test.ts: EXISTS (grid check updated)

Commits verified:
- b705fbe: Task 1 — detail page force-dynamic + home page force-dynamic
- 797b8f2: Task 2 — browse RSC + ListingsClient + test updates

Test results: 850 pass / 0 fail

---
*Phase: 04-listings-migration-and-leads*
*Completed: 2026-06-14*
