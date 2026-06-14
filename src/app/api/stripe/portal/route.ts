/**
 * Stripe Customer Portal Session Creation Route
 *
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the agent can self-manage their
 * subscription (update payment method, cancel, view invoices).
 * On success, returns { success: true, url } — the caller redirects the
 * browser to the Stripe-hosted Portal page.
 *
 * Security:
 *   - T-03-PO-E: uid derived from session cookie (getTokens) — no anonymous access
 *   - T-03-PO-E: stripe_customer_id resolved strictly from the session uid's D1 row —
 *     no cross-agent portal access possible
 *   - T-03-SQLI: D1 query uses prepare().bind() — no string concatenation
 *
 * Prerequisites (RESEARCH Pitfall 7):
 *   - The Stripe Customer Portal MUST be configured and enabled in the Stripe
 *     Dashboard (Billing → Customer Portal) before this route can return sessions.
 *     Without Portal configuration, Stripe returns 400:
 *     "No configuration provided and your test mode account does not have a default configuration."
 *
 * Returns:
 *   - 401: missing session cookie
 *   - 404: agent has no stripe_customer_id (has not subscribed yet)
 *   - 200: { success: true, url } — Stripe Portal URL
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module app/api/stripe/portal/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { getStripe } from '@/lib/stripe';

/**
 * POST handler — creates a Stripe Customer Portal session for the agent.
 *
 * Returns { success: true, url } with the Stripe-hosted Portal URL.
 * The caller (dashboard billing page) redirects the browser to that URL.
 *
 * @param req - Incoming POST request (body not read — uid from session only)
 * @returns {Promise<NextResponse>} { success: boolean, url?: string, message?: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // --- 1. Session authentication (T-03-PO-E: uid from session, not body) ---
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);

    if (!tokens) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const uid = tokens.decodedToken.uid;
    const { env } = await getCloudflareContext({ async: true });

    // --- 2. Fetch agent's Stripe customer ID from D1 (T-03-SQLI: parameterized) ---
    // Resolves strictly from the session uid — prevents cross-agent portal access.
    const agent = await env.DB.prepare(
      'SELECT stripe_customer_id FROM agents WHERE id = ?'
    )
      .bind(uid)
      .first<{ stripe_customer_id: string | null }>();

    if (!agent?.stripe_customer_id) {
      return NextResponse.json(
        {
          success: false,
          message: 'No billing account found. Please subscribe first.',
        },
        { status: 404 }
      );
    }

    // --- 3. Create Customer Portal session ---
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    const baseUrl = new URL(req.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: agent.stripe_customer_id,
      // return_url: where the browser lands after the agent closes the Portal
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return NextResponse.json({ success: true, url: portalSession.url });
  } catch (err) {
    console.error('POST /api/stripe/portal error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to open billing portal' },
      { status: 500 }
    );
  }
}
