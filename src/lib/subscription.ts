/**
 * Subscription status helper, SQL gate fragment, and D1 accessor.
 *
 * Provides the core logic that determines whether an agent is allowed to
 * publish listings, with admin bypass and 7-day grace period support.
 *
 * Usage:
 *   - `isAgentPublishable` is consumed by the billing dashboard widget (Phase 3)
 *     to show current subscription status.
 *   - `AGENT_PUBLISHABLE_SQL` is DEFINED here and APPLIED to public listing
 *     queries in Phase 4 (listings don't exist as D1 rows until then).
 *   - `getAgentSubscriptionState` fetches the D1 agents row data for status checks.
 *
 * Grace period: 7 days (604800 seconds) from `invoice.payment_failed` webhook.
 * Grace timing is enforced in epoch SECONDS (unixepoch() in SQL, Math.floor(Date.now()/1000)
 * in TypeScript) — never milliseconds. See RESEARCH.md Pitfall 6.
 *
 * Admin bypass: Bernard's account has `is_admin=1` on the D1 agents row.
 * Admins are always publishable; no Stripe customer is ever created for them.
 * [CONTEXT.md Admin billing decision]
 *
 * @module lib/subscription
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Valid `subscription_status` values stored on the D1 `agents` table.
 *
 * - `none`   — default; agent has never subscribed
 * - `active` — current, paid subscription
 * - `grace`  — payment failed; within the 7-day grace window (subscription_grace_until > now)
 * - `lapsed` — subscription canceled or grace period expired
 */
export type SubscriptionStatus = 'none' | 'active' | 'grace' | 'lapsed';

/**
 * Shape of the D1 agents row fields needed for publishability checks.
 * Returned by `getAgentSubscriptionState`.
 */
export interface AgentSubscriptionState {
  /** Current subscription status from D1 agents.subscription_status */
  subscription_status: SubscriptionStatus;
  /** Epoch seconds when the grace period expires; null unless status is 'grace' */
  subscription_grace_until: number | null;
  /** 1 if Bernard's admin account; 0 otherwise */
  is_admin: number;
}

/**
 * Returns true if the agent is allowed to publish listings.
 *
 * Decision logic:
 *   1. Admin (is_admin=1): always publishable — no subscription required.
 *   2. active: publishable.
 *   3. grace + future grace_until: publishable.
 *   4. grace + expired / null grace_until, none, lapsed: not publishable.
 *
 * Epoch comparison uses seconds (Math.floor(Date.now()/1000)) to match
 * D1's unixepoch() which also returns seconds. See RESEARCH.md Pitfall 6.
 *
 * @param agent - Subscription state from D1 agents row
 */
export function isAgentPublishable(agent: AgentSubscriptionState): boolean {
  // Admin bypass — Bernard never sees the paywall
  if (agent.is_admin === 1) return true;
  // Active subscription — fully paid
  if (agent.subscription_status === 'active') return true;
  // Grace period — payment failed but still within the 7-day window
  if (
    agent.subscription_status === 'grace' &&
    agent.subscription_grace_until !== null &&
    // Compare in epoch SECONDS — Date.now() / 1000, not Date.now()
    Math.floor(Date.now() / 1000) < agent.subscription_grace_until
  ) {
    return true;
  }
  return false;
}

/**
 * SQL WHERE fragment for Phase 4 public listing queries.
 *
 * Embed in any SELECT that JOINs the agents table aliased as `a`.
 * Mirrors the TypeScript isAgentPublishable logic for consistent enforcement.
 *
 * DEFINED here; APPLIED in Phase 4 listing queries (listings don't exist
 * as D1 rows until Phase 4 — applying the gate is out of scope for Phase 3).
 *
 * Example:
 *   SELECT l.* FROM listings l
 *   JOIN agents a ON l.agent_id = a.id
 *   WHERE l.status = 'active'
 *     AND (${AGENT_PUBLISHABLE_SQL})
 *
 * unixepoch() returns current time in epoch seconds — the same unit as
 * subscription_grace_until stored in D1 (epoch seconds, not ms).
 */
export const AGENT_PUBLISHABLE_SQL = `(
  a.is_admin = 1
  OR a.subscription_status = 'active'
  OR (a.subscription_status = 'grace' AND a.subscription_grace_until > unixepoch())
)`;

/**
 * Fetches subscription state fields for a single agent from D1.
 *
 * Returns null if no agent row is found for the given uid.
 *
 * @param db  - D1Database binding from Cloudflare Worker env
 * @param uid - Firebase UID (agents.id)
 */
export async function getAgentSubscriptionState(
  db: D1Database,
  uid: string
): Promise<AgentSubscriptionState | null> {
  return db
    .prepare(
      `SELECT subscription_status, subscription_grace_until, is_admin
       FROM agents WHERE id = ?`
    )
    .bind(uid)
    .first<AgentSubscriptionState>();
}
