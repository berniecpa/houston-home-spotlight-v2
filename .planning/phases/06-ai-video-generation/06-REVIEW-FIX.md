---
phase: 06-ai-video-generation
fixed_at: 2026-06-14T00:00:00Z
review_path: .planning/phases/06-ai-video-generation/06-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-06-14
**Source review:** .planning/phases/06-ai-video-generation/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 10
- Fixed: 10
- Skipped: 0
- Info findings (out of scope): IN-01..IN-05 not addressed (info-tier; note IN-02
  was fixed opportunistically alongside WR-06 since it shared the same adapter code).

**Verification:** `npx tsc --noEmit` clean; `npm test` GREEN at 1282 pass / 0 fail
(baseline was 1282 / 0 — source-grep tests strengthened in place, not weakened).

## Fixed Issues

### CR-01: Callback HMAC does not cover the body — `video_url` is unauthenticated and forgeable via replay

**Files modified:** `src/app/api/video/callback/route.ts`, `src/lib/video/kie-adapter.ts`
**Commit:** c64a4cf
**Applied fix:** After signature + freshness pass, the verified callback is now
treated purely as a wake-up. The terminal outcome is re-derived from an
authenticated server-to-server `createKieAdapter(env.KIE_API_KEY).getStatus(taskId)`
call; the unsigned body's `video_url`/`code` are no longer trusted on the write
path. The body's dual-parsed URL (`extractKieCallbackVideoUrl`) is retained only
as a degraded fallback when `getStatus` is unavailable, and `applyTerminalResult`
still re-validates the scheme. Requires human verification of the authoritative
ready/processing/failed branching against real Kie.ai responses.

### CR-02: Poller failover returns a job to `processing`, defeating the idempotency guard

**Files modified:** `src/lib/video/jobs.ts`, `src/lib/video/poller.ts`, `src/tests/video-poller.test.ts`
**Commit:** dba292a
**Applied fix:** Added `failoverProviderAtomic` — a single guarded
`UPDATE ... WHERE id=? AND status='processing'` that swaps provider + task_id +
attempts atomically. The original Kie task_id is replaced in one statement, so a
late Kie callback for the old task_id matches no processing row and is a clean
no-op; the monotonic processing->terminal invariant holds and a `ready` job is
never resurrected. Requires human verification of the failover state-machine
transition under concurrent late-callback timing.

### CR-03: No timestamp-freshness / replay-window enforcement on the callback

**Files modified:** `src/app/api/video/callback/route.ts`
**Commit:** c64a4cf
**Applied fix:** Added a freshness gate before signature verification: rejects
with 400 "Stale webhook timestamp" when `X-Webhook-Timestamp` is non-finite or
more than 300s from now (stale or future-dated). Constant
`WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300`.

### WR-01: Public `<video src>` renders persisted `video_url` with no scheme re-validation

**Files modified:** `src/lib/data.ts`
**Commit:** 5803f26
**Applied fix:** `rowToListing` now sets `videoUrl` only when
`isSafeHttpUrl(row.video_url)` passes — read-path defense in depth covering
seed/legacy rows that bypassed the write-path guard.

### WR-02: `attempts` count hard-coded to `1` on trigger success path

**Files modified:** `src/lib/video/provider.ts`, `src/app/api/agent/listings/[id]/video/route.ts`
**Commit:** 885910a
**Applied fix:** `SubmitResult` gains an `attempts` field; `submitWithFallback`
tracks a running total and the trigger route records `submitResult.attempts`
instead of `1`, so the poller's `attempts < KIE_ATTEMPT_CAP` cap is accurate.

### WR-03: Callback success/failure decision keys on unauthenticated `body.code`

**Files modified:** `src/app/api/video/callback/route.ts`
**Commit:** c64a4cf
**Applied fix:** Resolved together with CR-01 — outcome is derived from the
authenticated `getStatus` result, never from `body.code` / `body.failMsg`.

### WR-04: `video-status` returns `listings.video_url` even when the latest job is `failed`/`processing`

**Files modified:** `src/app/api/agent/listings/[id]/video-status/route.ts`
**Commit:** ec1214b
**Applied fix:** `videoUrl` is returned only when the effective status is
`ready` (both the job-row branch and the no-job fallback branch); otherwise
`null`, preventing a stale "View video" link.

### WR-05: `console.log` of full raw callback body ships unconditionally

**Files modified:** `src/app/api/video/callback/route.ts`
**Commit:** c64a4cf
**Applied fix:** The raw-body log is now guarded behind a `VIDEO_CALLBACK_DEBUG`
env flag, so the attacker-influenced payload is not logged in production.

### WR-06: `kieGetStatus` failure branch drops the provider error reason

**Files modified:** `src/lib/video/types.ts`, `src/lib/video/kie-adapter.ts`
**Commit:** 7227525
**Applied fix:** `getStatus` return type gains optional `error`; `kieGetStatus`
returns `failMsg` (or `failCode`) on a `fail` state. The poller's terminal-failure
branch now prefers the provider-supplied reason.

### WR-07: `task_id UNIQUE` + non-atomic failover writes can wedge a job in `processing`

**Files modified:** `src/lib/video/jobs.ts`, `src/lib/video/poller.ts`, `src/tests/video-poller.test.ts`
**Commit:** dba292a
**Applied fix:** Resolved together with CR-02. The atomic swap replaces the
non-atomic `setTaskId` + `recordAttempt` pair (closing the crash window), and a
`task_id` UNIQUE collision is caught and surfaced as `taskIdCollision`, after
which `failJobById` finalizes the job as failed by primary key rather than
leaving it stuck in `processing`. The migration's `task_id UNIQUE` constraint is
intentionally retained (migration test contract); the wedge is fully handled at
the code level. Requires human verification of collision handling.

## Notes

- IN-02 (both adapters drop provider failure detail) was fixed alongside WR-06
  (`higgsfield-adapter.ts` now returns `error` on `nsfw`/`failed`), since the same
  type change enabled it at no extra risk.
- IN-01, IN-03, IN-04, IN-05 are info-tier and out of the critical_warning scope;
  not addressed this iteration. IN-04 (HiggsField status URL `/v1` prefix) needs
  confirmation against the live SDK and IN-05 (provider CHECK constraint) would
  alter the applied migration — both deferred as larger/verification-dependent.

---

_Fixed: 2026-06-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
