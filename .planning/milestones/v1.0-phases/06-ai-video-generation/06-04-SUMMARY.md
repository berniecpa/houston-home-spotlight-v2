---
phase: 06-ai-video-generation
plan: 04
subsystem: video-ui
tags: [video, dashboard, polling, ui, accessibility, public-page, w1-fix]
dependency_graph:
  requires:
    - src/app/api/agent/listings/[id]/video/route.ts (POST trigger — 06-02)
    - src/app/api/agent/listings/[id]/video-status/route.ts (GET status poll — 06-02)
    - src/lib/video/jobs.ts (job state — 06-01)
    - src/types/index.ts (Listing.videoUrl already present)
  provides:
    - src/components/dashboard/ListingsManager.tsx (Generate Video button + polling + status badges)
    - src/app/(dashboard)/dashboard/listings/page.tsx (W1 fix: SELECT video_status/video_url)
    - src/tests/video-ui.test.ts (29 source-grep tests)
  affects:
    - src/app/listings/[slug]/page.tsx (native <video> render replacing placeholder)
tech_stack:
  added: []
  patterns:
    - setInterval/clearInterval polling pattern with hard cap (5 min / T-06-10)
    - Optimistic status update on trigger + server-confirmed terminal state
    - aria-live="polite" + role="status" for live video status region
    - W1 SELECT extension pattern (add columns to existing D1 query, pass through initialListings)
    - Mount-resume pattern for in-progress polling across page refreshes
key_files:
  created:
    - src/tests/video-ui.test.ts
  modified:
    - src/components/dashboard/ListingsManager.tsx
    - src/app/(dashboard)/dashboard/listings/page.tsx
    - src/app/listings/[slug]/page.tsx
decisions:
  - "Poll interval set at 4 000 ms (within the 3-5 s range specified in plan)"
  - "Hard poll cap: 5 minutes (POLL_MAX_MS) — clears on terminal state OR elapsed cap (T-06-10)"
  - "W1 fix applied per autonomous directive: dashboard listings page SELECT extended with video_status/video_url so persisted state survives page refresh"
  - "Optimistic video_status='processing' on handleGenerateVideo trigger — reverted on non-202/409 error"
  - "409 Conflict: adopt in-flight job silently (start polling), no error banner — per plan spec"
  - "useEffect with empty dep array resumes polling on mount for any listings with processing status in initial server state"
  - "Public detail page: aspect-video container + bg-gray-900 preserves the 16:9 frame; no runtime='edge' added (force-dynamic stays, per autonomous directive)"
metrics:
  duration: "5 minutes"
  completed: "2026-06-14"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 06 Plan 04: Video UI — Generate Button + Polling + Public Video Render

**One-liner:** Dashboard "Generate Video" button triggers async job, polls /video-status every 4s with 5-min cap and live badge updates; public detail page renders native `<video controls>` replacing the placeholder; W1 fix ensures persisted video state shows on page load.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Generate Video button + status polling in ListingsManager (+ W1 fix) | `88e3001` | ListingsManager.tsx, dashboard/listings/page.tsx, video-ui.test.ts |
| 2 | Render native video on the public listing detail page | `e623ac0` | listings/[slug]/page.tsx |

## What Was Built

### ListingsManager.tsx — Generate Video button + polling (VIDEO-01/02/03)

Extended `OwnListing` interface with optional `video_status` and `video_url` fields (backward-compatible).

Per-listing `videoStates` map tracks client-side status during polling sessions, initialised from server-loaded `video_status`/`video_url` so persisted state is visible on page load without an additional fetch.

**Trigger flow (VIDEO-01):**
- `handleGenerateVideo`: optimistic `status='processing'` immediately, then POST `/api/agent/listings/${id}/video`
- 202 Accepted -> `startPolling(listingId)` (non-blocking, returns immediately)
- 409 Conflict -> adopt the in-flight job silently, `startPolling(listingId)` (no error banner)
- Other errors -> revert optimistic state, show `actionError` banner

**Polling loop (VIDEO-02):**
- `startPolling`: `setInterval` every 4 000 ms
- Each tick: GET `/api/agent/listings/${id}/video-status`
- Terminal `ready` -> update `videoUrl`, `clearPoll` (stop)
- Terminal `failed` -> update status, `clearPoll` (stop)
- Transient network error -> keep polling
- Hard cap: `POLL_MAX_MS = 5 * 60 * 1000` (5 minutes) — enforced in each tick (T-06-10)
- `useEffect` cleanup clears all active intervals on unmount
- `useEffect` on mount resumes polling for any listings already in `processing` state

**Status badges (VIDEO-03):**
- `processing` -> "Generating..." (blue)
- `failed` -> "Generation failed — retrying" (red — exact phrasing per success criterion)
- `ready` + `videoUrl` -> "View video" link to `/listings/${slug}` (green)
- `ready` + no URL -> "Ready" (green)
- No video -> "—"
- Accessible: `role="status"` + `aria-live="polite"` on the status cell

**W1 fix (dashboard/listings/page.tsx):**
Updated D1 SELECT to include `video_status, video_url` columns alongside existing fields. The `OwnListing` type already accepts them as optional — no interface change required. This ensures persisted video status/URL from D1 populates `initialListings` so the button state and status badge reflect server reality on every page load, not just during an active polling session.

### listings/[slug]/page.tsx — Native video render (VIDEO-02)

Replaced the "Video tour coming soon" placeholder with a real native video element:

- `controls`: native browser playback controls
- `preload="metadata"`: loads duration/dimensions without streaming full video
- `src={listing.videoUrl}`: bound to the D1-stored video URL
- `aria-label={video tour of ${listing.address}}`: references the listing address for screen readers
- Fallback text child: readable by browsers without video support
- Container: `aspect-video bg-gray-900` preserves 16:9 frame with neutral background
- Page remains `force-dynamic`; no `runtime='edge'` added (per autonomous directive)
- JSON-LD `video` field already present — untouched

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| video-ui.test.ts | 29 | 29 | 0 |
| Full suite (npm test) | 1254 | 1254 | 0 |

Baseline before this plan: 1225 pass / 0 fail. Delta: +29 tests.

## Security Controls

| Threat ID | Control | Location |
|-----------|---------|----------|
| T-06-09 | Button calls server route; all authz enforced server-side in 06-02 | ListingsManager.tsx |
| T-06-02 | video_url from D1 only (isSafeHttpUrl-validated at write in 06-01/jobs.ts) | listings/[slug]/page.tsx |
| T-06-10 | Poll interval 4s with POLL_MAX_MS=5min hard cap + clearInterval on unmount | ListingsManager.tsx |

## Deviations from Plan

### Auto-applied (W1 directive)

**1. [W1 Directive - Plan-Checker Fix] Dashboard listings page SELECT extended with video_status/video_url**
- **Found during:** Task 1
- **Issue:** Autonomous directive specified: "ALSO update src/app/(dashboard)/dashboard/listings/page.tsx — include video_url and video_status in its listings SELECT and pass them into the OwnListing objects, so the ListingsManager shows PERSISTED video status/button-state on page load"
- **Fix:** Extended D1 SELECT to include `video_status, video_url`; `OwnListing` interface already accepts them as optional so no type changes needed; `videoStates` initialiser in ListingsManager reads them from `initialListings` on mount
- **Files modified:** `src/app/(dashboard)/dashboard/listings/page.tsx`
- **Commit:** `88e3001`

No other deviations — plan executed as written.

## Deferred Human Validation

| Item | Reason | How to Apply |
|------|--------|-------------|
| Visual verify Generate Video button in dashboard | No live D1/Auth in autonomous run | `wrangler dev`; sign in as test agent; visit /dashboard/listings; click Generate Video |
| Live polling swap-in (processing to ready) | Requires live Kie.ai + D1 | Trigger job, observe badge changes every 4s until "View video" appears |
| "Generation failed — retrying" visible in browser | Requires a live failed job | Simulate failure (bad photo URL) or wait for a Kie.ai failure; confirm red badge text |
| Public video playback in buyer browser | Requires a completed video_url in D1 | Visit /listings/[slug] for a listing with video_url; confirm video plays |
| 5-minute poll cap in practice | Requires a long-running job | Let a job run beyond 5 min without terminal state; confirm polling stops |

## Known Stubs

None. The video trigger, polling, and public render are all production wiring — no placeholders or hardcoded values remain.

## Threat Flags

None. All T-06-09, T-06-02, T-06-10 mitigations from the STRIDE register for this plan are implemented.

## Self-Check: PASSED

- `src/components/dashboard/ListingsManager.tsx` modified: FOUND
- `src/app/(dashboard)/dashboard/listings/page.tsx` modified (W1 fix): FOUND
- `src/app/listings/[slug]/page.tsx` modified: FOUND
- `src/tests/video-ui.test.ts` created: FOUND
- Commit `88e3001` (Task 1 + W1 + tests): FOUND in git log
- Commit `e623ac0` (Task 2 public video): FOUND in git log
- `npx tsc --noEmit`: clean (0 errors)
- `node --test src/tests/video-ui.test.ts`: 29 pass / 0 fail
- `npm test`: 1254 pass / 0 fail
