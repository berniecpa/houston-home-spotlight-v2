/**
 * Stripe Webhook Handler
 *
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events, verifies the HMAC-SHA256 signature, and
 * delegates to handleStripeEvent for subscription state updates in D1.
 *
 * Security (T-03-WH-S: Spoofing):
 *   - Raw body is read as text FIRST (const body = await req.text()) — this is
 *     the literal first statement of the handler. Any prior body consumption
 *     (req.json()) would corrupt HMAC verification (RESEARCH Pitfall 1).
 *   - constructEventAsync verifies the stripe-signature header via HMAC-SHA256.
 *     The synchronous constructEvent uses node:crypto.timingSafeEqual which is
 *     unavailable in Workers runtime (RESEARCH Pitfall 2).
 *   - stripeCryptoProvider (SubtleCryptoProvider) uses crypto.subtle.verify —
 *     available in all Workers/edge environments.
 *
 * Security (T-03-WH-T: Replay):
 *   - Stripe embeds a timestamp in the signature header; constructEventAsync
 *     enforces a 300-second tolerance by default (4th arg = undefined).
 *   - stripe_events table (event_id PK) ensures each event is processed once.
 *
 * Middleware exemption (RESEARCH Pattern 7):
 *   - The middleware matcher covers only ['/dashboard/:path*', '/admin/:path*'].
 *   - /api/stripe/webhook is intentionally public — Stripe calls server-to-server
 *     with NO __session cookie. Do NOT add /api/* to the middleware matcher.
 *   - middleware.ts is NOT modified by this plan. The current matcher is confirmed:
 *     export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] }
 *
 * Error handling:
 *   - Missing stripe-signature header → 400 (reject before any processing)
 *   - Signature verification failure → 400 (HMAC mismatch or expired timestamp)
 *   - handleStripeEvent throws → 500 (Stripe retries; idempotency record not committed)
 *   - Success → 200 { received: true }
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module app/api/stripe/webhook/route
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Stripe as StripeType } from 'stripe';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getStripe, stripeCryptoProvider } from '@/lib/stripe';
import { handleStripeEvent } from '@/lib/stripe-events';

/**
 * POST handler — verifies Stripe webhook signature and routes to state machine.
 *
 * The LITERAL FIRST statement of this handler is `const body = await req.text()`.
 * This is mandatory: consuming the request stream via req.json() first would
 * result in constructEventAsync receiving an empty body, causing HMAC mismatch.
 * [CITED: jross.me/verifying-stripe-webhook-signatures-cloudflare-workers]
 *
 * @param req - Raw incoming POST request from Stripe (no session cookie)
 * @returns {Promise<NextResponse>} 400 | 200 | 500
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- 1. Read raw body FIRST ---
  // MUST be the first body access. stripe.webhooks.constructEventAsync verifies
  // the HMAC over the exact bytes Stripe sent. If req.json() is called first,
  // the ReadableStream is consumed and constructEventAsync receives empty bytes.
  // [CITED: jross.me/verifying-stripe-webhook-signatures-cloudflare-workers]
  const body = await req.text();

  // --- 2. Validate stripe-signature header (T-03-WH-S) ---
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature' },
      { status: 400 }
    );
  }

  const { env } = await getCloudflareContext({ async: true });

  // --- 3. Verify HMAC signature (async — Workers-safe) ---
  // constructEventAsync uses Web Crypto API (crypto.subtle.verify) via the
  // SubtleCryptoProvider. The synchronous constructEvent uses
  // node:crypto.timingSafeEqual which is unavailable in Workers runtime.
  // 4th arg = undefined uses the default 300-second timestamp tolerance.
  let event: StripeType.Event;
  try {
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,           // tolerance: default 300 seconds
      stripeCryptoProvider // REQUIRED: SubtleCryptoProvider for Workers (Pitfall 2)
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // --- 4. Route to state machine (BILL-03, BILL-05) ---
  try {
    await handleStripeEvent(event, env.DB);
  } catch (err) {
    // Return 500 so Stripe retries. The idempotency batch is atomic — if the
    // handler throws before the batch commits, the event_id is NOT recorded
    // and Stripe will retry successfully. (RESEARCH Pitfall 5)
    console.error(`Webhook handler error for ${event.type} (${event.id}):`, err);
    return NextResponse.json(
      { error: 'Handler failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
