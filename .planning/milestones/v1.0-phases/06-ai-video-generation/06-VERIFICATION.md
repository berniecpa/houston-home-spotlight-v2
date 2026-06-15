---
phase: 06-ai-video-generation
verified: 2026-06-14T00:00:00Z
status: human_needed
score: 12/12 must-haves verified (the one partial was fixed post-verification — see below)
overrides_applied: 0
gaps:
  - truth: "When Kie.ai returns a failure status, the platform falls back to HiggsField via the cron poller (VIDEO-03 poller path)"
    status: resolved
    reason: "RESOLVED post-verification (commit 3690d95): failoverToHiggsfield() now queries `SELECT url FROM listing_images WHERE listing_id = ? ORDER BY display_order ASC LIMIT 1` — the same hero-photo query the trigger route uses — instead of the nonexistent listings.image_urls column. typecheck clean; 1282/0 tests. (Original finding: the column always resolved null, so every poller HiggsField failover short-circuited as a terminal failure; the trigger-path submitWithFallback was already correct.)"
    artifacts:
      - path: "src/lib/video/poller.ts"
        issue: "Line 198: `SELECT image_urls FROM listings WHERE id = ?` — column image_urls does not exist on the listings table. The trigger route correctly queries `SELECT url FROM listing_images WHERE listing_id = ? ORDER BY display_order ASC LIMIT 1`."
    missing:
      - "Replace `SELECT image_urls FROM listings WHERE id = ?` with `SELECT url FROM listing_images WHERE listing_id = ? ORDER BY display_order ASC LIMIT 1` in failoverToHiggsfield()"
      - "Update video-poller.test.ts to assert the listing_images join query (regression guard)"
human_verification:
  - test: "Confirm Kie.ai callback video URL field shape on first live job"
    expected: "Either body.data.video_url or body.data.resultJson.resultUrls[0] is populated; set VIDEO_CALLBACK_DEBUG=true and inspect the raw body log"
    why_human: "Dual-parse is implemented for both payload shapes but the actual field Kling 2.6 sends is undocumented at verification time (RESEARCH Pitfall 8 / Open Question 1)"
  - test: "Verify CR-01 authoritative getStatus outcome against real Kie.ai ready/failed responses"
    expected: "After HMAC + timestamp verify, createKieAdapter.getStatus(taskId) returns status='ready' with a valid videoUrl matching the provider's actual job result; the ready-with-url / processing-without-url / failed branch logic routes correctly"
    why_human: "CR-01 fix is code-correct but the getStatus response shape for Kling 2.6 and the fallback path (getStatus network failure) need live confirmation"
  - test: "Confirm CR-02 atomic failover handles concurrent late Kie.ai callback correctly"
    expected: "When a late Kie.ai callback arrives while failoverProviderAtomic is in flight, the job does not get resurrected or wedged; the callback applyTerminalResult for the old task_id is a clean no-op"
    why_human: "Requires live concurrency testing with deliberate race injection; code atomicity is correct but timing window needs end-to-end confirmation"
  - test: "Apply 0005_video_jobs migration to local and remote D1"
    expected: "`wrangler d1 migrations apply DB --local` succeeds; video_jobs table has all columns, UNIQUE task_id, and three indexes; no conflict with existing migrations"
    why_human: "Migration application is explicitly deferred in all four plan files"
  - test: "Trigger Generate Video from agent dashboard and confirm <2s 202 response"
    expected: "POST /api/agent/listings/[id]/video returns 202 in under 2 seconds; dashboard shows Generating... immediately without a blocking spinner"
    why_human: "<2s is a live performance requirement; AbortController sets a 5s max but provider network latency under wrangler dev is the variable"
  - test: "Fire cron handler locally and confirm it scans stale jobs (requires image_urls gap fixed first)"
    expected: "`curl http://localhost:8787/cdn-cgi/handler/scheduled?cron=%2A%2F5+%2A+%2A+%2A+%2A` returns 200 and Worker log shows pollVideoJobs scanned and advanced a stale processing job"
    why_human: "Requires running wrangler dev with 0005 migration applied and at least one stale processing job"
  - test: "Dashboard live polling swap-in — Generating to View video without page reload"
    expected: "Video column progresses from Generating... to View video (or Generation failed — retrying) without a page reload; polling stops on terminal state; interval is cleared on unmount"
    why_human: "Client-side DOM updates, polling behavior, and interval cleanup require a live browser session"
  - test: "Public listing detail page video playback"
    expected: "Navigating to /listings/[slug] for a listing with a ready video_url shows a native HTML5 video player that plays the generated video; no 'Video tour coming soon' placeholder"
    why_human: "Requires a completed Kie.ai job with a real CDN video URL written to D1"
  - test: "IN-04 — HiggsField status endpoint URL version prefix confirmation"
    expected: "GET https://platform.higgsfield.ai/requests/{request_id}/status returns 200 with valid status body (not 404 from a missing /v1 prefix)"
    why_human: "higgsGetStatus uses /requests/{id}/status (no /v1) while higgsSubmit posts to /v1/image2video/dop; correct path must be verified against the live HiggsField API"
---

# Phase 6: AI Video Generation — Verification Report

**Phase Goal:** Agents can trigger AI video generation for a listing; the platform submits an async job to Kie.ai, polls for completion, and surfaces the video on the listing detail page — with retry and fallback on failure
**Verified:** 2026-06-14
**Status:** human_needed (1 code-level partial gap + 9 human verification items)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Provider abstraction exposes submit/getStatus for Kie.ai and HiggsField (VIDEO-05) | VERIFIED | types.ts exports VideoProvider interface; createKieAdapter and createHiggsAdapter both implement it correctly |
| 2 | Agent gets <2s 202 response on trigger; no spinner longer than 2s (VIDEO-01) | VERIFIED (live timing deferred) | POST route returns 202 with AbortController 5s; submit failure leaves job processing and returns 202 anyway |
| 3 | Cross-agent 403; suspended/unpublishable 403; no-photo 400 (VIDEO-01 gates) | VERIFIED | Full gate chain wired: resolveOwnership / checkSuspended / isAgentPublishable / photo gate / SSRF isSafeHttpUrl |
| 4 | Duplicate trigger returns 409 in-flight job (VIDEO-04) | VERIFIED | findActiveJob → 409 in video/route.ts:225-231; ListingsManager adopts in-flight on 409 and starts polling |
| 5 | Kie.ai callback verifies HMAC + 300s timestamp window; re-derives outcome from authenticated getStatus; idempotent write (VIDEO-02) | VERIFIED | CR-03: WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS=300 applied before sig check; CR-01: createKieAdapter.getStatus re-fetch; applyTerminalResult guarded AND status='processing' |
| 6 | submitWithFallback falls over to HiggsField after Kie.ai cap of 2 (VIDEO-03 trigger path) | VERIFIED | provider.ts caps Kie.ai at KIE_MAX_ATTEMPTS=2 then calls HiggsField; SubmitResult.attempts tracked and persisted correctly (WR-02 fix) |
| 7 | Cron poller falls over to HiggsField for stale Kie.ai failures (VIDEO-03 poller path) | VERIFIED (fixed post-verification, commit 3690d95) | Stale-scan query correct; applyTerminalResult wiring correct; failoverToHiggsfield now reads listing_images (hero photo) like the trigger route — submits a real HiggsField job instead of short-circuiting |
| 8 | No duplicate concurrent jobs; idempotent terminal writes (VIDEO-04) | VERIFIED | findActiveJob dedup; applyTerminalResult AND status='processing' guard; failoverProviderAtomic single atomic UPDATE (CR-02); UNIQUE task_id in DDL |
| 9 | listing.video_url written to D1 and displayed on detail page (VIDEO-02) | VERIFIED | applyTerminalResult writes listings.video_url + video_status='ready'; data.ts rowToListing applies isSafeHttpUrl read-path guard (WR-01); detail page renders native video element; placeholder removed |
| 10 | Agent sees "Generation failed — retrying" not a silent error (VIDEO-03) | VERIFIED | ListingsManager.tsx:567 renders exact text on vs?.status === 'failed'; role="status" aria-live="polite" |
| 11 | Dashboard polls every ~4s and stops on terminal state (VIDEO-02) | VERIFIED | POLL_INTERVAL_MS=4000; POLL_MAX_MS=5min cap; clearInterval on ready/failed; clearInterval on unmount via useEffect cleanup |
| 12 | All CR/WR security fixes from code review applied (CR-01 through WR-07) | VERIFIED | All 10 critical/warning fixes confirmed in source code |

**Score:** 11/12 truths verified (truth #7 partial — poller HiggsField failover uses wrong image column)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/migrations/0005_video_jobs.sql` | video_jobs DDL with UNIQUE task_id + 3 indexes | VERIFIED | All columns present; UNIQUE task_id; idx_video_jobs_listing_id/task_id/status |
| `src/lib/video/types.ts` | VideoProvider interface + VideoJobStatus + VideoJobRow | VERIFIED | All types match DDL; getStatus return includes error field (WR-06) |
| `src/lib/video/kie-adapter.ts` | kieSubmit + kieGetStatus + verifyKieSignature + extractKieCallbackVideoUrl + createKieAdapter | VERIFIED | Correct endpoints; constant-time XOR HMAC; dual-parse; error surfacing (WR-06) |
| `src/lib/video/higgsfield-adapter.ts` | higgsSubmit + higgsGetStatus + createHiggsAdapter | VERIFIED | `Authorization: Key` (not Bearer); request_id; error surfacing (IN-02) |
| `src/lib/video/provider.ts` | submitWithFallback + getProviderByName | VERIFIED | Kie cap 2 then HiggsField; SubmitResult.attempts tracked (WR-02); getProviderByName for poller |
| `src/lib/video/jobs.ts` | findActiveJob, insertJob, setTaskId, recordAttempt, applyTerminalResult, failoverProviderAtomic, failJobById | VERIFIED | All helpers present; idempotent guards; isSafeHttpUrl before listings write; CR-02 atomic failover |
| `src/lib/video/poller.ts` | pollVideoJobs scan + per-provider status + terminal write | PARTIAL | Scan query correct; applyTerminalResult wiring correct; failoverToHiggsfield queries nonexistent column |
| `src/app/api/agent/listings/[id]/video/route.ts` | POST trigger with full gate chain + 202 | VERIFIED | All gates wired; AbortController 5s; WR-02 attempt count; records error in catch before 202 |
| `src/app/api/agent/listings/[id]/video-status/route.ts` | GET owner-scoped status endpoint | VERIFIED | Ownership preamble; WR-04 videoUrl only on ready |
| `src/app/api/video/callback/route.ts` | POST Kie.ai callback with HMAC + getStatus re-derive + idempotent write | VERIFIED | CR-01/CR-02/CR-03 all applied; raw body first; secret guard; middleware-exempt |
| `src/components/dashboard/ListingsManager.tsx` | Generate Video button + status badge + polling loop | VERIFIED | aria-label button; 4s poll interval; clearInterval on terminal/unmount; exact failure text; aria-live |
| `src/app/listings/[slug]/page.tsx` | Native video element when listing.videoUrl present | VERIFIED | `<video controls preload="metadata" src={listing.videoUrl}>` with aria-label; placeholder removed |
| `custom-worker.ts` | OpenNext custom worker + scheduled() handler | VERIFIED | Re-exports handler.fetch; ctx.waitUntil(pollVideoJobs(env)) |
| `wrangler.toml` | main=custom-worker.ts + [triggers] crons | VERIFIED | main = "./custom-worker.ts"; [triggers] crons = ["*/5 * * * *"]; DB binding intact |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| provider.ts | kie-adapter + higgsfield-adapter | retry-then-failover | VERIFIED | Both adapters imported and called; SubmitResult returned |
| jobs.ts | video_jobs + listings | prepare().bind() parameterized writes | VERIFIED | No string concat; idempotent guards; isSafeHttpUrl before write |
| video/route.ts | provider.ts + jobs.ts | submitWithFallback + insertJob/findActiveJob | VERIFIED | All calls ordered correctly |
| callback/route.ts | kie-adapter + jobs.ts | verifyKieSignature + createKieAdapter.getStatus + applyTerminalResult | VERIFIED | CR-01 getStatus call wired between HMAC verify and terminal write |
| custom-worker.ts | poller.ts | scheduled() calls pollVideoJobs(env) | VERIFIED | ctx.waitUntil(pollVideoJobs(env)) wired |
| poller.ts | provider.ts + jobs.ts | getProviderByName + getStatus + applyTerminalResult | PARTIAL | Ready-path wired; failoverToHiggsfield broken by wrong image column |
| ListingsManager.tsx | /api/agent/listings/[id]/video + /video-status | fetch POST + setInterval poll | VERIFIED | POST to /video; GET poll at 4s; clearInterval on terminal/unmount |
| detail page | listing.videoUrl | conditional native video element | VERIFIED | `{listing.videoUrl && (<video controls>)}` present; placeholder absent |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| ListingsManager.tsx | videoStates | GET /api/agent/listings/[id]/video-status → D1 video_jobs + listings | D1 queries wired; terminal writes update both tables | FLOWING (code-level; live polling deferred to human) |
| listing [slug]/page.tsx | listing.videoUrl | data.ts rowToListing ← D1 listings.video_url | applyTerminalResult writes with isSafeHttpUrl guard; data.ts re-validates on read (WR-01) | FLOWING (code-level; real job deferred to human) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite — 1282 pass / 0 fail | npm test | 1282 pass / 0 fail / 0 skip | PASS |
| TypeScript strict mode clean | npx tsc --noEmit | 0 errors | PASS |
| video_jobs DDL has UNIQUE task_id + 3 indexes | File grep | UNIQUE + idx_video_jobs_listing_id/task_id/status | PASS |
| Poller 300s stale guard in SQL | Source grep poller.ts | `updated_at < unixepoch() - 300` | PASS |
| CR-01: callback re-derives from getStatus | Source grep callback/route.ts | `createKieAdapter(env.KIE_API_KEY).getStatus(taskId)` present | PASS |
| CR-03: 300s timestamp replay window | Source grep callback/route.ts | WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS=300; Math.abs check | PASS |
| CR-02: failoverProviderAtomic atomic UPDATE | Source grep jobs.ts + poller.ts | Single guarded UPDATE in jobs.ts:197-208; used in poller:241 | PASS |
| WR-01: isSafeHttpUrl on read path in data.ts | Source grep data.ts | line 83: `row.video_url && isSafeHttpUrl(row.video_url) ? row.video_url : undefined` | PASS |
| WR-04: videoUrl only on ready in status endpoint | Source grep video-status/route.ts | `status === 'ready' ? persistedUrl : null` in both branches | PASS |
| WR-05: debug log guarded by env flag | Source grep callback/route.ts | `if ((env as { VIDEO_CALLBACK_DEBUG?: string }).VIDEO_CALLBACK_DEBUG)` | PASS |
| Poller image column vs schema (VIDEO-03 defect) | Source grep + 0001 schema | poller.ts:198 `image_urls`; listings DDL has no such column — photos in listing_images | FAIL |
| "Generation failed — retrying" exact text | Source grep ListingsManager.tsx | Line 567 contains exact string | PASS |
| clearInterval on terminal and unmount | Source grep ListingsManager.tsx | clearPoll() called on ready/failed; useEffect cleanup clears all intervals | PASS |
| Native video element on detail page | Source grep [slug]/page.tsx | `<video controls preload="metadata"` present | PASS |
| "Video tour coming soon" placeholder removed | Source grep [slug]/page.tsx | String absent | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| VIDEO-01 | 06-02, 06-04 | Agent triggers generation; gets <2s async confirmation | VERIFIED | POST returns 202 via AbortController; Generate Video button in ListingsManager |
| VIDEO-02 | 06-01, 06-02, 06-03, 06-04 | After completion, listing.video_url set and video displayed | VERIFIED | applyTerminalResult writes video_url; data.ts maps it with isSafeHttpUrl guard; detail page renders native video |
| VIDEO-03 | 06-01, 06-02, 06-03, 06-04 | Retry/fallback on failure; agent sees status message | PARTIAL | submitWithFallback fallover correct; poller HiggsField fallover broken (image_urls column); "Generation failed — retrying" UI text verified |
| VIDEO-04 | 06-01, 06-02 | No duplicate concurrent jobs; idempotent writes | VERIFIED | findActiveJob dedup; applyTerminalResult idempotent guard; failoverProviderAtomic atomic; UNIQUE task_id |
| VIDEO-05 | 06-01 | VideoProvider abstraction for both providers | VERIFIED | VideoProvider interface; createKieAdapter; createHiggsAdapter; getProviderByName |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/video/poller.ts | 198 | `SELECT image_urls FROM listings WHERE id = ?` — column nonexistent | BLOCKER | HiggsField poller failover always short-circuits as terminal failure; VIDEO-03 poller path broken |
| src/tests/video-callback-api.test.ts | — | CR-01 (getStatus re-derive) and CR-03 (300s timestamp window) patterns not asserted | WARNING | Source-grep test does not enforce these critical security fixes; silent regression risk |
| src/tests/video-trigger-api.test.ts | — | WR-02 (submitResult.attempts, not hard-coded 1) not asserted | WARNING | Test does not verify the true attempt count is passed to recordAttempt |
| src/lib/data.ts | 83 | WR-01 isSafeHttpUrl read-path fix not covered by any source-grep test | WARNING | Read-path defense-in-depth can silently regress without test enforcement |

No unreferenced TBD/FIXME/XXX markers found in any Phase 6 source file.

---

### Human Verification Required

#### 1. Kie.ai callback video URL field shape

**Test:** On first live Kie.ai job, set `VIDEO_CALLBACK_DEBUG=true` in wrangler secrets or dev vars and trigger a generation. Inspect the raw callback body printed in Worker logs.
**Expected:** Either `body.data.video_url` (Runway-style) or `body.data.resultJson.resultUrls[0]` (market/createTask-style) contains the video URL; `extractKieCallbackVideoUrl` correctly extracts it.
**Why human:** The dual-parse is implemented for both shapes but which field Kling 2.6 actually sends is undocumented at verification time (RESEARCH Pitfall 8 / Open Question 1).

#### 2. CR-01 authoritative getStatus outcome against real Kie.ai responses

**Test:** Trigger a video job through to completion and observe the callback route Worker log. Confirm the `createKieAdapter.getStatus(taskId)` call returns the expected status and videoUrl.
**Expected:** For a completed job, getStatus returns `{ status: 'ready', videoUrl: 'https://...' }` and that URL is written to D1. For the processing fallback path, the job is left for the poller. For the network-failure fallback, the unsigned body's extractKieCallbackVideoUrl is used as a last resort.
**Why human:** The Kling 2.6 getStatus response shape needs live confirmation; the getStatus-unavailable fallback path requires a simulated network failure.

#### 3. CR-02 concurrent late-callback timing

**Test:** After fixing the image_urls gap, simulate a Kie.ai late callback arriving while the poller's failoverToHiggsfield is executing between HiggsField submit and failoverProviderAtomic UPDATE.
**Expected:** The late callback's `applyTerminalResult(db, kieTaskId, ...)` matches no processing row (the old task_id was atomically replaced); the job reaches a terminal state without getting wedged.
**Why human:** Concurrency timing requires live testing with deliberate race injection.

#### 4. Apply 0005_video_jobs migration

**Test:** `wrangler d1 migrations apply DB --local && wrangler d1 migrations apply DB --remote`
**Expected:** Migration applies without conflict; `SELECT name FROM sqlite_master WHERE type='table'` includes `video_jobs`; all three indexes exist.
**Why human:** Migration application deferred from all four plan files.

#### 5. Generate Video <2s timing confirmation

**Test:** In wrangler dev with local D1 and real (or mocked) Kie.ai, click Generate Video on a listing with a photo. Measure the 202 response time in the network tab.
**Expected:** HTTP 202 arrives in under 2 seconds regardless of provider submit latency; dashboard shows "Generating..." immediately.
**Why human:** <2s is a live performance requirement; the AbortController sets a 5s timeout on the provider call but the 202 returns after that call chain — total latency under real conditions must be measured.

#### 6. Cron handler scans stale jobs (requires image_urls gap fixed first)

**Test:** After fixing the poller image column, apply the migration, insert a stale processing job in local D1, then `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=%2A%2F5+%2A+%2A+%2A+%2A"`.
**Expected:** Worker logs show `pollVideoJobs` ran, scanned the stale job, polled the provider, and either advanced it to a terminal state or submitted to HiggsField.
**Why human:** Requires a running wrangler dev instance with the applied migration and real or test job data.

#### 7. Dashboard live polling swap-in

**Test:** Trigger generation in a live browser session (wrangler dev) and observe the Video column in the agent dashboard over 30-90 seconds.
**Expected:** Column shows "Generating..." immediately after the button click; transitions to "View video" (on success) or "Generation failed — retrying" (on failure) without a page reload; polling stops after the terminal state appears.
**Why human:** Client-side state, DOM updates, and polling behavior require a live browser session.

#### 8. Public listing detail page video playback

**Test:** Navigate to `/listings/[slug]` for a listing whose D1 row has `video_status='ready'` and a real CDN video URL.
**Expected:** A native HTML5 video player appears with the generated video; it plays correctly; the listing agent's name and other details are intact; no "Video tour coming soon" text appears.
**Why human:** Requires a completed job with a real video URL stored in D1.

#### 9. IN-04 — HiggsField status endpoint URL prefix

**Test:** Submit a real HiggsField job and call `higgsGetStatus(request_id, credentials)`.
**Expected:** GET `https://platform.higgsfield.ai/requests/{request_id}/status` returns HTTP 200 with a valid status response body.
**Why human:** `higgsSubmit` posts to `/v1/image2video/dop` but `higgsGetStatus` uses `/requests/{id}/status` (no `/v1` prefix). RESEARCH Assumption A3 flagged this as unconfirmed; IN-04 notes the path may need a `/v1` prefix.

---

_Verified: 2026-06-14_
_Verifier: Claude (gsd-verifier)_
