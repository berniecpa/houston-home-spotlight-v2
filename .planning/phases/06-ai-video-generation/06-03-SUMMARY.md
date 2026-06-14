---
phase: 06-ai-video-generation
plan: 03
subsystem: video
tags: [video, ai, poller, cron, cloudflare-workers, opennext, d1, higgsfield, kie]
dependency_graph:
  requires:
    - src/lib/video/jobs.ts (applyTerminalResult, setTaskId, recordAttempt)
    - src/lib/video/provider.ts (getProviderByName)
    - src/lib/video/higgsfield-adapter.ts (createHiggsAdapter)
    - cloudflare-env.d.ts (CloudflareEnv)
  provides:
    - src/lib/video/poller.ts (pollVideoJobs full implementation)
    - custom-worker.ts (OpenNext scheduled handler extension)
    - wrangler.toml updated (main + [triggers] crons)
    - src/tests/video-poller.test.ts
  affects:
    - src/tests/cloudflare-deployment.test.ts (main assertion updated)
    - wrangler.toml (main pointer changed, [triggers] added)
tech_stack:
  added: []
  patterns:
    - OpenNext custom-worker.ts extension (re-export fetch + add scheduled handler)
    - Cloudflare Cron Trigger via [triggers] crons in wrangler.toml
    - Stale-job guard: updated_at < unixepoch()-300 to avoid racing callback path
    - Per-job try/catch fault isolation in cron scan loop
    - kie→higgsfield failover via attempts < KIE_ATTEMPT_CAP (2) in poller
    - ctx.waitUntil() for non-blocking scheduled handler completion
key_files:
  created:
    - src/lib/video/poller.ts (full implementation replacing 06-01 scaffold)
    - custom-worker.ts
    - src/tests/video-poller.test.ts
  modified:
    - wrangler.toml (main + [triggers])
    - src/tests/cloudflare-deployment.test.ts (updated main assertion)
decisions:
  - "KIE_ATTEMPT_CAP=2 in poller mirrors VIDEO-03 cap; failover only when provider='kie' AND attempts < 2"
  - "Poller reads listings.image_urls to recover hero photo for HiggsField resubmission on failover"
  - "custom-worker.ts uses @ts-ignore on .open-next/worker.js import (build artifact not in source tree)"
  - "cloudflare-deployment.test.ts main assertion updated from .open-next/worker.js to ./custom-worker.ts (Rule 1 — pre-existing test guarding a value deliberately changed by this plan)"
  - "wrangler.toml [triggers] placed above [vars] for TOML readability"
metrics:
  duration: "6 minutes"
  completed: "2026-06-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 06 Plan 03: Video Poller Fallback Summary

**One-liner:** Implemented pollVideoJobs cron-poller (stale-job D1 scan with 300s guard, provider getStatus, idempotent applyTerminalResult convergence, kie→higgsfield failover within 2-attempt cap) + OpenNext custom-worker.ts scheduled handler + wrangler.toml [triggers] cron wiring at 5-minute cadence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement pollVideoJobs scan + terminal-write loop | `c2ad53a` | src/lib/video/poller.ts, src/tests/video-poller.test.ts |
| 2 | Create custom-worker.ts + wire wrangler.toml triggers | `adc9027` | custom-worker.ts, wrangler.toml, src/tests/cloudflare-deployment.test.ts |

## What Was Built

### pollVideoJobs (src/lib/video/poller.ts)

Full implementation replacing the 06-01 no-op scaffold:

- **Stale scan**: `SELECT id, provider, task_id, listing_id, attempts FROM video_jobs WHERE status='processing' AND task_id IS NOT NULL AND updated_at < unixepoch() - 300` — skips recently-submitted jobs to avoid racing the callback path (Pitfall 6, T-06-11).
- **Per-job processing** (`processStaleJob`): resolves adapter via `getProviderByName`, calls `adapter.getStatus(job.task_id)`:
  - `ready` + videoUrl: `applyTerminalResult(db, task_id, { status:'ready', videoUrl })` — same idempotent path as the callback, no double-write (T-06-03).
  - `failed` + provider='kie' + attempts < KIE_ATTEMPT_CAP (2): `failoverToHiggsfield` (VIDEO-03).
  - `failed` + already on higgsfield or attempts exhausted: `applyTerminalResult(db, task_id, { status:'failed', error })`.
  - `processing`: leave it; next scan re-checks.
- **HiggsField failover** (`failoverToHiggsfield`): reads `listings.image_urls` to recover the hero photo URL, calls `higgsAdapter.submit(imageUrl, '')` (no callbackUrl per RESEARCH A3), then `setTaskId` + `recordAttempt(provider='higgsfield', attempts+1)`, leaves status='processing' for next scan. Falls through to terminal failure if no image_urls or HiggsField submit fails.
- **Per-job fault isolation**: each job wrapped in `try/catch` with `console.error` — one provider error does not abort the whole scan batch.

### custom-worker.ts

OpenNext extension entrypoint at project root:

- `@ts-ignore` import of `.open-next/worker.js` (build artifact — resolved by wrangler at deploy time).
- Re-exports `handler.fetch` so all HTTP requests continue working identically.
- Adds `async scheduled(_controller, env, ctx)` that calls `ctx.waitUntil(pollVideoJobs(env))`.

### wrangler.toml

- `main` changed from `.open-next/worker.js` to `./custom-worker.ts` (Pitfall 5 fix).
- Added `[triggers]` section with `crons = ["*/5 * * * *"]` (5-minute cadence, Pitfall 6).
- All existing sections unchanged.

### Tests (src/tests/video-poller.test.ts)

28 source-grep assertions covering all plan requirements (Task 1 + Task 2 combined).

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| video-poller.test.ts | 28 | 28 | 0 |
| Full suite (npm test) | 1282 | 1282 | 0 |

## Security Controls Implemented

| Threat ID | Control | Location |
|-----------|---------|----------|
| T-06-03 | Poller uses applyTerminalResult guarded path (no-op if already terminal) | poller.ts |
| T-06-02 | applyTerminalResult validates videoUrl via isSafeHttpUrl (from 06-01) | jobs.ts |
| T-06-11 | 5-min cadence + updated_at < unixepoch()-300 limits D1 reads + provider calls | poller.ts, wrangler.toml |
| T-06-12 | Test asserts main="./custom-worker.ts" + [triggers] present (regression guard) | video-poller.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated cloudflare-deployment.test.ts main assertion**
- **Found during:** Task 2
- **Issue:** `src/tests/cloudflare-deployment.test.ts` line 36 asserted `main = ".open-next/worker.js"` — this was guarding a value intentionally changed by this plan to `"./custom-worker.ts"`. The old assertion would have broken the full test suite.
- **Fix:** Updated the assertion and its test description to check for `"./custom-worker.ts"`.
- **Files modified:** `src/tests/cloudflare-deployment.test.ts`
- **Commit:** `adc9027`

## Deferred Human Validation

| Item | Reason | How to Validate |
|------|--------|----------------|
| Apply 0005_video_jobs migration | No live D1 access in autonomous run | `npx wrangler d1 migrations apply DB --local` then `--remote` |
| Deploy with new main + cron | Requires live Cloudflare deploy | `npm run cf:build && npm run cf:deploy` |
| Confirm scheduled handler fires locally | Requires wrangler dev running | `npx wrangler dev` then `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=%2A%2F5+%2A+%2A+%2A+%2A"` |
| Confirm cron advances stale jobs in production | Requires live D1 + provider keys | Check Cloudflare dashboard Cron Trigger logs after first deploy |

## Known Stubs

None. `pollVideoJobs` is fully implemented. The HiggsField failover reads `listings.image_urls` — if no images are present, the job terminates with a descriptive error.

## Threat Flags

None. All STRIDE threats in the plan's threat model are mitigated within this plan.

## Self-Check: PASSED
