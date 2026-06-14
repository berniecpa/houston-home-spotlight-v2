---
phase: 06-ai-video-generation
plan: 01
subsystem: video
tags: [video, ai, kie-adapter, higgsfield-adapter, d1, migration, hmac, workers]
dependency_graph:
  requires: []
  provides:
    - db/migrations/0005_video_jobs.sql
    - src/lib/video/types.ts (VideoProvider interface)
    - src/lib/video/kie-adapter.ts (kieSubmit, kieGetStatus, verifyKieSignature, extractKieCallbackVideoUrl)
    - src/lib/video/higgsfield-adapter.ts (higgsSubmit, higgsGetStatus)
    - src/lib/video/provider.ts (submitWithFallback, getProviderByName)
    - src/lib/video/jobs.ts (findActiveJob, insertJob, setTaskId, recordAttempt, applyTerminalResult)
    - src/lib/video/poller.ts (pollVideoJobs scaffold)
  affects:
    - .env.local.example (video secrets appended)
    - listings table (video_url + video_status written by applyTerminalResult)
tech_stack:
  added: []
  patterns:
    - Workers-safe fetch() for provider API calls (no SDK, no node:crypto)
    - crypto.subtle HMAC-SHA256 with constant-time XOR comparison (verifyKieSignature)
    - D1 prepare().bind() parameterized writes (jobs.ts)
    - Idempotent UPDATE guarded by AND status = 'processing' + meta.changes check
    - isSafeHttpUrl SSRF guard before listings write
key_files:
  created:
    - db/migrations/0005_video_jobs.sql
    - src/lib/video/types.ts
    - src/lib/video/kie-adapter.ts
    - src/lib/video/higgsfield-adapter.ts
    - src/lib/video/provider.ts
    - src/lib/video/jobs.ts
    - src/lib/video/poller.ts
    - src/tests/video-migration.test.ts
    - src/tests/video-provider.test.ts
  modified:
    - .env.local.example (appended KIE_API_KEY, KIE_WEBHOOK_SECRET, HIGGSFIELD_API_KEY)
decisions:
  - "Migration is 0005 (confirmed 0001-0004 exist; RESEARCH's '0003' filename superseded)"
  - "verifyKieSignature uses XOR-accumulate constant-time loop over Uint8Array bytes per autonomous directive"
  - "HiggsField adapter accepts _callbackUrl for interface compat but does not forward it (poller-only completion per RESEARCH A3)"
  - "submitWithFallback has KIE_MAX_ATTEMPTS = 2 exactly as required by VIDEO-03"
  - "poller.ts is a no-op scaffold; scan loop wired in 06-03"
  - "SSRF guard applied before listings write by downcasting outcome to failed when isSafeHttpUrl returns false"
metrics:
  duration: "22 minutes"
  completed: "2026-06-14"
  tasks_completed: 2
  files_created: 9
  files_modified: 1
---

# Phase 06 Plan 01: Video Foundation Summary

**One-liner:** D1 video_jobs migration (0005) + VideoProvider interface with Kie.ai adapter (HMAC-SHA256 constant-time verify, dual-parse callback) and HiggsField fallback adapter (Key auth), plus idempotent SSRF-guarded D1 job helpers and 2-attempt failover orchestrator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create video_jobs migration + job-state D1 helpers | `e0fd713` | 0005_video_jobs.sql, jobs.ts, video-migration.test.ts |
| 2 | Provider interface + adapters + failover orchestrator | `2f2154d` | types.ts, kie-adapter.ts, higgsfield-adapter.ts, provider.ts, poller.ts, .env.local.example, video-provider.test.ts |

## What Was Built

### Migration (0005_video_jobs.sql)

`video_jobs` table: `id TEXT PRIMARY KEY`, `listing_id TEXT NOT NULL REFERENCES listings(id)`, `agent_id TEXT NOT NULL REFERENCES agents(id)`, `provider TEXT NOT NULL`, `task_id TEXT UNIQUE`, `status TEXT NOT NULL DEFAULT 'processing'`, `attempts INTEGER NOT NULL DEFAULT 1`, `error TEXT`, `created_at/updated_at INTEGER NOT NULL DEFAULT (unixepoch())`. Three indexes: `idx_video_jobs_listing_id`, `idx_video_jobs_task_id`, `idx_video_jobs_status`.

### D1 Job Helpers (src/lib/video/jobs.ts)

- `findActiveJob(db, listingId)` — dedup SELECT WHERE status IN ('queued','processing') LIMIT 1
- `insertJob(db, { id, listingId, agentId, provider })` — INSERT status='processing', attempts=1
- `setTaskId(db, jobId, taskId)` — UPDATE after provider submission
- `recordAttempt(db, jobId, provider, attempts, error?)` — VIDEO-03 attempt tracking
- `applyTerminalResult(db, taskId, outcome)` — idempotent UPDATE guarded by AND status='processing', meta.changes check, isSafeHttpUrl SSRF guard, listings.video_url/video_status write

### Provider Abstraction

- `src/lib/video/types.ts` — `VideoProvider` interface (submit/getStatus), `VideoJobStatus` type, `VideoJobRow` D1 row type
- `src/lib/video/kie-adapter.ts` — `kieSubmit` (Kling 2.6, Bearer auth, callBackUrl), `kieGetStatus` (recordInfo endpoint, state→status mapping), `verifyKieSignature` (HMAC-SHA256 via crypto.subtle, constant-time XOR comparison over Uint8Array, no node:crypto), `extractKieCallbackVideoUrl` (dual-parse: video_url then resultJson.resultUrls[0])
- `src/lib/video/higgsfield-adapter.ts` — `higgsSubmit` (`Authorization: Key KEY_ID:KEY_SECRET`, NOT Bearer), `higgsGetStatus` (/requests/{id}/status, queued|in_progress→processing, completed→ready, nsfw|failed→failed)
- `src/lib/video/provider.ts` — `submitWithFallback` (KIE_MAX_ATTEMPTS=2 then HiggsField, VIDEO-03), `getProviderByName` resolver
- `src/lib/video/poller.ts` — `pollVideoJobs` scaffold (no-op; scan loop in 06-03)

### Secrets Documented (.env.local.example)

`KIE_API_KEY`, `KIE_WEBHOOK_SECRET`, `HIGGSFIELD_API_KEY` with wrangler secret put instructions and source dashboard links.

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| video-migration.test.ts | 18 | 18 | 0 |
| video-provider.test.ts | 26 | 26 | 0 |
| Full suite (npm test) | 1177 | 1177 | 0 |

Baseline before this plan: 1133 pass / 0 fail. Delta: +44 tests.

## Security Controls Implemented

| Threat ID | Control | Location |
|-----------|---------|----------|
| T-06-01 | API keys injected from env at call time; never module-level | kie-adapter.ts, higgsfield-adapter.ts, provider.ts |
| T-06-02 | isSafeHttpUrl validates provider video URL before D1 write | jobs.ts applyTerminalResult |
| T-06-03 | UPDATE WHERE task_id=? AND status='processing' + meta.changes===0 guard | jobs.ts applyTerminalResult |
| T-06-04 | verifyKieSignature: crypto.subtle HMAC-SHA256, XOR constant-time comparison | kie-adapter.ts |

## Deviations from Plan

None — plan executed exactly as written.

Minor implementation choices within plan discretion:
- `applyTerminalResult` uses a local `effectiveOutcome` variable (not mutating `outcome`) to satisfy TypeScript strict mode type narrowing.
- `poller.ts` void-casts stub variables to keep imports live without triggering unused-variable errors in strict mode.

## Deferred Human Validation

| Item | Reason | How to Apply |
|------|--------|-------------|
| Apply 0005_video_jobs.sql migration | Autonomous run — no live D1 access | `npx wrangler d1 migrations apply DB --local` (dev) then `--remote` (prod) |
| Live Kie.ai round-trip (kieSubmit, kieGetStatus) | KIE_API_KEY not configured | Set KIE_API_KEY in .dev.vars; run `wrangler dev`; call trigger route |
| Live HiggsField round-trip | HIGGSFIELD_API_KEY not configured | Set HIGGSFIELD_API_KEY as KEY_ID:KEY_SECRET in .dev.vars; test fallback path |
| Kie.ai callback payload field names (Pitfall 8) | Kling 2.6 shape unconfirmed (video_url vs resultJson.resultUrls) | Log raw callback body on first live job; dual-parse handles both shapes |

## Known Stubs

- `pollVideoJobs` in `src/lib/video/poller.ts` is intentionally a no-op scaffold. The scan loop querying `video_jobs WHERE status='processing' AND updated_at < unixepoch()-300` and provider status polling is implemented in plan 06-03. This follows the plan instruction to avoid a same-wave file conflict.

## Threat Flags

None. All T-06-01 through T-06-04 mitigations from the STRIDE register are implemented within this plan.

## Self-Check: PASSED

- All 9 created files confirmed present on disk.
- Commits `e0fd713` and `2f2154d` confirmed in git log.
- `npx tsc --noEmit` clean (0 errors).
- `npm test`: 1177 pass / 0 fail.
