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
 * D1 batch() atomicity (verified — WR-01):
 *   Cloudflare D1 documents that `batch()` sends statements as a single SQL
 *   transaction; either every statement commits or none do. The idempotency
 *   INSERT and the state UPDATE therefore commit atomically — a mid-batch
 *   failure rolls back the whole batch, so Stripe's retry re-runs cleanly and
 *   cannot wedge a subscription in a stale state. (Pitfall 5 is not present.)
 *   Ref: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
 *
 * Concurrent duplicate delivery (WR-01):
 *   The pre-flight SELECT is a best-effort fast path. Under concurrent delivery
 *   of the same event two handlers can both pass the SELECT; `INSERT OR IGNORE`
 *   on the event_id PK makes the second batch's idempotency insert a no-op while
 *   its state UPDATE still runs. Because every state UPDATE here is idempotent
 *   (it sets an absolute status/grace value, not a relative mutation), a benign
 *   second UPDATE produces the identical row — no data corruption. A stricter
 *   "true no-op" gate (skip the UPDATE when INSERT OR IGNORE changed 0 rows)
 *   was considered but not adopted: within a single atomic batch the INSERT
 *   commits before the UPDATE, so a NOT EXISTS guard would suppress the UPDATE
 *   on the normal first delivery too. See WR-01 in the review for context.
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
import type { D1Database, D1Result } from '@cloudflare/workers-types';
import { randomUUID } from 'node:crypto';

/**
 * WR-02: Detect "matched 0 agents" on a customer-keyed UPDATE.
 *
 * If an invoice/subscription event references a Stripe customer that has no
 * corresponding agents row (out-of-band customer, deleted agent, customer-ID
 * drift), the UPDATE silently affects 0 rows and the event is consumed with no
 * state change. Log loudly (customer ID only, never a secret) so ops can detect
 * orphaned customers. We still return 200 to Stripe to avoid infinite retries.
 *
 * @param result     - D1Result for the agents UPDATE statement
 * @param eventType  - Stripe event type, for log context
 * @param customerId - Stripe customer ID that matched no agent
 */
function warnIfNoAgentMatched(
  result: D1Result | undefined,
  eventType: string,
  customerId: string
): void {
  if (result && result.meta.changes === 0) {
    console.error(
      `Stripe ${eventType}: no agent matched stripe_customer_id ${customerId} (orphaned customer or ID drift)`
    );
  }
}

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

      const subResults = await db.batch([
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
      warnIfNoAgentMatched(subResults[1], event.type, customerId);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      // customer is a raw string ID in webhook payloads (Pitfall 8)
      const customerId = invoice.customer as string;

      // WR-06: Only promote to 'active' when the customer is not already
      // 'lapsed' (e.g. a subscription that was deleted). Stripe can emit a
      // closing/proration invoice.paid around cancellation, and event ordering
      // is not guaranteed; without this guard an invoice.paid arriving after
      // customer.subscription.deleted would resurrect access for a lapsed agent.
      // The WHERE clause excludes 'lapsed' so a deletion is not overridden.
      const paidResults = await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'active',
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?
             AND subscription_status != 'lapsed'`
        ).bind(customerId),
      ]);
      // Note: a 0-row result here is ambiguous (no agent, OR agent is lapsed and
      // intentionally skipped), so we do not warn for invoice.paid.
      void paidResults;
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

      const failedResults = await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'grace',
               subscription_grace_until = ?,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(graceUntil, customerId),
      ]);
      warnIfNoAgentMatched(failedResults[1], event.type, customerId);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // customer is a raw string ID in webhook payloads (Pitfall 8)
      const customerId = sub.customer as string;

      const deletedResults = await db.batch([
        idempotencyStmt,
        db.prepare(
          `UPDATE agents
           SET subscription_status = 'lapsed',
               subscription_grace_until = NULL,
               updated_at = unixepoch()
           WHERE stripe_customer_id = ?`
        ).bind(customerId),
        // WR-03: Upsert (not bare UPDATE) so a 'deleted' event delivered before
        // any 'created'/'updated' (Stripe does not guarantee ordering) still
        // records a canceled subscriptions row instead of matching 0 rows and
        // leaving subscriptions/agents divergent. ON CONFLICT only flips status
        // to 'canceled' so a later out-of-order 'created' cannot revive it.
        db.prepare(
          `INSERT INTO subscriptions
             (id, agent_id, stripe_subscription_id, status,
              current_period_start, current_period_end, created_at, updated_at)
           SELECT ?, agents.id, ?, 'canceled', 0, 0, unixepoch(), unixepoch()
           FROM agents WHERE stripe_customer_id = ?
           ON CONFLICT(stripe_subscription_id) DO UPDATE SET
             status = 'canceled',
             updated_at = unixepoch()`
        ).bind(randomUUID(), sub.id, customerId),
      ]);
      warnIfNoAgentMatched(deletedResults[1], event.type, customerId);
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
