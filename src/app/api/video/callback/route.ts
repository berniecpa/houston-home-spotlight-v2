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
} from '@/lib/video/kie-adapter';
import type { KieCallbackBody } from '@/lib/video/kie-adapter';
import { applyTerminalResult } from '@/lib/video/jobs';
import type { TerminalOutcome } from '@/lib/video/jobs';

/**
 * POST handler — receive and process Kie.ai job completion callback.
 *
 * 1. Read raw body FIRST (HMAC integrity requirement).
 * 2. Log raw body once (first-receipt resilience — confirms Kling 2.6 shape).
 * 3. Verify HMAC signature (T-06-04): reject 400 on missing headers or bad sig.
 * 4. Reject 400 if KIE_WEBHOOK_SECRET is unset (Pitfall 1 — never trust unsigned).
 * 5. Determine outcome: code===200 → ready (dual-parse videoUrl); else → failed.
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

  // --- 2. First-receipt resilience (Open Question 1 / Pitfall 8) ---
  // Log the raw body once so the actual Kling 2.6 callback shape can be
  // confirmed during deferred live testing. Remove or guard behind a flag
  // after the first successful live callback is observed.
  console.log('[video/callback] raw body:', raw);

  // --- 3a. Extract HMAC headers ---
  const timestamp = req.headers.get('X-Webhook-Timestamp');
  const signature = req.headers.get('X-Webhook-Signature');

  if (!timestamp || !signature) {
    return NextResponse.json(
      { error: 'Missing webhook signature headers' },
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

  // --- 5. Determine outcome from body ---
  // code === 200 indicates success per Kie.ai market endpoint envelope.
  // Any other code indicates failure (capture error message).
  let outcome: TerminalOutcome;
  if (body.code === 200) {
    // Dual-parse video URL (Pitfall 8): data.video_url first, then resultJson.resultUrls[0]
    const videoUrl = extractKieCallbackVideoUrl(body);
    if (videoUrl) {
      outcome = { status: 'ready', videoUrl };
    } else {
      // code=200 but no extractable video URL — treat as failure
      outcome = { status: 'failed', error: 'Provider returned success with no video URL' };
    }
  } else {
    // Non-200 code — failure path; capture the error message
    const errorMsg = body.failMsg ?? body.msg ?? `Provider error code ${body.code ?? 'unknown'}`;
    outcome = { status: 'failed', error: errorMsg };
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
