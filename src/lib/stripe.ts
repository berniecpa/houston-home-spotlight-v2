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

/**
 * Per-key client cache — keyed on the resolved secret key so a rotated or
 * environment-specific key produces a distinct client instead of silently
 * reusing the first one ever passed. The Workers isolate is reused across
 * requests, so caching by key (rather than a bare singleton) prevents a
 * stale/rotated key from continuing to be used.
 */
const _clients = new Map<string, Stripe>();

/**
 * Returns a Workers-safe Stripe instance, cached per secret key.
 *
 * Accepts the secret key as a parameter so callers (route handlers)
 * supply the key from the typed CloudflareEnv binding — the key is
 * never imported at module level, which would prevent tree-shaking
 * and expose it in static analysis. The client is cached keyed on the
 * secret key so a different key (rotation, preview vs. production)
 * always yields a client bound to that exact key.
 *
 * @param secretKey - STRIPE_SECRET_KEY from env.STRIPE_SECRET_KEY
 */
export function getStripe(secretKey: string): Stripe {
  let client = _clients.get(secretKey);
  if (!client) {
    client = new Stripe(secretKey, {
      // Fetch HTTP client is required — Workers runtime does not provide
      // node:https even with nodejs_compat enabled.
      httpClient: Stripe.createFetchHttpClient(),
      // Pin the API version that ships with this SDK version to avoid
      // silent behavior differences between SDK types and Stripe's API.
      apiVersion: '2026-05-27.dahlia',
    });
    _clients.set(secretKey, client);
  }
  return client;
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
