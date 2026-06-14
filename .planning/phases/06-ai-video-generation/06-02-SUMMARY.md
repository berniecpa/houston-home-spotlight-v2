---
phase: 06-ai-video-generation
plan: 02
subsystem: video
tags: [video, api-routes, kie-adapter, hmac, d1, edge-runtime, dedup, idempotency]
dependency_graph:
  requires:
    - src/lib/video/jobs.ts (findActiveJob, insertJob, setTaskId, recordAttempt, applyTerminalResult)
    - src/lib/video/provider.ts (submitWithFallback, VideoEnv)
    - src/lib/video/kie-adapter.ts (verifyKieSignature, extractKieCallbackVideoUrl, KieCallbackBody)
    - src/lib/subscription.ts (getAgentSubscriptionState, isAgentPublishable)
    - src/lib/listings-db.ts (isSafeHttpUrl)
    - src/lib/auth-edge.ts (authEdgeConfig)
    - src/app/layout.tsx (siteConfig)
  provides:
    - src/app/api/agent/listings/[id]/video/route.ts (POST trigger: authz + dedup + async submit + 202)
    - src/app/api/agent/listings/[id]/video-status/route.ts (GET status: ownership-scoped poll)
    - src/app/api/video/callback/route.ts (POST callback: HMAC verify + idempotent result write)
  affects:
    - cloudflare-env.d.ts (KIE_API_KEY, KIE_WEBHOOK_SECRET, HIGGSFIELD_API_KEY types added)
    - listings table (video_status updated to 'processing' on trigger)
tech_stack:
  added: []
  patterns:
    - AbortController 5s timeout wrapping provider submit (async, non-blocking)
    - ownership preamble reuse (getTokens + SELECT agent_id — T-06-05, T-06-08)
    - Raw body first (req.text()) + JSON.parse(raw) — mirrors Stripe webhook pattern
    - HMAC verify (verifyKieSignature) before any D1 write (T-06-04)
    - Idempotent terminal write via applyTerminalResult + applied:false 200 no-op (T-06-03)
    - PLAN-CHECKER FIX W2: recordAttempt called in submitWithFallback catch BEFORE 202 return
key_files:
  created:
    - src/app/api/agent/listings/[id]/video/route.ts
    - src/app/api/agent/listings/[id]/video-status/route.ts
    - src/app/api/video/callback/route.ts
    - src/tests/video-trigger-api.test.ts
    - src/tests/video-callback-api.test.ts
  modified:
    - cloudflare-env.d.ts (video secret types appended to __BaseEnv_CloudflareEnv)
decisions:
  - "PLAN-CHECKER FIX W2 implemented: recordAttempt called in submitWithFallback catch block before returning 202 so error is captured immediately (not deferred to poller)"
  - "AbortController 5s timeout wraps submitWithFallback; on throw the job stays 'processing' for cron-poller (06-03) — agent always gets 202"
  - "Callback route uses JSON.parse(raw) not req.json() — mirrors Stripe webhook raw-body-first pattern to preserve HMAC bytes"
  - "cloudflare-env.d.ts extended with KIE_API_KEY/KIE_WEBHOOK_SECRET/HIGGSFIELD_API_KEY (Rule 2 auto-add: missing critical type declarations)"
  - "Callback test assertions strip comment lines before checking for runtime='edge' and req.json() — avoids false positives from DO NOT add comments"
metrics:
  duration: "25 minutes"
  completed: "2026-06-14"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 06 Plan 02: Video API Routes Summary

**One-liner:** Three HTTP routes completing the async video pipeline: POST trigger (ownership+publishable+dedup+<2s 202), HMAC-verified Kie.ai callback (idempotent D1 write, middleware-exempt), and GET status endpoint (ownership-scoped polling).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Generate-Video trigger route + status endpoint | `2630e97` | video/route.ts, video-status/route.ts, video-trigger-api.test.ts |
| 2 | Kie.ai callback route (HMAC verify + idempotent result write) | `764c0fc` | video/callback/route.ts, video-callback-api.test.ts, cloudflare-env.d.ts |

## What Was Built

### POST /api/agent/listings/[id]/video (video/route.ts)

Eight-gate request handler:

1. **Ownership preamble** — `getTokens(cookieStore, authEdgeConfig)` → 401 if no session, 403 if email unverified; SELECT agent_id FROM listings → 404 if absent, 403 if cross-agent (T-06-05)
2. **Suspension gate** — SELECT is_suspended FROM agents → 403 (T-06-07)
3. **Publishability gate** — `getAgentSubscriptionState` + `isAgentPublishable` → 403 if not active/grace/admin (T-06-07)
4. **Photo gate** — SELECT url FROM listing_images ORDER BY display_order LIMIT 1 → 400 "Listing has no photo to animate." if none
5. **SSRF guard** — `isSafeHttpUrl(imageRow.url)` → 400 if non-http(s) (T-06-06)
6. **Dedup** — `findActiveJob(db, listingId)` → 409 { jobId, status } if in-flight job exists (VIDEO-04)
7. **Async submit** — `insertJob` + UPDATE listings SET video_status='processing' + `submitWithFallback` wrapped in AbortController(5s); on success `setTaskId` + `recordAttempt`; on failure `recordAttempt(db, jobId, 'kie', 1, errorMsg)` BEFORE returning 202 (PLAN-CHECKER FIX W2)
8. **Return 202** `{ jobId, status: 'processing' }` — always, regardless of provider outcome

`export const runtime = 'edge'`

### GET /api/agent/listings/[id]/video-status (video-status/route.ts)

Ownership-scoped poll endpoint (T-06-08):
- Full ownership preamble (401/403/404) before any read
- SELECT status, task_id FROM video_jobs WHERE listing_id=? ORDER BY updated_at DESC LIMIT 1
- SELECT video_status, video_url FROM listings WHERE id=?
- Returns `{ status, videoUrl }` — falls back to `listings.video_status ?? 'none'` when no job row exists

`export const runtime = 'edge'`

### POST /api/video/callback (video/callback/route.ts)

Kie.ai server-to-server webhook handler (middleware-exempt, no session cookie):

1. **Raw body first** — `const raw = await req.text()` (first statement — mirrors Stripe webhook)
2. **First-receipt log** — `console.log('[video/callback] raw body:', raw)` (confirms Kling 2.6 shape on first live receipt)
3. **Header gate** — `X-Webhook-Timestamp` + `X-Webhook-Signature` required → 400 if absent
4. **Secret gate** — `env.KIE_WEBHOOK_SECRET` required → 400 if unset (Pitfall 1 / T-06-04)
5. **HMAC verify** — `verifyKieSignature(taskId, timestamp, signature, secret)` → 400 on failure (T-06-04)
6. **Outcome parse** — `body.code === 200` → `extractKieCallbackVideoUrl` (dual-parse: video_url then resultJson.resultUrls[0]) → ready; else → failed (VIDEO-02, Pitfall 8)
7. **Idempotent write** — `applyTerminalResult(db, taskId, outcome)` → applied:false → 200 no-op (T-06-03, VIDEO-04)
8. **Return 200** `{ received: true }` — Kie.ai stops retrying

No `export const runtime = 'edge'` (opennextjs/cloudflare restriction — matches Stripe webhook).

Middleware exemption documented in file comment: matcher `['/dashboard/:path*', '/admin/:path*']` confirmed unchanged. middleware.ts NOT modified.

### CloudflareEnv Type Extension (cloudflare-env.d.ts)

Added `KIE_API_KEY: string`, `KIE_WEBHOOK_SECRET: string`, `HIGGSFIELD_API_KEY: string` to `__BaseEnv_CloudflareEnv` — required for TypeScript to accept `env.KIE_WEBHOOK_SECRET` in the callback route (Rule 2 auto-add, TS2551 fix).

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| video-trigger-api.test.ts | 30 | 30 | 0 |
| video-callback-api.test.ts | 18 | 18 | 0 |
| Full suite (npm test) | 1225 | 1225 | 0 |

Baseline before this plan: 1177 pass / 0 fail. Delta: +48 tests.

## Security Controls Implemented

| Threat ID | Control | Location |
|-----------|---------|----------|
| T-06-04 | verifyKieSignature HMAC-SHA256; 400 on missing headers or unset KIE_WEBHOOK_SECRET | callback/route.ts |
| T-06-03 | applyTerminalResult guarded WHERE status='processing'; applied:false → 200 no-op | callback/route.ts via jobs.ts |
| T-06-05 | SELECT agent_id, 403 when agent_id !== session uid | video/route.ts resolveOwnership |
| T-06-07 | checkSuspended + isAgentPublishable gates | video/route.ts |
| T-06-06 | isSafeHttpUrl on listing photo URL before provider call | video/route.ts |
| T-06-08 | Ownership preamble (401/403/404) before any status read | video-status/route.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] cloudflare-env.d.ts missing video secret types**
- **Found during:** Task 2
- **Issue:** `CloudflareEnv` type did not include `KIE_API_KEY`, `KIE_WEBHOOK_SECRET`, or `HIGGSFIELD_API_KEY`; `npx tsc --noEmit` reported TS2551 on `env.KIE_WEBHOOK_SECRET`
- **Fix:** Appended three typed fields to `__BaseEnv_CloudflareEnv` in `cloudflare-env.d.ts` (file is hand-maintained — Phase 3 Stripe secrets were added identically)
- **Files modified:** `cloudflare-env.d.ts`
- **Commit:** `764c0fc`

**2. [Rule 1 - Bug] Callback test assertions false-positived on comment text**
- **Found during:** Task 2 — two assertions failed because "DO NOT add: export const runtime = 'edge'" (comment) and "Any prior req.json() call" (comment) matched the source-grep checks
- **Fix:** Updated assertions to strip comment lines before checking for code-only patterns; also tightened the raw-body-first assertion to check for `JSON.parse(raw)` rather than absence of `req.json()`
- **Files modified:** `src/tests/video-callback-api.test.ts`
- **Commit:** `764c0fc`

## Deferred Human Validation

| Item | Reason | How to Apply |
|------|--------|-------------|
| Live Kie.ai trigger → callback round-trip | KIE_API_KEY and KIE_WEBHOOK_SECRET not configured; no live D1 | Set secrets in .dev.vars; run `wrangler dev`; POST to /api/agent/listings/{id}/video |
| <2s submit timing verification | AbortController timeout is 5s; live network latency untested | Observe Worker logs on first live trigger; confirm 202 returns before provider response |
| Kling 2.6 callback shape (Pitfall 8) | Dual-parse handles both shapes; raw body logged for confirmation | Observe `[video/callback] raw body:` in Worker logs after first live completion |
| Cross-agent 403 against live D1 | No live D1 environment in autonomous run | Create two test agent sessions; attempt cross-agent POST; confirm 403 |
| KIE_WEBHOOK_SECRET unset → 400 live verification | Can only be confirmed against live Cloudflare env | Temporarily unset KIE_WEBHOOK_SECRET in .dev.vars; POST synthetic callback; confirm 400 |

## Known Stubs

`console.log('[video/callback] raw body:', raw)` in `src/app/api/video/callback/route.ts` is intentional per plan instructions (first-receipt resilience, Open Question 1 / Pitfall 8). Remove or gate behind a flag after the first live callback confirms the Kling 2.6 payload shape.

## Threat Flags

None. All T-06-03 through T-06-08 mitigations from the STRIDE register for this plan are implemented.

## Self-Check: PASSED

- All 5 created files confirmed present on disk.
- `cloudflare-env.d.ts` modified with video secret types confirmed.
- Commits `2630e97` and `764c0fc` confirmed in git log.
- `npx tsc --noEmit` clean (0 errors).
- `npm test`: 1225 pass / 0 fail.
