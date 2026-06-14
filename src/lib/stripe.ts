/**
 * Stripe client factory for Cloudflare Workers runtime.
 *
 * REQUIRED: httpClient: Stripe.createFetchHttpClient()
 *   Workers does not provide node:https even with nodejs_compat.
 *   The Fetch HTTP client uses globalThis.fetch() instead.
 *   [CITED: opennext.js.org/cloudflare/howtos/stripeAPI]
 *
 * REQUIRED: explicit apiVersion
 *   Pin to the SDK's bundled version to avoid type/Dashboard mismatches.
 *   stripe@22.2.1 pins to '2026-05-27.dahlia'.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration
 *   and silently ignores it. Omitting this export avoids breakage on adapter
 *   version upgrades when edge runtime support is properly enforced.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/stripe
 */

import Stripe from 'stripe';

/** Module-level singleton — initialized once per Worker instance. */
let _stripe: Stripe | null = null;

/**
 * Returns a Workers-safe Stripe instance, lazily initialized.
 *
 * Accepts the secret key as a parameter so callers (route handlers)
 * supply the key from the typed CloudflareEnv binding — the key is
 * never imported at module level, which would prevent tree-shaking
 * and expose it in static analysis.
 *
 * @param secretKey - STRIPE_SECRET_KEY from env.STRIPE_SECRET_KEY
 */
export function getStripe(secretKey: string): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      // Fetch HTTP client is required — Workers runtime does not provide
      // node:https even with nodejs_compat enabled.
      httpClient: Stripe.createFetchHttpClient(),
      // Pin the API version that ships with this SDK version to avoid
      // silent behavior differences between SDK types and Stripe's API.
      apiVersion: '2026-05-27.dahlia',
    });
  }
  return _stripe;
}

/**
 * Reusable SubtleCryptoProvider for webhook signature verification.
 *
 * Uses Web Crypto API (crypto.subtle) which is available in the Workers
 * runtime. The synchronous constructEvent uses node:crypto.timingSafeEqual
 * which is NOT available in Workers — always use constructEventAsync with
 * this provider.
 *
 * [CITED: jross.me/verifying-stripe-webhook-signatures-cloudflare-workers]
 */
export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
