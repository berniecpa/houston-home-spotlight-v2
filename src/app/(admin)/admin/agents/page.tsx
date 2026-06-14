/**
 * Admin Agents Page — /admin/agents
 *
 * Paginated list of all agents showing name, email, subscription status, and
 * account status (Active/Suspended) with an inline suspend/unsuspend toggle
 * (ADMIN-01 + ADMIN-02).
 *
 * Security: the (admin) layout calls requireAdmin() server-side before this
 * page renders (BL-01 defense in depth) and middleware enforces the admin claim
 * upstream; the AgentRow suspend toggle calls PATCH /api/admin/agents/[id] which
 * re-verifies the admin claim server-side (T-05-10 defense in depth).
 *
 * Pagination: server-side via ?page searchParam; page size is ADMIN_PAGE_SIZE (25).
 * Prev/Next links are rendered as links to ?page=N (Next.js native navigation).
 *
 * SEO: robots noindex/nofollow — admin pages must not be indexed (T-05-13).
 *
 * @module app/(admin)/admin/agents/page
 */

import type { Metadata } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { listAgentsPaginated, ADMIN_PAGE_SIZE } from '@/lib/admin';
import { AgentRow } from '@/components/admin/AgentRow';

/** Force dynamic rendering — no static cache; reads D1 at request time */
export const dynamic = 'force-dynamic';

/** Prevent search engines from indexing admin pages (T-05-13) */
export const metadata: Metadata = {
  title: 'Agents | Admin | Houston Home Spotlight',
  robots: { index: false, follow: false },
};

/**
 * searchParams shape for the agents page.
 */
interface AgentsPageSearchParams {
  page?: string;
}

/**
 * AgentsPage — Admin paginated agent list with suspend toggle.
 *
 * @param props.searchParams - Next.js searchParams (includes ?page)
 * @returns {Promise<JSX.Element>} Paginated agent list
 */
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<AgentsPageSearchParams>;
}): Promise<JSX.Element> {
  // Read D1 directly in the RSC (pattern established in Phase 4)
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;

  // Parse ?page (1-indexed, default 1)
  const resolvedSearchParams = await searchParams;
  const pageParam = resolvedSearchParams.page;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = ADMIN_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const { agents, total } = await listAgentsPaginated(db, pageSize, offset);

  const totalPages = Math.ceil(total / pageSize);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="max-w-6xl">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">
          Agents
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} agent{total !== 1 ? 's' : ''} registered
        </p>
      </div>

      {/* Agent table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No agents registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Account Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination controls — Prev / page info / Next */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          {/* Prev link */}
          {hasPrev ? (
            <a
              href={`/admin/agents?page=${page - 1}`}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              &larr; Prev
            </a>
          ) : (
            <span className="px-4 py-2 text-sm font-medium text-gray-300 bg-white border border-gray-100 rounded-lg cursor-not-allowed">
              &larr; Prev
            </span>
          )}

          {/* Page info */}
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>

          {/* Next link */}
          {hasNext ? (
            <a
              href={`/admin/agents?page=${page + 1}`}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Next &rarr;
            </a>
          ) : (
            <span className="px-4 py-2 text-sm font-medium text-gray-300 bg-white border border-gray-100 rounded-lg cursor-not-allowed">
              Next &rarr;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
