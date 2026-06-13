/**
 * Billing Placeholder Page
 *
 * Phase 2 scaffold — subscription management content will be delivered in Phase 3.
 * Per UI-SPEC /dashboard/billing spec and Copywriting Contract.
 *
 * @module app/(dashboard)/dashboard/billing/page
 */

import type { Metadata } from 'next';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Billing — Houston Home Spotlight',
};

/**
 * BillingPage — placeholder RSC for /dashboard/billing.
 *
 * @returns {JSX.Element} Placeholder page with Phase 3 coming-soon copy
 */
export default function BillingPage(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900 mb-4">
        Billing
      </h1>
      <p className="text-base text-gray-500">
        Subscription management coming in Phase 3.
      </p>
    </div>
  );
}
