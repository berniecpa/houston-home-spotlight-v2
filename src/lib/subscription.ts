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
  /** Current tier ('starter'|'pro'|'team') or null (none/legacy/admin) */
  subscription_tier: string | null;
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
 *
 * NOTE: AGENT_PUBLISHABLE_SQL is the subscription-only gate used for
 * create-listing eligibility. For PUBLIC VISIBILITY (browse, detail, leads),
 * use AGENT_VISIBLE_SQL which also enforces is_suspended = 0 (Phase 5).
 */
export const AGENT_PUBLISHABLE_SQL = `(
  a.is_admin = 1
  OR a.subscription_status = 'active'
  OR (a.subscription_status = 'grace' AND a.subscription_grace_until > unixepoch())
)`;

/**
 * SQL WHERE fragment for Phase 5 public-visibility gate.
 *
 * Composes the Phase 3 subscription publishability gate with the Phase 5
 * suspension check. A listing is publicly visible only when BOTH conditions
 * are met:
 *   1. The owning agent's subscription is publishable (AGENT_PUBLISHABLE_SQL).
 *   2. The owning agent is NOT suspended (a.is_suspended = 0).
 *
 * This is the authoritative gate for ALL public listing reads:
 *   - getAllListings (browse page)
 *   - getListingBySlug (detail page)
 *   - /api/leads listing-lookup (buyer inquiry — WR-05)
 *
 * AGENT_PUBLISHABLE_SQL remains the eligibility gate for create-listing
 * (subscription check only; a suspended agent cannot create anyway via
 * the separate is_suspended → 403 mutation guard).
 *
 * Requires agents table aliased as `a` in the JOIN.
 *
 * Example:
 *   SELECT l.* FROM listings l
 *   JOIN agents a ON l.agent_id = a.id
 *   WHERE l.status = 'active'
 *     AND ${AGENT_VISIBLE_SQL}
 */
export const AGENT_VISIBLE_SQL = `(${AGENT_PUBLISHABLE_SQL}) AND a.is_suspended = 0`;

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
      `SELECT subscription_status, subscription_grace_until, is_admin, subscription_tier
       FROM agents WHERE id = ?`
    )
    .bind(uid)
    .first<AgentSubscriptionState>();
}
