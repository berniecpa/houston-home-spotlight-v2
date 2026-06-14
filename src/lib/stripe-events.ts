/**
 * Stripe event state machine for subscription status management.
 *
 * Handles 5 Stripe webhook events and writes subscription state atomically
 * to the D1 database. Idempotency is enforced via the stripe_events table
 * (event_id PRIMARY KEY + INSERT OR IGNORE).
 *
 * Events handled:
 *   - customer.subscription.created  → agents.subscription_status = 'active'
 *   - customer.subscription.updated  → 'active' (if active) or 'lapsed' (other)
 *   - invoice.paid                   → 'active', clears grace
 *   - invoice.payment_failed         → 'grace', sets subscription_grace_until = now + 7 days
 *   - customer.subscription.deleted  → 'lapsed', marks subscriptions.status = 'canceled'
 *
 * Idempotency:
 *   - Pre-flight SELECT 1 FROM stripe_events WHERE event_id = ? guards against
 *     duplicate processing on Stripe retries.
 *   - The idempotency INSERT and the state UPDATE are submitted as a single
 *     db.batch([...]) call so they commit atomically.
 *
 * @note Assumption A3: D1 batch([]) is treated as atomic (all commit or none).
 *   If Cloudflare docs confirm it is NOT atomic, the idempotency-before-state
 *   ordering issue (RESEARCH Pitfall 5) would be re-introduced. Verify against
 *   https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
 *
 * Epoch seconds:
 *   - D1 stores subscription_grace_until as INTEGER epoch SECONDS.
 *   - Math.floor(Date.now() / 1000) is used — never raw Date.now() (ms).
 *   - RESEARCH Pitfall 6: Date.now() + 604800 would write ~30 years in the future.
 *
 * Customer ID (Pitfall 8):
 *   - Stripe webhook payloads always contain customer as a raw string ID.
 *   - Never call `.id` on it — the type annotation is `string | Customer` but
 *     expanded objects only appear when events are fetched with expand params.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/stripe-events
 */

import type { Stripe } from 'stripe';
import type { D1Database } from '@cloudflare/workers-types';
import { randomUUID } from 'node:crypto';

/**
 * Handles a verified Stripe webhook event by updating subscription state in D1.
 *
 * Idempotent: if the event_id has already been processed (exists in stripe_events),
 * this function returns immediately without making any D1 writes.
 *
 * @param event - Verified Stripe.Event object from constructEventAsync
 * @param db    - D1Database binding from the Cloudflare Workers env
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  db: D1Database
): Promise<void> {
  // --- Idempotency pre-flight check ---
  // Non-atomic read before the batch write. If the batch later fails (e.g., network
  // error), the event_id won't be in stripe_events, and Stripe will retry cleanly.
  const existing = await db
    .prepare('SELECT 1 FROM stripe_events WHERE event_id = ?')
    .bind(event.id)
    .first();

  if (existing) {
    // Duplicate event — already processed. No-op to satisfy BILL-05.
    return;
  }

  // Idempotency statement: included in every batch below.
  // INSERT OR IGNORE: if a race condition causes two concurrent handlers to
  // pass the pre-flight check, only one batch will succeed due to the PK constraint.
  const idempotencyStmt = db
    .prepare(
      'INSERT OR IGNORE INTO stripe_events (event_id, processed_at) VALUES (?, unixepoch())'
    )
    .bind(event.id);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      // customer is a raw string ID in webhook payloads (Pitfall 8)
      const customerId = sub.customer as string;
      // Map only 'active' to active; all other statuses (past_due, incomplete, etc.) → lapsed
      const status = sub.status === 'active' ? 'active' : 'lapsed';
      // On the pinned API version (2026-05-27.dahlia, Basil-era), current_period_start /
      // current_period_end live on each subscription ITEM, not on the Subscription object.
      // Verified against node_modules/stripe (22.2.1):
      //   - SubscriptionItem.current_period_end / current_period_start are `number` (non-optional)
      //   - Subscription has no such fields (only list-query filters reference the names)
      // Read from the first item. If absent, leave the persisted value untouched via
      // COALESCE in the ON CONFLICT update (do NOT overwrite a good value with 0).
      const item = sub.items?.data?.[0];
      const periodEnd = item?.current_period_end ?? 0;
      const periodStart = item?.current_period_start ?? 0;

      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = ?,
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(status, customerId),
        // Upsert the subscriptions row using ON CONFLICT to handle updates.
        // Uses crypto.randomUUID() for the PK on INSERT per plan spec.
        db.prepare(
          `INSERT INTO subscriptions
             (id, agent_id, stripe_subscription_id, status,
              current_period_start, current_period_end, created_at, updated_at)
           SELECT ?, agents.id, ?, ?, ?, ?, unixepoch(), unixepoch()
           FROM agents WHERE stripe_customer_id = ?
           ON CONFLICT(stripe_subscription_id) DO UPDATE SET
             status = excluded.status,
             -- Only overwrite the period boundary when we actually resolved a
             -- non-zero value from the subscription item; otherwise keep the
             -- previously-persisted (correct) value rather than zeroing it.
             current_period_start = CASE WHEN excluded.current_period_start > 0
               THEN excluded.current_period_start ELSE current_period_start END,
             current_period_end = CASE WHEN excluded.current_period_end > 0
               THEN excluded.current_period_end ELSE current_period_end END,
             updated_at = unixepoch()`
        ).bind(
          randomUUID(),
          sub.id,
          sub.status,
          periodStart,
          periodEnd,
          customerId
        ),
      ]);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      // customer is a raw string ID in webhook payloads (Pitfall 8)
      const customerId = invoice.customer as string;

      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'active',
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(customerId),
      ]);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      // customer is a raw string ID in webhook payloads (Pitfall 8)
      const customerId = invoice.customer as string;
      // grace_until = current time in epoch SECONDS + 7 days (604800 seconds)
      // CRITICAL: Math.floor(Date.now() / 1000) — NOT Date.now() (milliseconds)
      // Raw Date.now() + 604800 would set grace ~30 years in the future (Pitfall 6)
      const graceUntil = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'grace',
               subscription_grace_until = ?,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(graceUntil, customerId),
      ]);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // customer is a raw string ID in webhook payloads (Pitfall 8)
      const customerId = sub.customer as string;

      await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'lapsed',
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(customerId),
        db.prepare(
          `UPDATE subscriptions
           SET status = 'canceled',
               updated_at = unixepoch()
           WHERE stripe_subscription_id = ?`
        ).bind(sub.id),
      ]);
      break;
    }

    default:
      // Unhandled event type — record idempotency only, no state change.
      // This prevents repeated processing if a new event type is sent
      // before the switch statement is updated.
      await idempotencyStmt.run();
      break;
  }
}
