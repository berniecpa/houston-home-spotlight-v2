/**
 * Admin Listings Page — /admin/listings
 *
 * Paginated list of EVERY listing on the platform (all agents), with the owning
 * agent, price, status, a View link to the public detail page, and a Remove
 * action. Not subscription/expiry-gated — admin sees active, paused, and expired.
 *
 * Security: the (admin) layout calls requireAdmin() server-side before this page
 * renders; the Remove button calls DELETE /api/admin/listings/[id] which
 * re-verifies the admin claim server-side.
 *
 * @module app/(admin)/admin/listings/page
 */

import type { Metadata } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { listAllListingsPaginated, ADMIN_PAGE_SIZE } from '@/lib/admin';
import { AdminListingRow } from '@/components/admin/AdminListingRow';

/** Force dynamic rendering — reads D1 at request time */
export const dynamic = 'force-dynamic';

/** Prevent search engines from indexing admin pages */
export const metadata: Metadata = {
  title: 'Listings | Admin | Houston Home Spotlight',
  robots: { index: false, follow: false },
};

interface ListingsPageSearchParams {
  page?: string;
}

/**
 * Admin ListingsPage — paginated all-listings table with Remove.
 *
 * @param props.searchParams - Next.js searchParams (includes ?page)
 * @returns {Promise<JSX.Element>} Paginated listing list
 */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<ListingsPageSearchParams>;
}): Promise<JSX.Element> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;

  const MAX_PAGE = 1_000_000;
  const resolvedSearchParams = await searchParams;
  const rawPage = Math.max(1, parseInt(resolvedSearchParams.page ?? '1', 10) || 1);
  const requestedPage = Math.min(rawPage, MAX_PAGE);
  const pageSize = ADMIN_PAGE_SIZE;
  const offset = (requestedPage - 1) * pageSize;

  const { listings, total } = await listAllListingsPaginated(db, pageSize, offset);

  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(requestedPage, Math.max(1, totalPages));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Listings</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} listing{total !== 1 ? 's' : ''} across all agents
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {listings.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No listings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Listing
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <AdminListingRow key={listing.id} listing={listing} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          {hasPrev ? (
            <a
              href={`/admin/listings?page=${page - 1}`}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              &larr; Prev
            </a>
          ) : (
            <span className="px-4 py-2 text-sm font-medium text-gray-300 bg-white border border-gray-100 rounded-lg cursor-not-allowed">
              &larr; Prev
            </span>
          )}

          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>

          {hasNext ? (
            <a
              href={`/admin/listings?page=${page + 1}`}
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
