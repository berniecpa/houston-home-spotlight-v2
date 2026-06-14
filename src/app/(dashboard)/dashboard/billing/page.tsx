/**
 * Billing Page — Agent Subscription Dashboard
 *
 * RSC that reads the agent's current subscription state from D1 and renders
 * the BillingWidget with the correct state, grace deadline, and renewal date.
 *
 * Session gate: inherits the (dashboard) layout's session + profile gate.
 * D1 read: parameterized SELECT for the session uid only (T-03-BP-E).
 *
 * force-dynamic: required for per-request D1 reads on the Cloudflare Worker.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   The parent layout.tsx uses it, but Phase 3 routes explicitly omit it.
 *   [CITED: RESEARCH.md Pitfall 4, opennext.js.org/cloudflare]
 *
 * @module app/(dashboard)/dashboard/billing/page
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { getAgentSubscriptionState } from '@/lib/subscription';
import type { SubscriptionStatus } from '@/lib/subscription';
import { BillingWidget } from '@/components/dashboard/BillingWidget';

/**
 * Force per-request dynamic rendering on the Cloudflare Worker.
 * Without this, the D1 subscription read may be skipped during static evaluation.
 * DO NOT add runtime = 'edge' — see module JSDoc above.
 */
export const dynamic = 'force-dynamic';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Billing — Houston Home Spotlight',
};

/** Shape of the D1 subscriptions row for renewal date */
interface SubscriptionRow {
  current_period_end: number | null;
}

/**
 * BillingPage — RSC that reads D1 subscription state and renders BillingWidget.
 *
 * Fail-closed: if the D1 read throws (binding unavailable, D1 outage),
 * the page renders as 'none' state (conservative — agent sees Subscribe CTA
 * rather than incorrect active state). Error is logged for ops visibility.
 *
 * @returns {Promise<JSX.Element>} Billing page with real subscription state
 */
export default async function BillingPage(): Promise<JSX.Element> {
  // --- Read session uid ---
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  // The (dashboard) layout handles the unauthenticated redirect.
  // If tokens is null here, we render a safe default rather than crashing.
  const uid = tokens?.decodedToken?.uid ?? null;
  const isAdminToken = (tokens?.decodedToken as Record<string, unknown> | undefined)?.admin === true;

  // Default state if D1 read fails
  let status: SubscriptionStatus = 'none';
  let graceUntil: number | null = null;
  let isAdmin = isAdminToken;
  let renewalDate: number | null = null;

  if (uid !== null) {
    try {
      const { env } = await getCloudflareContext({ async: true });

      // Read subscription state (status, grace_until, is_admin)
      const agentState = await getAgentSubscriptionState(env.DB, uid);

      if (agentState !== null) {
        status = agentState.subscription_status;
        graceUntil = agentState.subscription_grace_until;
        isAdmin = isAdmin || agentState.is_admin === 1;
      }

      // Read current_period_end from most recent active subscriptions row
      if (!isAdmin && (status === 'active' || status === 'grace')) {
        const subRow = await env.DB
          .prepare(
            `SELECT current_period_end
             FROM subscriptions
             WHERE agent_id = ? AND status IN ('active', 'trialing')
             ORDER BY current_period_end DESC
             LIMIT 1`
          )
          .bind(uid)
          .first<SubscriptionRow>();

        renewalDate = subRow?.current_period_end ?? null;
      }
    } catch (err) {
      // Fail toward 'none' state (conservative) — agent sees Subscribe CTA.
      // Do NOT fail open with isAdmin=true.
      console.error('BillingPage: D1 subscription read error', err);
      // Reset to defaults (already set above)
      status = 'none';
      graceUntil = null;
      isAdmin = isAdminToken; // preserve token-level admin claim
      renewalDate = null;
    }
  }

  return (
    <BillingWidget
      status={status}
      graceUntil={graceUntil}
      isAdmin={isAdmin}
      renewalDate={renewalDate}
    />
  );
}
