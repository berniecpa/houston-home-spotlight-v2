/**
 * Agent Video Trigger — POST /api/agent/listings/[id]/video
 *
 * Initiates an AI video generation job for a listing the agent owns.
 * Returns 202 immediately (<2s) with the job identifier; the provider runs
 * asynchronously and calls back via /api/video/callback (VIDEO-01).
 *
 * Security mitigations:
 *   T-06-05 (Elevation of Privilege — cross-agent trigger):
 *     resolveOwnership preamble — SELECT agent_id, 403 when agent_id !== session uid.
 *   T-06-07 (Elevation of Privilege — suspended/unpublishable agent):
 *     checkSuspended + isAgentPublishable gates reused from Phase 3/5.
 *   T-06-06 (SSRF — pasted photo URL):
 *     isSafeHttpUrl rejects non-http(s) schemes before the URL reaches the provider.
 *   T-04-08 (uid from cookie, never from body):
 *     uid is derived exclusively from getTokens(cookieStore, authEdgeConfig).
 *
 * Dedup (VIDEO-04):
 *   findActiveJob checked before insert; 409 returned if an in-flight job exists.
 *
 * Async submit (VIDEO-01):
 *   submitWithFallback is wrapped in a 5-second AbortController timeout.
 *   On provider failure the job row is left in 'processing' so the cron-poller
 *   (06-03) retries via HiggsField — the agent always receives 202.
 *
 * PLAN-CHECKER FIX W2: on submitWithFallback throw, recordAttempt is called
 * BEFORE returning 202 so the video_jobs row captures the error immediately.
 *
 * @module app/api/agent/listings/[id]/video/route
 */

import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { isSafeHttpUrl } from '@/lib/listings-db';
import {
  getAgentSubscriptionState,
  isAgentPublishable,
} from '@/lib/subscription';
import {
  findActiveJob,
  insertJob,
  setTaskId,
  recordAttempt,
} from '@/lib/video/jobs';
import { submitWithFallback } from '@/lib/video/provider';
import type { VideoEnv } from '@/lib/video/provider';
import { siteConfig } from '@/app/layout';

/** Runtime must be edge for Cloudflare Workers compatibility */
export const runtime = 'edge';

/**
 * Route context: Next.js 15 async params.
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Shared ownership preamble result (success path).
 */
interface OwnershipResult {
  uid: string;
  listingId: string;
  db: D1Database;
}

/**
 * Shared ownership preamble (reused from [id]/route.ts pattern).
 *
 * Loads the session uid and the listing's agent_id from D1.
 * Returns a NextResponse (401/403/404) when the request should be rejected,
 * or an OwnershipResult when the caller is the verified owner.
 *
 * @param listingId - listings.id from the route segment
 */
async function resolveOwnership(
  listingId: string
): Promise<NextResponse | OwnershipResult> {
  // --- 1. Session authentication (T-04-08) — uid from cookie, never from body ---
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  if (!tokens) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!tokens.decodedToken.email_verified) {
    return NextResponse.json(
      { success: false, message: 'Email verification required.' },
      { status: 403 }
    );
  }

  const uid = tokens.decodedToken.uid;

  // --- 2. D1 context ---
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;

  // --- 3. Ownership check (T-06-05 / VIDEO-01) ---
  const existing = await db
    .prepare('SELECT agent_id FROM listings WHERE id = ?')
    .bind(listingId)
    .first<{ agent_id: string }>();

  if (!existing) {
    return NextResponse.json(
      { success: false, message: 'Listing not found.' },
      { status: 404 }
    );
  }

  if (existing.agent_id !== uid) {
    return NextResponse.json(
      { success: false, message: 'Forbidden.' },
      { status: 403 }
    );
  }

  return { uid, listingId, db };
}

/**
 * Check whether the session agent is suspended (T-06-07).
 *
 * Returns a 403 NextResponse when is_suspended=1, or null when the agent
 * is allowed to proceed. Must be called AFTER resolveOwnership (requires db).
 *
 * @param db  - D1Database binding from the owner result
 * @param uid - Session-derived agent uid (never from body)
 */
async function checkSuspended(
  db: D1Database,
  uid: string
): Promise<NextResponse | null> {
  const row = await db
    .prepare('SELECT is_suspended FROM agents WHERE id = ?')
    .bind(uid)
    .first<{ is_suspended: number }>();

  if (row && row.is_suspended === 1) {
    return NextResponse.json(
      { success: false, message: 'Account suspended — contact the administrator.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * POST handler — trigger AI video generation for an agent-owned listing.
 *
 * Gate order:
 *   1. Ownership preamble (401 / 403 email / 404 / 403 cross-agent)
 *   2. Suspension gate (403)
 *   3. Publishability gate (403)
 *   4. Photo gate (400 if no images)
 *   5. SSRF guard on photo URL (400 if non-http(s))
 *   6. Dedup: findActiveJob → 409 if active job exists
 *   7. insertJob + async submitWithFallback (AbortController 5s)
 *   8. Return 202 { jobId, status: 'processing' }
 *
 * @param _request - Incoming POST request
 * @param context  - Route context with async params
 * @returns 202 { jobId, status } | 400 | 401 | 403 | 404 | 409 | 500
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id: listingId } = await params;

    // --- Gate 1: Ownership (401 / 403 / 404 / cross-agent 403) ---
    const ownerResult = await resolveOwnership(listingId);
    if (ownerResult instanceof NextResponse) return ownerResult;
    const { uid, db } = ownerResult;

    // --- Gate 2: Suspension (T-06-07) ---
    const suspendedResponse = await checkSuspended(db, uid);
    if (suspendedResponse) return suspendedResponse;

    // --- Gate 3: Publishability (T-06-07, D-Trigger Authz) ---
    const subscriptionState = await getAgentSubscriptionState(db, uid);
    if (!subscriptionState || !isAgentPublishable(subscriptionState)) {
      return NextResponse.json(
        { success: false, message: 'Active subscription required to generate videos.' },
        { status: 403 }
      );
    }

    // --- Gate 4: Photo gate (T-06-06 SSRF surface — require at least one image) ---
    const imageRow = await db
      .prepare(
        `SELECT url FROM listing_images WHERE listing_id = ?
         ORDER BY display_order ASC LIMIT 1`
      )
      .bind(listingId)
      .first<{ url: string }>();

    if (!imageRow) {
      return NextResponse.json(
        { success: false, message: 'Listing has no photo to animate.' },
        { status: 400 }
      );
    }

    // --- Gate 5: SSRF guard (T-06-06) — only http(s) URLs reach the provider ---
    if (!isSafeHttpUrl(imageRow.url)) {
      return NextResponse.json(
        { success: false, message: 'Listing photo URL is not a valid http(s) URL.' },
        { status: 400 }
      );
    }

    // --- Gate 6: Dedup (VIDEO-04) — never spawn a second concurrent job ---
    const activeJob = await findActiveJob(db, listingId);
    if (activeJob) {
      return NextResponse.json(
        { jobId: activeJob.id, status: activeJob.status },
        { status: 409 }
      );
    }

    // --- Gate 7: Insert job row + async submit ---
    const jobId = crypto.randomUUID();
    await insertJob(db, {
      id: jobId,
      listingId,
      agentId: uid,
      provider: 'kie',
    });

    // Reflect in-flight state on the listing so the dashboard shows 'processing'
    await db
      .prepare(
        `UPDATE listings SET video_status = 'processing', updated_at = unixepoch()
         WHERE id = ?`
      )
      .bind(listingId)
      .run();

    // Build callback URL pointing to our HMAC-verified endpoint (middleware-exempt)
    const callbackUrl = `${siteConfig.url}/api/video/callback`;

    // Retrieve the full env for the video provider layer
    const { env } = await getCloudflareContext({ async: true });

    // Async submit with 5-second timeout — must not block the 202 response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const submitResult = await submitWithFallback(
        env as unknown as VideoEnv,
        imageRow.url,
        callbackUrl
      );
      clearTimeout(timeoutId);
      // Success: record the provider-assigned task_id and attempt details
      await setTaskId(db, jobId, submitResult.taskId);
      await recordAttempt(db, jobId, submitResult.provider, 1);
    } catch (submitError) {
      clearTimeout(timeoutId);
      // PLAN-CHECKER FIX W2: record the failure BEFORE returning 202 so the
      // video_jobs row captures error=<msg> immediately (don't leave error=null
      // until the poller runs). The job stays 'processing' for the cron-poller.
      const errorMsg =
        submitError instanceof Error ? submitError.message : String(submitError);
      await recordAttempt(db, jobId, 'kie', 1, errorMsg);
      // Fall through — return 202 so the agent is not blocked.
      // The cron-poller (06-03) will retry via HiggsField.
    }

    // --- Gate 8: Return 202 immediately (VIDEO-01, <2s) ---
    return NextResponse.json(
      { jobId, status: 'processing' },
      { status: 202 }
    );
  } catch (error) {
    console.error('POST /api/agent/listings/[id]/video error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
