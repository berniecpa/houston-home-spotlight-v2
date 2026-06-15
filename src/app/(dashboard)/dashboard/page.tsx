/**
 * Dashboard Index Page (/dashboard)
 *
 * RSC that reads the agent's profile from D1 and renders the WelcomeCard.
 * The parent layout has already gated authentication and redirected incomplete
 * profiles — this page only renders when authenticated (profile may or may not
 * be complete depending on layout gate state).
 *
 * Data flow: getTokens -> D1 SELECT agent -> WelcomeCard with agent
 *
 * Per UI-SPEC /dashboard page spec.
 *
 * @module app/(dashboard)/dashboard/page
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import type { AgentProfileFields } from '@/lib/profile';

/**
 * Force per-request dynamic rendering on the Cloudflare Worker (CR-02) so the
 * cookie/D1 reads run in the worker binding context, not at static eval time.
 *
 * No `runtime = 'edge'`: @opennextjs/cloudflare runs pages on the Node.js
 * runtime (workerd) and rejects edge-runtime pages.
 */
export const dynamic = 'force-dynamic';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Dashboard — Houston Home Spotlight',
};

/** Full agent row for dashboard display */
interface AgentRow extends AgentProfileFields {
  display_name: string | null;
}

/**
 * DashboardPage — welcome card with profile progress and CTA.
 *
 * Reads agent row from D1 (already authenticated by parent layout gate).
 * Falls back to empty agent if D1 read fails (development environment).
 *
 * @returns {Promise<JSX.Element>} Dashboard home with WelcomeCard
 */
export default async function DashboardPage(): Promise<JSX.Element> {
  // Read agent row from D1 (uid already validated in layout)
  let agent: AgentRow = {
    display_name: null,
    photo_url: null,
    phone: null,
    brokerage: null,
    license_number: null,
  };

  try {
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);

    if (tokens) {
      const { env } = await getCloudflareContext({ async: true });
      const row = await env.DB.prepare(
        `SELECT display_name, photo_url, phone, brokerage, license_number
         FROM agents WHERE id = ?`
      )
        .bind(tokens.decodedToken.uid)
        .first<AgentRow>();

      if (row) {
        agent = row;
      }
    }
  } catch (err) {
    // WR-05: in production a D1 read failure must not masquerade as an empty
    // profile (which could prompt the user to re-save and overwrite good data).
    // Re-throw so the Next.js error boundary handles it; only swallow locally
    // where the Cloudflare binding is legitimately unavailable (next dev).
    console.error('DashboardPage: D1 agent read error', err);
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
  }

  return (
    <div className="max-w-2xl">
      <WelcomeCard agent={agent} />
    </div>
  );
}
