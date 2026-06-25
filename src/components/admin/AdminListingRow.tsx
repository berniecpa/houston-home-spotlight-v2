'use client';

/**
 * AdminListingRow — one row of the admin all-listings table with a Remove action.
 *
 * Client component: renders listing summary + owning agent, a "View" link to the
 * public detail page, and a "Remove" button that DELETEs /api/admin/listings/[id]
 * after a window.confirm guard, then router.refresh() to re-render the list.
 *
 * Security: the listingId is in the URL; the server route re-verifies the admin
 * claim via requireAdmin(). This component sends no identity.
 *
 * @module components/admin/AdminListingRow
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminListingRow as AdminListing } from '@/lib/admin';

/** AdminListingRow props */
export interface AdminListingRowProps {
  /** Listing row (joined with agent) from listAllListingsPaginated */
  listing: AdminListing;
}

/** Format a price number as USD. */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * AdminListingRow — single all-listings table row with View + Remove.
 *
 * @param props.listing - Listing row from the admin query
 * @returns {JSX.Element} Table row
 */
export function AdminListingRow({ listing }: AdminListingRowProps): JSX.Element {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Remove the listing after a confirm guard. */
  const handleRemove = useCallback(async () => {
    const ok = window.confirm(
      `Remove "${listing.title}"? This permanently deletes the listing and its photos.`
    );
    if (!ok) return;

    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Remove failed. Please try again.');
      } else {
        router.refresh();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsPending(false);
    }
  }, [listing.id, listing.title, router]);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Title + address */}
      <td className="px-4 py-3 text-sm">
        <p className="font-medium text-gray-900 leading-snug">{listing.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {listing.address}, {listing.city}
        </p>
      </td>

      {/* Owning agent */}
      <td className="px-4 py-3 text-sm text-gray-700">
        {listing.agent_name ?? <span className="text-gray-400 italic">No name</span>}
        <span className="block text-xs text-gray-400">{listing.agent_email}</span>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
        {formatPrice(listing.price)}
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-sm">
        <span
          className={
            listing.status === 'active'
              ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700'
              : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700'
          }
        >
          {listing.status}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <a
            href={`/listings/${listing.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-800 font-medium transition-colors"
            aria-label={`View ${listing.title}`}
          >
            View
          </a>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            aria-label={`Remove ${listing.title}`}
            className={
              isPending
                ? 'px-3 py-1 rounded text-xs font-medium opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
                : 'px-3 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors touch-target'
            }
          >
            {isPending ? '...' : 'Remove'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1" role="alert">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export default AdminListingRow;
