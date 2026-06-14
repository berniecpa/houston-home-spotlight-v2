/**
 * Admin Stats Page — /admin/stats
 *
 * Displays four platform-wide count statistics for Bernard:
 *   - Total Agents registered
 *   - Active Subscriptions (subscription_status = 'active')
 *   - Total Listings (all listing rows)
 *   - Total Leads (all lead rows)
 *
 * (ADMIN-03)
 *
 * Security: middleware enforces the admin claim before this page renders.
 * Reads D1 directly in the RSC (no API round-trip needed).
 *
 * SEO: robots noindex/nofollow — admin pages must not be indexed (T-05-13).
 *
 * Design: four stat cards mirroring dashboard card styling (bg-white, rounded-xl,
 * shadow-sm, border) with a red accent to match the admin theme.
 *
 * @module app/(admin)/admin/stats/page
 */

import type { Metadata } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { getPlatformStats } from '@/lib/admin';

/** Force dynamic rendering — reads D1 at request time */
export const dynamic = 'force-dynamic';

/** Prevent search engines from indexing admin pages (T-05-13) */
export const metadata: Metadata = {
  title: 'Platform Stats | Admin | Houston Home Spotlight',
  robots: { index: false, follow: false },
};

/**
 * Individual stat card props.
 */
interface StatCardProps {
  /** Stat label shown above the count */
  label: string;
  /** Numeric count to display */
  value: number;
  /** Optional description shown below the count */
  description?: string;
}

/**
 * StatCard — a single count card with red-accent styling for the admin theme.
 */
function StatCard({ label, value, description }: StatCardProps): JSX.Element {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <p className="font-serif text-3xl font-bold text-red-700">
        {value.toLocaleString()}
      </p>
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}

/**
 * StatsPage — Admin platform statistics overview.
 *
 * @returns {Promise<JSX.Element>} Four stat cards with platform counts
 */
export default async function StatsPage(): Promise<JSX.Element> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;

  const stats = await getPlatformStats(db);

  return (
    <div className="max-w-4xl">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">
          Platform Stats
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Live counts from the D1 database.
        </p>
      </div>

      {/* Four stat cards — responsive 2-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Agents"
          value={stats.totalAgents}
          description="All registered agents"
        />
        <StatCard
          label="Active Subscriptions"
          value={stats.activeSubscriptions}
          description="Agents with subscription_status = active"
        />
        <StatCard
          label="Total Listings"
          value={stats.totalListings}
          description="All listing rows (any status)"
        />
        <StatCard
          label="Total Leads"
          value={stats.totalLeads}
          description="All buyer inquiries received"
        />
      </div>
    </div>
  );
}
