/**
 * Stripe Checkout Session Creation Route
 *
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the $79/mo subscription.
 * On success, returns { success: true, url } — the caller redirects the
 * browser to the Stripe-hosted Checkout page.
 *
 * Security:
 *   - T-03-CO-E: uid derived from session cookie (getTokens) — never from body
 *   - T-03-CO-E: admin tokens (decodedToken.admin) are blocked with 403 BEFORE
 *     any Stripe API call — Bernard does not subscribe (no customer created)
 *   - T-03-SQLI: all D1 queries use prepare().bind() — no string concatenation
 *
 * Stripe customer lifecycle:
 *   - If the agent row already has a stripe_customer_id, the existing customer
 *     is reused (idempotent — no duplicate Stripe customers per agent).
 *   - If not, a new Stripe customer is created and the ID is persisted to D1.
 *
 * Session shape (BILL-01):
 *   - mode: 'subscription'
 *   - line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]
 *   - client_reference_id: uid (webhook mapping fallback)
 *   - success_url + cancel_url → /dashboard/billing
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   Omitting this export prevents breakage on adapter version upgrades.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module app/api/stripe/checkout/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { getStripe } from '@/lib/stripe';
import { isValidPriceId } from '@/lib/pricing';

/**
 * POST handler — creates a Stripe Checkout session for the agent subscription.
 *
 * Returns { success: true, url } with the Stripe-hosted Checkout URL.
 * The caller (dashboard billing page) redirects the browser to that URL.
 *
 * @param req - Incoming POST request (body not parsed — uid from session only)
 * @returns {Promise<NextResponse>} { success: boolean, url?: string, message?: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // --- 1. Session authentication (T-03-CO-E: uid from session, not body) ---
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);

    if (!tokens) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // --- 2. Admin block (T-03-CO-E: must happen BEFORE any Stripe call) ---
    // Bernard (admin claim = true) never subscribes. No Stripe customer is ever
    // created for admin accounts. Return 403 without touching Stripe API.
    if (tokens.decodedToken.admin) {
      return NextResponse.json(
        { success: false, message: 'Admins do not require a subscription' },
        { status: 403 }
      );
    }

    const uid = tokens.decodedToken.uid;

    // --- 2b. Validate the requested plan price (never trust an arbitrary price) ---
    // The client sends a Stripe priceId; it MUST be one of our known tier prices.
    let priceId: string;
    try {
      const body = (await req.json()) as { priceId?: unknown };
      if (typeof body?.priceId !== 'string' || !isValidPriceId(body.priceId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid or missing plan selection.' },
          { status: 400 }
        );
      }
      priceId = body.priceId;
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    // --- 3. Fetch agent row from D1 (T-03-SQLI: parameterized) ---
    const agent = await env.DB.prepare(
      'SELECT stripe_customer_id, email FROM agents WHERE id = ?'
    )
      .bind(uid)
      .first<{ stripe_customer_id: string | null; email: string }>();

    if (!agent) {
      return NextResponse.json(
        { success: false, message: 'Agent record not found' },
        { status: 404 }
      );
    }

    const stripe = getStripe(env.STRIPE_SECRET_KEY);

    // --- 4. Create Stripe customer if not yet mapped ---
    // Reuse existing customer to prevent duplicate Stripe customers per agent.
    let customerId = agent.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: agent.email,
        metadata: { agent_uid: uid },
      });
      customerId = customer.id;
      // Persist the new customer ID back to D1 (T-03-SQLI: parameterized)
      const persistResult = await env.DB.prepare(
        'UPDATE agents SET stripe_customer_id = ?, updated_at = unixepoch() WHERE id = ?'
      )
        .bind(customerId, uid)
        .run();
      // WR-04: If the UPDATE matched no row (agent deleted between SELECT and
      // UPDATE) or failed silently, the Stripe customer we just created is now
      // orphaned (not persisted). Log the customer ID so it can be reconciled;
      // client_reference_id (set below) lets the webhook recover the mapping.
      if (persistResult.meta.changes !== 1) {
        console.error(
          `Orphaned Stripe customer: created ${customerId} for agent ${uid} but persist UPDATE changed ${persistResult.meta.changes} rows`
        );
      }
    }

    // --- 5. Create Checkout session (subscription mode, $79/mo) ---
    const baseUrl = new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // client_reference_id: belt-and-suspenders fallback for webhook → agent mapping.
      // Primary mapping is via agents.stripe_customer_id which is set above.
      client_reference_id: uid,
      success_url: `${baseUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${baseUrl}/dashboard/billing?checkout=cancel`,
    });

    // WR-05: session.url is typed `string | null`. Returning a null URL would
    // make the client navigate to the string "null" (a 404) with no error,
    // since res.ok is true. Guard explicitly.
    if (!session.url) {
      console.error(`Checkout session ${session.id} created with no URL for agent ${uid}`);
      return NextResponse.json(
        { success: false, message: 'Checkout session has no URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    console.error('POST /api/stripe/checkout error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
