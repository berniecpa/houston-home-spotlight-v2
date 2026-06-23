/**
 * Listings Dashboard Page — Agent listing management RSC shell
 *
 * force-dynamic RSC: reads session cookie + D1 on every request.
 * Loads the calling agent's own listings (scoped by agent_id, LIST-08) and
 * renders the client <ListingsManager /> component which handles all mutations.
 *
 * Note: No runtime='edge' export on this page per autonomous directive.
 * The parent layout.tsx already sets runtime='edge' for the dashboard group.
 * This page uses force-dynamic to ensure per-request D1 reads.
 *
 * Security (T-04-17 mitigation):
 *   D1 SELECT scoped WHERE agent_id = session uid — never returns other agents' listings.
 *   uid always from getTokens (session cookie); never from query params or request body.
 *
 * @module app/(dashboard)/dashboard/listings/page
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { getAgentSubscriptionState } from '@/lib/subscription';
import { limitsForTier } from '@/lib/pricing';
import { ListingsManager } from '@/components/dashboard/ListingsManager';
import type { OwnListing } from '@/components/dashboard/ListingsManager';

/** Force per-request dynamic rendering (session cookie + D1 read) */
export const dynamic = 'force-dynamic';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Listings — Houston Home Spotlight',
};

/**
 * ListingsPage — RSC shell that loads the agent's own listings and
 * passes them to the client ListingsManager for management.
 *
 * @returns {Promise<JSX.Element>} Listings management page
 */
export default async function ListingsPage(): Promise<JSX.Element> {
  // --- 1. Verify session (T-04-17: uid from session, not request) ---
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  if (!tokens) {
    redirect('/login?redirect=/dashboard/listings');
  }

  const uid = tokens.decodedToken.uid;
  const isAdmin =
    (tokens.decodedToken as unknown as Record<string, unknown>).admin === true;

  // --- 2. Load agent's own listings scoped by agent_id (LIST-08) ---
  let listings: OwnListing[] = [];
  // Active-listing cap for the agent's tier (null = unlimited / admin); shown
  // as a usage indicator and enforced server-side on create/import.
  let maxListings: number | null = null;

  try {
    const { env } = await getCloudflareContext({ async: true });

    const result = await env.DB.prepare(
      `SELECT id, title, slug, address, price, beds, baths, status, created_at,
              video_status, video_url, featured
       FROM listings
       WHERE agent_id = ?
       ORDER BY created_at DESC`
    )
      .bind(uid)
      .all<OwnListing>();

    listings = result.results;

    if (!isAdmin) {
      const state = await getAgentSubscriptionState(env.DB, uid);
      maxListings = limitsForTier(state?.subscription_tier ?? null)?.maxListings ?? null;
    }
  } catch (err) {
    // D1 read failure: render the manager with empty state rather than
    // crashing the page. The client component can re-fetch on mount.
    console.error('ListingsPage: D1 read error', err);
    listings = [];
  }

  // --- 3. Render client ListingsManager with server-loaded initial data ---
  return (
    <ListingsManager
      initialListings={listings}
      isAdmin={isAdmin}
      maxListings={maxListings}
    />
  );
}
