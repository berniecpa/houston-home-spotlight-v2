/**
 * Listings Placeholder Page
 *
 * Phase 2 scaffold — listing management content will be delivered in Phase 4.
 * Per UI-SPEC /dashboard/listings spec and Copywriting Contract.
 *
 * @module app/(dashboard)/dashboard/listings/page
 */

import type { Metadata } from 'next';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Listings — Houston Home Spotlight',
};

/**
 * ListingsPage — placeholder RSC for /dashboard/listings.
 *
 * @returns {JSX.Element} Placeholder page with Phase 4 coming-soon copy
 */
export default function ListingsPage(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900 mb-4">
        Listings
      </h1>
      <p className="text-base text-gray-500">
        Listing management coming in Phase 4.
      </p>
    </div>
  );
}
