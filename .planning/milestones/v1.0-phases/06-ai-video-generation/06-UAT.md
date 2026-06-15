---
status: testing
phase: 06-ai-video-generation
source: [06-VERIFICATION.md]
started: 2026-06-14T00:00:00Z
updated: 2026-06-14T00:00:00Z
note: Deferred per autonomous-run directive. Requires the 0005 migration applied, KIE_API_KEY + KIE_WEBHOOK_SECRET + HIGGSFIELD_API_KEY (KEY_ID:KEY_SECRET) in .dev.vars, deploy with custom-worker.ts main + cron, and wrangler dev. The VIDEO-03 poller-failover code gap was fixed post-verification (commit 3690d95).
---

## Current Test

number: 1
name: Confirm Kie.ai callback video URL field shape on first live job
expected: |
  Either body.data.video_url or body.data.resultJson.resultUrls[0] is populated;
  set VIDEO_CALLBACK_DEBUG=true and inspect the raw body log.
awaiting: user response

## Tests

### 1. Kie.ai callback video URL field shape (first live job)
expected: VIDEO_CALLBACK_DEBUG raw-body log shows which field (data.video_url vs resultJson.resultUrls[0]) Kling 2.6 actually populates; dual-parse handles both
result: [pending]

### 2. CR-01 authoritative getStatus outcome vs real Kie.ai responses
expected: after HMAC+timestamp verify, getStatus(taskId) returns ready+valid videoUrl; ready/processing/failed branches route correctly (body video_url NOT trusted)
result: [pending]

### 3. CR-02 atomic failover under concurrent late callback
expected: a late Kie callback during failoverProviderAtomic does not resurrect/wedge the job; applyTerminalResult for the old task_id is a clean no-op
result: [pending]

### 4. Apply 0005_video_jobs migration (local + remote)
expected: wrangler d1 migrations apply succeeds; video_jobs has all columns, UNIQUE task_id, 3 indexes; no conflict with 0001-0004
result: [pending]

### 5. Trigger Generate Video — <2s 202 (VIDEO-01)
expected: POST .../video returns 202 in <2s; dashboard shows "Generating..." immediately, no blocking spinner
result: [pending]

### 6. Cron handler scans stale jobs (poller fallback)
expected: curl .../cdn-cgi/handler/scheduled?cron=*/5+*+*+*+* returns 200; log shows pollVideoJobs advanced a stale processing job (image_urls gap fixed in 3690d95)
result: [pending]

### 7. Dashboard live polling swap-in (VIDEO-02)
expected: Video column goes Generating... -> View video (or "Generation failed — retrying") with no page reload; polling stops on terminal; interval cleared on unmount
result: [pending]

### 8. Public detail page video playback (VIDEO-04)
expected: /listings/[slug] with a ready video_url shows a native HTML5 player that plays the video; no "Video tour coming soon" placeholder
result: [pending]

### 9. IN-04 HiggsField status endpoint URL prefix
expected: GET https://platform.higgsfield.ai/requests/{id}/status returns 200 (not 404 from a missing version prefix); confirm the real base path
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
