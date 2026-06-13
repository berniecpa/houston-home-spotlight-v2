/**
 * Leads Placeholder Page
 *
 * Phase 2 scaffold — lead inbox content will be delivered in Phase 4.
 * Per UI-SPEC /dashboard/leads spec and Copywriting Contract.
 *
 * @module app/(dashboard)/dashboard/leads/page
 */

import type { Metadata } from 'next';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Leads — Houston Home Spotlight',
};

/**
 * LeadsPage — placeholder RSC for /dashboard/leads.
 *
 * @returns {JSX.Element} Placeholder page with Phase 4 coming-soon copy
 */
export default function LeadsPage(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900 mb-4">
        Leads
      </h1>
      <p className="text-base text-gray-500">
        Your lead inbox is coming in Phase 4.
      </p>
    </div>
  );
}
