---
phase: 06-ai-video-generation
reviewed: 2026-06-14T22:57:20Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/lib/video/types.ts
  - src/lib/video/kie-adapter.ts
  - src/lib/video/higgsfield-adapter.ts
  - src/lib/video/provider.ts
  - src/lib/video/jobs.ts
  - src/lib/video/poller.ts
  - src/app/api/agent/listings/[id]/video/route.ts
  - src/app/api/agent/listings/[id]/video-status/route.ts
  - src/app/api/video/callback/route.ts
  - src/components/dashboard/ListingsManager.tsx
  - src/app/listings/[slug]/page.tsx
  - custom-worker.ts
  - wrangler.toml
  - db/migrations/0005_video_jobs.sql
findings:
  critical: 3
  warning: 7
  info: 5
  total: 15
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-14T22:57:20Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Phase 6 async AI-video pipeline (Kie.ai primary + HiggsField fallback) on Cloudflare Workers + D1. The core security architecture is largely sound: the HMAC verification uses a genuine constant-time compare, the callback rejects when the secret is unset (fails closed), the trigger and status routes derive identity from the session cookie (not the body), the dedup/idempotency guards (`findActiveJob` → 409, `WHERE status='processing'` / `changes===0`) are correct, and the poller converges on the same `applyTerminalResult` path as the callback. The custom-worker re-export + scheduled handler and wrangler `main`/`[triggers]` are coherent; the middleware matcher (`['/dashboard/:path*','/admin/:path*']`) correctly leaves the callback exempt.

However, several real defects remain. The most serious: **the callback never validates timestamp freshness**, so a captured-and-replayed callback stays valid forever; and **the HMAC signs only `taskId.timestamp`, not the body**, so the attacker-influenced `video_url`/`code` fields are unauthenticated and can be replayed verbatim while a job is `processing`. This is compounded because **the poller failover returns a job to `processing`** under a new task_id, breaking the monotonic `processing → terminal` invariant the replay defense relies on. The public listing detail page also renders `video_url` into a `<video src>` with no read-path scheme re-validation.

## Critical Issues

### CR-01: Callback HMAC does not cover the body — `video_url` is unauthenticated and forgeable via replay

**File:** `src/app/api/video/callback/route.ts:116-142`, `src/lib/video/kie-adapter.ts:176-218`
**Issue:** The signature is computed over `taskId + "." + timestamp` only (`verifyKieSignature`, kie-adapter.ts:182). The payload body — including `data.video_url` / `data.resultJson` and `code` — is **never** covered by the MAC. Consequences:
1. Any party who observes one legitimate callback (or reconstructs valid headers for a known taskId) can replay the **exact bytes** and, while the job is still `processing` (or has been returned to `processing` by the poller failover — see CR-02), `applyTerminalResult` writes the body's `video_url` to `listings.video_url`. The `isSafeHttpUrl` guard only blocks non-http(s) schemes; it does not prevent substituting an arbitrary attacker-controlled `https://evil/...` URL carried in the replayed body.
2. The brief's requirement "confirm a forged callback cannot set an arbitrary video_url" is **not** met for the replay case, because integrity is anchored to `taskId.timestamp` rather than to the body.

**Fix:** Bind the body to the verification. If Kie.ai genuinely signs only `taskId.timestamp`, do not trust the body's `video_url` — after signature + freshness pass, re-derive the authoritative result from the provider:
```ts
const adapter = createKieAdapter(env.KIE_API_KEY);
const authoritative = await adapter.getStatus(taskId);
const outcome: TerminalOutcome =
  authoritative.status === 'ready' && authoritative.videoUrl
    ? { status: 'ready', videoUrl: authoritative.videoUrl }
    : { status: 'failed', error: 'callback did not confirm a ready result' };
```
If Kie.ai actually signs the full body, change `verifyKieSignature` to MAC the raw body bytes.

### CR-02: Poller failover returns a job to `processing`, defeating the idempotency guard

**File:** `src/lib/video/poller.ts:171-230`, `src/lib/video/jobs.ts:164-234`
**Issue:** The replay/idempotency story rests on `applyTerminalResult`'s `WHERE task_id=? AND status='processing'` guard — once terminal, writes no-op. But `failoverToHiggsfield` calls `setTaskId` + `recordAttempt` and **deliberately leaves the job `processing`** (poller.ts:220) under a **new** `task_id` (poller.ts:215). Two gaps:
1. The original Kie.ai `task_id` is overwritten (poller.ts:215). If the original Kie.ai callback then arrives (Kie retries 3×), `applyTerminalResult(db, kieTaskId, ...)` matches **no row** → the legitimate Kie result is silently dropped.
2. The invariant "a job reaches `processing` only once" is violated, so any replay defense assuming monotonic `processing → terminal` is unsound. A captured callback for the new task_id during this second `processing` window is writable.

**Fix:** Do not reuse the same row for the failover provider. Either model the retry as a brand-new `video_jobs` row (preserving the monotonic invariant), or null the old `task_id` atomically and add a monotonic `generation` discriminator the callback must match so a superseded task_id cannot match the live row.

### CR-03: No timestamp-freshness / replay-window enforcement on the callback

**File:** `src/app/api/video/callback/route.ts:73-123`
**Issue:** `X-Webhook-Timestamp` is read (line 73) and fed into the HMAC, but its value is **never** checked against the current time. A captured callback (headers + body) is replayable forever — the HMAC stays valid because the signed timestamp never expires. This is the standard webhook replay defense and it is absent, despite the "ASVS V6" claim in the `verifyKieSignature` doc comment.

**Fix:** Reject callbacks outside a tolerance window before signature verification:
```ts
const tsNum = Number(timestamp);
if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
  return NextResponse.json({ error: 'Stale webhook timestamp' }, { status: 400 });
}
```

## Warnings

### WR-01: Public `<video src>` renders persisted `video_url` with no scheme re-validation

**File:** `src/app/listings/[slug]/page.tsx:382-400`, `src/lib/data.ts:80`
**Issue:** `getListingBySlug` maps `row.video_url` straight to `listing.videoUrl` (data.ts:80) and the detail page binds it to `<video src={listing.videoUrl}>` and JSON-LD `video:` (page.tsx:120, 392) **without** passing through `isSafeHttpUrl`. The scheme guard exists only on the write path (`applyTerminalResult`). But `video_url` is also populated by `db/migrations/0003_seed_legacy_listings.sql`, so the read path has no defense-in-depth.
**Fix:** Re-validate at the boundary in `rowToListing`:
```ts
videoUrl: row.video_url && isSafeHttpUrl(row.video_url) ? row.video_url : undefined,
```

### WR-02: `attempts` count hard-coded to `1` on trigger success path, corrupting poller failover cap

**File:** `src/app/api/agent/listings/[id]/video/route.ts:269-270`
**Issue:** `submitWithFallback` may try Kie.ai twice then HiggsField, but on success the route always calls `recordAttempt(db, jobId, submitResult.provider, 1)`. The poller gates HiggsField failover on `job.attempts < KIE_ATTEMPT_CAP (2)` (poller.ts:138). A job that already exhausted both Kie attempts but is recorded as `attempts=1` can be failed over again, exceeding the intended cap.
**Fix:** Return the true attempt count from `submitWithFallback` (add to `SubmitResult`) and persist it.

### WR-03: Callback success/failure decision keys on unauthenticated `body.code`

**File:** `src/app/api/video/callback/route.ts:129-142`
**Issue:** Even before CR-01, the outcome keys on `body.code === 200` (line 129) — an unsigned body field. With the replay window (CR-03), the attacker controls whether the job is marked ready or failed.
**Fix:** Re-derive outcome from `getStatus` (see CR-01 fix) rather than trusting `body.code`/`body.failMsg`.

### WR-04: `video-status` returns `listings.video_url` even when the latest job is `failed`/`processing`

**File:** `src/app/api/agent/listings/[id]/video-status/route.ts:154-165`
**Issue:** `videoUrl` is read from `listingRow.video_url` unconditionally (line 154) and returned alongside `jobRow.status`. If a listing previously produced a video, then a new generation fails, the response is `{ status: 'failed', videoUrl: <old url> }`; the client stores `videoUrl` for both ready and failed (ListingsManager.tsx:175-184), risking a stale "View video" link.
**Fix:** Return `videoUrl` only when status is `ready`.

### WR-05: `console.log` of full raw callback body ships unconditionally

**File:** `src/app/api/video/callback/route.ts:70`
**Issue:** `console.log('[video/callback] raw body:', raw)` logs the entire untrusted payload on every callback. The comment says to remove/guard it after first live test, but it ships as-is — a log-noise / log-injection vector on attacker-controlled input.
**Fix:** Guard behind an env flag (move the `env` fetch from line 103 up) or remove.

### WR-06: `kieGetStatus` failure branch drops the provider error reason

**File:** `src/lib/video/kie-adapter.ts:143-145`
**Issue:** On Kie `state === 'fail'` the function returns bare `{ status: 'failed' }`, discarding `json.data.failMsg`/`failCode`. The poller then persists only a generic synthesized message, inconsistent with the callback which captures `failMsg`.
**Fix:** Include the provider failure message in the returned object.

### WR-07: `task_id UNIQUE` + non-atomic failover writes can wedge a job in `processing`

**File:** `db/migrations/0005_video_jobs.sql:19`, `src/lib/video/poller.ts:215-218`
**Issue:** `task_id TEXT UNIQUE`. Failover overwrites `task_id` with the HiggsField `request_id` (poller.ts:215); if that value collides with another row's `task_id`, the UPDATE throws UNIQUE, swallowed by the per-job try/catch (poller.ts:100-102), leaving the job stuck `processing` forever. Also `setTaskId` then `recordAttempt` are two non-atomic writes — a crash between them leaves a HiggsField task_id with provider still `'kie'`, so the next scan calls the Kie adapter with a HiggsField request_id.
**Fix:** Make the failover provider+task_id+attempts update a single atomic statement; reconsider the global UNIQUE given task_ids are reused across rows (the CR-02 fresh-row fix also resolves this).

## Info

### IN-01: Documented `queued` state is dead

**File:** `db/migrations/0005_video_jobs.sql:20`, `src/lib/video/jobs.ts:84`
**Issue:** Types/comments describe a `queued` state, but `insertJob` always inserts `status='processing'`. `findActiveJob` still queries `IN ('queued','processing')` (jobs.ts:60) — harmless but unused.
**Fix:** Either use `queued` on insert (transition to `processing` after submit) or drop it from the type/queries.

### IN-02: Both adapters' failure branches drop provider error detail

**File:** `src/lib/video/higgsfield-adapter.ts:140-145`, `src/lib/video/kie-adapter.ts:143-145`
**Issue:** Both return bare `{ status: 'failed' }`; provider failure reasons are lost and the poller synthesizes a generic message.
**Fix:** Propagate the provider's failure message.

### IN-03: Trigger sets `video_status='processing'` before submit success is known

**File:** `src/app/api/agent/listings/[id]/video/route.ts:242-249`
**Issue:** `listings.video_status` is set `processing` before the provider call; if the request crashes before `setTaskId`, the listing shows `processing` until the poller stale window. Self-heals via poller; cosmetic.
**Fix:** Acceptable as-is; optionally set `video_status` only after `setTaskId`.

### IN-04: HiggsField status URL omits the `/v1` version prefix used by submit

**File:** `src/lib/video/higgsfield-adapter.ts:120-128`
**Issue:** `higgsGetStatus` uses `.../requests/{id}/status` while `higgsSubmit` posts to `.../v1/image2video/dop`. If the status endpoint is also versioned, this 404s; the poller treats the thrown error as a per-job swallow, leaving the job stuck.
**Fix:** Confirm the exact status path/version against the HiggsField SDK source cited in the header comment.

### IN-05: `provider` column has no CHECK constraint; corrupt value silently routes to Kie

**File:** `db/migrations/0005_video_jobs.sql:18`, `src/lib/video/provider.ts:119-122`
**Issue:** `provider TEXT NOT NULL` accepts any string; `getProviderByName` defaults anything not `'higgsfield'` to the Kie adapter, so a corrupt value silently routes to Kie.
**Fix:** Add `CHECK (provider IN ('kie','higgsfield'))` and narrow the param types to the union.

---

_Reviewed: 2026-06-14T22:57:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
