/**
 * Public Agent Profile Page
 *
 * Displays a licensed agent's public identity and their active, publicly-
 * visible listings. Accessible without login — this is a public marketing
 * page indexed by search engines.
 *
 * Rendering mode: force-dynamic (reads D1 at request time).
 * No runtime='edge' on this page — only API routes use edge runtime.
 *
 * Access control:
 *   - Calls getAgentProfileBySlug which returns null when the slug is
 *     unknown OR when the agent is suspended (is_suspended=1).
 *   - page.tsx calls notFound() on null → HTTP 404 response.
 *
 * PII safety (T-05-06):
 *   - getAgentProfileBySlug never returns email or phone.
 *   - AgentProfileHeaderProps has no email/phone fields.
 *   - No email or phone rendered anywhere on this page.
 *
 * @module app/agents/[slug]/page
 */

export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentProfileHeader } from '@/components/AgentProfileHeader';
import { ListingCard } from '@/components/ListingCard';
import { getAgentProfileBySlug } from '@/lib/data';

/**
 * Generate page metadata from the agent's display_name.
 * Allows indexing — this is a public profile page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getAgentProfileBySlug(slug);

  if (!profile) {
    return { title: 'Agent Not Found | Houston Home Spotlight' };
  }

  const title = `${profile.display_name} | Houston Home Spotlight`;
  const description = profile.brokerage
    ? `Browse active listings from ${profile.display_name} at ${profile.brokerage} on Houston Home Spotlight.`
    : `Browse active listings from ${profile.display_name} on Houston Home Spotlight.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
  };
}

/**
 * Agent Profile Page Component
 *
 * Force-dynamic RSC: resolves the agent by slug from D1, calls notFound()
 * when the agent is unknown or suspended, then renders AgentProfileHeader
 * + a listings grid using the shared ListingCard component.
 *
 * @param props.params - Async Next.js 15 params containing the agent slug
 */
export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const profile = await getAgentProfileBySlug(slug);

  // Unknown slug OR suspended agent → 404 (T-05-07)
  if (!profile) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-custom py-8 sm:py-12">
        {/* Back to Listings link */}
        <a
          href="/listings"
          className="inline-flex items-center text-sm text-gray-600 hover:text-primary-700 mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Browse All Listings
        </a>

        {/* Agent identity header — no PII (T-05-06) */}
        <AgentProfileHeader
          display_name={profile.display_name}
          photo_url={profile.photo_url}
          brokerage={profile.brokerage}
          license_number={profile.license_number}
        />

        {/* Agent's active, visible listings */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
            Active Listings
          </h2>

          {profile.listings.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 text-lg">
                This agent has no active listings at the moment.
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Check back soon or browse all available properties.
              </p>
              <a
                href="/listings"
                className="btn-primary mt-6 inline-block"
              >
                Browse All Listings
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
