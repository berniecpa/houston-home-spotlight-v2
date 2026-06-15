/**
 * Video Trigger API Tests — Plan 06-02, Task 1
 *
 * Source-grep assertions for:
 *   1. video/route.ts — exports POST + runtime='edge'; ownership preamble; suspension
 *      gate; publishability gate; photo 400 + isSafeHttpUrl; findActiveJob dedup
 *      (409); insertJob + submitWithFallback + setTaskId; returns 202; does NOT
 *      return 500 when submit throws (the catch leaves the job processing and calls
 *      recordAttempt BEFORE returning 202 — PLAN-CHECKER FIX W2).
 *   2. video-status/route.ts — exports GET; ownership preamble; returns status + videoUrl.
 *
 * @module tests/video-trigger-api
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const triggerPath = join(
  root,
  'src/app/api/agent/listings/[id]/video/route.ts'
);
const statusPath = join(
  root,
  'src/app/api/agent/listings/[id]/video-status/route.ts'
);

const trigger = readFileSync(triggerPath, 'utf-8');
const statusRoute = readFileSync(statusPath, 'utf-8');

// ---------------------------------------------------------------------------
// video/route.ts — trigger endpoint
// ---------------------------------------------------------------------------

describe('video/route.ts — POST trigger', () => {
  it('exports POST handler', () => {
    assert.ok(
      trigger.includes('export async function POST'),
      'video/route.ts must export POST'
    );
  });

  it("does NOT declare runtime = 'edge'", () => {
    assert.ok(
      !trigger.includes("export const runtime = 'edge'"),
      "video/route.ts must NOT declare runtime = 'edge' — @opennextjs/cloudflare uses the Node.js runtime"
    );
  });

  it('imports and calls getTokens for session auth (uid from cookie, never body)', () => {
    assert.ok(
      trigger.includes("from 'next-firebase-auth-edge'") &&
        trigger.includes('getTokens'),
      'video/route.ts must import getTokens from next-firebase-auth-edge'
    );
    assert.ok(
      trigger.includes('getTokens(cookieStore, authEdgeConfig)'),
      'video/route.ts must call getTokens(cookieStore, authEdgeConfig)'
    );
  });

  it('returns 401 when no session tokens', () => {
    assert.ok(
      trigger.includes('status: 401'),
      'video/route.ts must return 401 when no tokens'
    );
  });

  it('selects agent_id from listings for ownership check', () => {
    assert.ok(
      trigger.includes('SELECT agent_id FROM listings WHERE id = ?'),
      'video/route.ts must SELECT agent_id FROM listings for ownership check'
    );
  });

  it('returns 403 for cross-agent trigger (T-06-05)', () => {
    // Must check agent_id !== uid and return 403
    assert.ok(
      trigger.includes('agent_id !== uid') ||
        trigger.includes('existing.agent_id !== uid'),
      'video/route.ts must compare agent_id with uid and 403 on mismatch'
    );
    // 403 must appear multiple times (cross-agent + suspended + unpublishable)
    const count403 = (trigger.match(/status: 403/g) ?? []).length;
    assert.ok(
      count403 >= 2,
      `video/route.ts must have at least 2 403 responses, found ${count403}`
    );
  });

  it('calls checkSuspended for suspension gate (T-06-07)', () => {
    assert.ok(
      trigger.includes('checkSuspended'),
      'video/route.ts must call checkSuspended'
    );
    assert.ok(
      trigger.includes('is_suspended'),
      'video/route.ts must query is_suspended column'
    );
  });

  it('calls isAgentPublishable for subscription gate (T-06-07)', () => {
    assert.ok(
      trigger.includes('isAgentPublishable'),
      'video/route.ts must call isAgentPublishable'
    );
    assert.ok(
      trigger.includes('getAgentSubscriptionState'),
      'video/route.ts must call getAgentSubscriptionState'
    );
  });

  it('queries listing_images and returns 400 when no photo (T-06-06)', () => {
    assert.ok(
      trigger.includes('listing_images'),
      'video/route.ts must query listing_images table'
    );
    assert.ok(
      trigger.includes('Listing has no photo to animate'),
      'video/route.ts must return 400 with "Listing has no photo to animate" message'
    );
  });

  it('validates photo URL with isSafeHttpUrl (T-06-06 SSRF)', () => {
    assert.ok(
      trigger.includes('isSafeHttpUrl'),
      'video/route.ts must call isSafeHttpUrl on the photo URL'
    );
  });

  it('calls findActiveJob and returns 409 when active job exists (VIDEO-04)', () => {
    assert.ok(
      trigger.includes('findActiveJob'),
      'video/route.ts must call findActiveJob for dedup'
    );
    assert.ok(
      trigger.includes('status: 409'),
      'video/route.ts must return 409 when active job exists'
    );
  });

  it('calls insertJob to create the video job row', () => {
    assert.ok(
      trigger.includes('insertJob'),
      'video/route.ts must call insertJob'
    );
  });

  it('calls submitWithFallback for async provider submission', () => {
    assert.ok(
      trigger.includes('submitWithFallback'),
      'video/route.ts must call submitWithFallback'
    );
  });

  it('wraps submitWithFallback with AbortController timeout', () => {
    assert.ok(
      trigger.includes('AbortController'),
      'video/route.ts must use AbortController for timeout'
    );
  });

  it('calls setTaskId on successful submission', () => {
    assert.ok(
      trigger.includes('setTaskId'),
      'video/route.ts must call setTaskId after successful submission'
    );
  });

  it('calls recordAttempt on successful submission', () => {
    assert.ok(
      trigger.includes('recordAttempt'),
      'video/route.ts must call recordAttempt'
    );
  });

  it('returns 202 on success (VIDEO-01 <2s async response)', () => {
    assert.ok(
      trigger.includes('status: 202'),
      'video/route.ts must return 202'
    );
  });

  it('does NOT 500 the agent when submitWithFallback throws (PLAN-CHECKER FIX W2)', () => {
    // The catch block must call recordAttempt BEFORE returning 202 — no 500 in catch
    // Verify the catch block captures error and calls recordAttempt (not returns 500)
    const catchIdx = trigger.indexOf('} catch (submitError)');
    assert.ok(
      catchIdx !== -1,
      'video/route.ts must have a catch block for submitError'
    );
    // recordAttempt must appear AFTER the catch block opens
    const recordAfterCatch = trigger.indexOf('recordAttempt', catchIdx);
    assert.ok(
      recordAfterCatch !== -1,
      'video/route.ts must call recordAttempt inside the submitError catch block (PLAN-CHECKER FIX W2)'
    );
    // 202 must appear after the catch (the function returns 202 regardless)
    const resp202AfterCatch = trigger.indexOf('status: 202', catchIdx);
    assert.ok(
      resp202AfterCatch !== -1,
      'video/route.ts must return 202 after the submitError catch block'
    );
  });

  it('updates listings.video_status to processing on submit', () => {
    assert.ok(
      trigger.includes("video_status = 'processing'"),
      "video/route.ts must UPDATE listings SET video_status = 'processing'"
    );
  });

  it('builds callbackUrl from siteConfig.url', () => {
    assert.ok(
      trigger.includes('siteConfig.url'),
      'video/route.ts must build callbackUrl from siteConfig.url'
    );
    assert.ok(
      trigger.includes('/api/video/callback'),
      'video/route.ts must point callbackUrl at /api/video/callback'
    );
  });
});

// ---------------------------------------------------------------------------
// video-status/route.ts — status poll endpoint
// ---------------------------------------------------------------------------

describe('video-status/route.ts — GET status endpoint', () => {
  it('exports GET handler', () => {
    assert.ok(
      statusRoute.includes('export async function GET'),
      'video-status/route.ts must export GET'
    );
  });

  it("does NOT declare runtime = 'edge'", () => {
    assert.ok(
      !statusRoute.includes("export const runtime = 'edge'"),
      "video-status/route.ts must NOT declare runtime = 'edge' — @opennextjs/cloudflare uses the Node.js runtime"
    );
  });

  it('reuses the ownership preamble (getTokens + agent_id check)', () => {
    assert.ok(
      statusRoute.includes('getTokens'),
      'video-status/route.ts must call getTokens for auth'
    );
    assert.ok(
      statusRoute.includes('SELECT agent_id FROM listings WHERE id = ?'),
      'video-status/route.ts must SELECT agent_id for ownership check'
    );
  });

  it('returns 401 when no session tokens', () => {
    assert.ok(
      statusRoute.includes('status: 401'),
      'video-status/route.ts must return 401 when unauthenticated'
    );
  });

  it('returns 403 when agent is not the owner (T-06-08)', () => {
    assert.ok(
      statusRoute.includes('status: 403'),
      'video-status/route.ts must return 403 for non-owners (T-06-08)'
    );
  });

  it('returns 404 when listing not found', () => {
    assert.ok(
      statusRoute.includes('status: 404'),
      'video-status/route.ts must return 404 when listing not found'
    );
  });

  it('queries video_jobs ordered by updated_at DESC (latest job)', () => {
    assert.ok(
      statusRoute.includes('video_jobs'),
      'video-status/route.ts must query video_jobs table'
    );
    assert.ok(
      statusRoute.includes('ORDER BY updated_at DESC'),
      'video-status/route.ts must ORDER BY updated_at DESC to get the latest job'
    );
  });

  it('queries listings.video_url and video_status', () => {
    assert.ok(
      statusRoute.includes('video_url') && statusRoute.includes('video_status'),
      'video-status/route.ts must query video_url and video_status from listings'
    );
  });

  it('returns { status, videoUrl } response shape', () => {
    assert.ok(
      statusRoute.includes('status') && statusRoute.includes('videoUrl'),
      'video-status/route.ts must return { status, videoUrl } response'
    );
  });

  it("falls back to 'none' when no job row exists", () => {
    assert.ok(
      statusRoute.includes("'none'"),
      "video-status/route.ts must return status 'none' when no job row exists"
    );
  });
});
