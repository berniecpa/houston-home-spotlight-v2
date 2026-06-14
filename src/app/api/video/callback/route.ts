/**
 * Kie.ai Video Callback — POST /api/video/callback
 *
 * Server-to-server webhook received from Kie.ai on job completion.
 * Verifies the HMAC-SHA256 signature, parses the video URL, and
 * idempotently writes the result to D1 (VIDEO-02).
 *
 * Middleware exemption:
 *   The middleware matcher covers only ['/dashboard/:path*', '/admin/:path*'].
 *   /api/video/callback is intentionally public — Kie.ai calls server-to-server
 *   with NO __session cookie. Do NOT add /api/* to the middleware matcher.
 *   middleware.ts is NOT modified by this plan. The current matcher is confirmed:
 *   export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] }
 *   This route is therefore exempt from auth middleware.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration
 *   on this route style — match the Stripe webhook which omits it.
 *
 * Security mitigations:
 *   T-06-04 (Spoofing — forged callback POST):
 *     verifyKieSignature HMAC-SHA256 over `taskId.timestamp`; 400 if header
 *     absent or KIE_WEBHOOK_SECRET unset (ASVS V6).
 *   T-06-03 (Tampering — replayed/duplicate callback):
 *     applyTerminalResult guarded WHERE task_id=? AND status='processing';
 *     {applied:false} → 200 no-op (VIDEO-04).
 *   CR-03 (Replay — captured callback replayed forever):
 *     X-Webhook-Timestamp is checked against a tolerance window and rejected
 *     when stale or future-dated, before signature verification.
 *   CR-01/WR-03 (Forged/replayed body — unsigned video_url/code):
 *     The HMAC covers only taskId.timestamp, so the body is NOT authenticated.
 *     The terminal outcome is re-derived from an authenticated getStatus call
 *     to Kie.ai; the body's video_url/code are never trusted on the write path.
 *
 * Body must be read as raw text FIRST (same rule as Stripe webhook):
 *   Any prior req.json() call would consume the stream and corrupt HMAC bytes.
 *
 * @module app/api/video/callback/route
 */

import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  verifyKieSignature,
  extractKieCallbackVideoUrl,
  createKieAdapter,
} from '@/lib/video/kie-adapter';
import type { KieCallbackBody } from '@/lib/video/kie-adapter';
import { applyTerminalResult } from '@/lib/video/jobs';
import type { TerminalOutcome } from '@/lib/video/jobs';

/**
 * Replay-window tolerance for X-Webhook-Timestamp in seconds (CR-03).
 * A captured callback older than this (or dated in the future) is rejected so
 * a replayed payload cannot stay valid forever.
 */
const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * POST handler — receive and process Kie.ai job completion callback.
 *
 * 1. Read raw body FIRST (HMAC integrity requirement).
 * 2. Enforce X-Webhook-Timestamp freshness (CR-03): reject 400 outside the
 *    replay-window tolerance before signature verification.
 * 3. Verify HMAC signature (T-06-04): reject 400 on missing headers or bad sig.
 * 4. Reject 400 if KIE_WEBHOOK_SECRET is unset (Pitfall 1 — never trust unsigned).
 * 5. Re-derive the outcome from the AUTHENTICATED Kie.ai getStatus (CR-01/WR-03)
 *    — the unsigned body's video_url/code are never trusted (replay-safe).
 * 6. Idempotent write (T-06-03): applyTerminalResult; 200 no-op on {applied:false}.
 * 7. Return 200 { received: true } so Kie.ai stops retrying.
 *
 * @param req - Raw incoming POST request from Kie.ai (no session cookie)
 * @returns 400 | 200
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- 1. Read raw body FIRST ---
  // MUST be the first body access. HMAC is computed over the exact bytes Kie.ai
  // sent. Any prior req.json() call would consume the ReadableStream and corrupt
  // HMAC verification. Mirror the Stripe webhook pattern exactly.
  const raw = await req.text();

  // --- 2. Extract HMAC headers ---
  const timestamp = req.headers.get('X-Webhook-Timestamp');
  const signature = req.headers.get('X-Webhook-Signature');

  if (!timestamp || !signature) {
    return NextResponse.json(
      { error: 'Missing webhook signature headers' },
      { status: 400 }
    );
  }

  // --- 2b. Timestamp freshness / replay-window enforcement (CR-03) ---
  // The HMAC signs taskId.timestamp, but the timestamp is otherwise never
  // checked — so a captured (headers + body) callback would replay forever.
  // Reject before signature verification when the signed timestamp is outside
  // the tolerance window (stale) or dated in the future.
  const tsNum = Number(timestamp);
  if (
    !Number.isFinite(tsNum) ||
    Math.abs(Date.now() / 1000 - tsNum) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
  ) {
    return NextResponse.json(
      { error: 'Stale webhook timestamp' },
      { status: 400 }
    );
  }

  // --- 3b. Parse body for taskId (top-level envelope field) ---
  let body: KieCallbackBody & { taskId?: string; code?: number; msg?: string; failMsg?: string };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const taskId = body.taskId;
  if (!taskId || typeof taskId !== 'string') {
    return NextResponse.json(
      { error: 'Missing taskId in callback body' },
      { status: 400 }
    );
  }

  // --- 3c. Get Cloudflare env for secret and D1 ---
  const { env } = await getCloudflareContext({ async: true });

  // --- 3c-i. Debug log (WR-05) — guarded behind an explicit env flag ---
  // The raw body is attacker-influenced (log-injection / data-leak vector), so
  // it must NOT be logged unconditionally in production. Only logged when
  // VIDEO_CALLBACK_DEBUG is set (first-receipt resilience during live testing).
  if ((env as { VIDEO_CALLBACK_DEBUG?: string }).VIDEO_CALLBACK_DEBUG) {
    console.log('[video/callback] raw body:', raw);
  }

  // --- 4. Reject if KIE_WEBHOOK_SECRET is unset (Pitfall 1) ---
  // Never trust an unsigned completion — if the secret is not configured, reject
  // all callbacks until it is set (ASVS V6, T-06-04).
  const secret = env.KIE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 400 }
    );
  }

  // --- 3d. Verify HMAC-SHA256 signature (T-06-04) ---
  const valid = await verifyKieSignature(taskId, timestamp, signature, secret);
  if (!valid) {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  // --- 5. Determine outcome from the AUTHENTICATED provider, not the body (CR-01/WR-03) ---
  // The HMAC only covers `taskId.timestamp` — the body (`data.video_url`,
  // `code`, `failMsg`) is NOT signed and is therefore forgeable/replayable.
  // Treat the verified callback purely as a wake-up: re-fetch the authoritative
  // result from Kie.ai over an authenticated server-to-server GET (API key) and
  // derive the outcome from THAT, never from the unsigned body's video_url/code.
  let outcome: TerminalOutcome;
  try {
    const adapter = createKieAdapter(env.KIE_API_KEY);
    const authoritative = await adapter.getStatus(taskId);
    if (authoritative.status === 'ready' && authoritative.videoUrl) {
      outcome = { status: 'ready', videoUrl: authoritative.videoUrl };
    } else if (authoritative.status === 'failed') {
      outcome = {
        status: 'failed',
        error: authoritative.error ?? 'Provider reported a failed result',
      };
    } else {
      // Authenticated status is still 'processing' (or ready-without-url) — the
      // callback did not confirm a usable terminal result. Do NOT trust the
      // body to fill the gap; leave the job for the poller to reconcile and
      // acknowledge the callback so Kie.ai stops retrying.
      return NextResponse.json({ received: true });
    }
  } catch {
    // getStatus unavailable (network / key issue). Fall back to the unsigned
    // body's dual-parsed video_url ONLY as a degraded last resort (Pitfall 8);
    // applyTerminalResult still re-validates the URL scheme via isSafeHttpUrl.
    const videoUrl = extractKieCallbackVideoUrl(body);
    if (videoUrl) {
      outcome = { status: 'ready', videoUrl };
    } else {
      outcome = {
        status: 'failed',
        error: 'Could not confirm a ready result via authenticated getStatus',
      };
    }
  }

  // --- 6. Idempotent write (T-06-03, VIDEO-02/04) ---
  const db = env.DB as unknown as D1Database;
  const writeResult = await applyTerminalResult(db, taskId, outcome);

  if (!writeResult.applied) {
    // Already terminal — duplicate Kie.ai retry (Pitfall 2). Return 200 no-op
    // so Kie.ai stops retrying. Do NOT rewrite the already-committed result.
    return NextResponse.json({ received: true });
  }

  // --- 7. Return 200 { received: true } — Kie.ai will stop retrying ---
  return NextResponse.json({ received: true });
}
