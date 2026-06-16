/**
 * Admin Panel landing — /admin
 *
 * Platform overview for Bernard: at-a-glance counts (reusing getPlatformStats)
 * plus quick-link cards into the admin tools (Agents, Platform Stats).
 *
 * Security: the (admin) layout calls requireAdmin() server-side before this
 * page renders; reads D1 directly in the RSC. robots noindex/nofollow so the
 * admin surface is never indexed (T-05-13).
 *
 * @module app/(admin)/admin/page
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { getPlatformStats } from '@/lib/admin';

/** Force dynamic rendering — reads D1 at request time */
export const dynamic = 'force-dynamic';

/** Prevent search engines from indexing admin pages (T-05-13) */
export const metadata: Metadata = {
  title: 'Admin Panel | Houston Home Spotlight',
  robots: { index: false, follow: false },
};

/** A single overview count card with red-accent admin styling. */
function StatCard({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <p className="font-serif text-3xl font-bold text-red-700">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/**
 * AdminPage — platform overview landing for the admin area.
 *
 * @returns {Promise<JSX.Element>} Overview stats + quick links to admin tools
 */
export default async function AdminPage(): Promise<JSX.Element> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;
  const stats = await getPlatformStats(db);

  return (
    <div className="max-w-4xl">
      {/* Page heading -- 24px Merriweather semibold per UI-SPEC */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">
          Admin Panel
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform overview for Houston Home Spotlight.
        </p>
      </div>

      {/* At-a-glance platform counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Agents" value={stats.totalAgents} />
        <StatCard label="Active Subscriptions" value={stats.activeSubscriptions} />
        <StatCard label="Total Listings" value={stats.totalListings} />
        <StatCard label="Total Leads" value={stats.totalLeads} />
      </div>

      {/* Quick links into the admin tools */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Tools
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/agents"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-red-300 hover:shadow transition-all"
        >
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-red-700 transition-colors">
            Manage Agents →
          </h3>
          <p className="text-sm text-gray-500">
            Review every registered agent and suspend or reinstate accounts.
          </p>
        </Link>
        <Link
          href="/admin/stats"
          className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-red-300 hover:shadow transition-all"
        >
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-red-700 transition-colors">
            Platform Stats →
          </h3>
          <p className="text-sm text-gray-500">
            Live counts of agents, subscriptions, listings, and leads.
          </p>
        </Link>
      </div>
    </div>
  );
}
