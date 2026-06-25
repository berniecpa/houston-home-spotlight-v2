/**
 * Neighborhood Area Page
 *
 * Lists active listings whose city belongs to the requested area
 * (see src/lib/neighborhoods.ts). Reads from D1 per request (force-dynamic)
 * via getAllListings, which already applies the visibility + 90-day expiry gate.
 *
 * @module app/neighborhoods/[slug]/page
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { getAllListings } from '@/lib/data';
import { areaBySlug, cityInArea } from '@/lib/neighborhoods';
import { siteConfig } from '@/lib/site-config';

/**
 * Per-area SEO metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = areaBySlug(slug);
  if (!area) {
    return { title: 'Neighborhood Not Found | Houston Home Spotlight' };
  }
  const title = `${area.name} Homes for Sale | Houston Home Spotlight`;
  return {
    title,
    description: `${area.blurb} Browse available homes in ${area.cities.join(', ')}.`,
    alternates: { canonical: `${siteConfig.url}/neighborhoods/${area.slug}` },
  };
}

/**
 * NeighborhoodPage — area-filtered listing grid.
 *
 * @param props.params - Route params with the area slug
 * @returns {JSX.Element} Area hero + filtered listing grid (or empty state)
 */
export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const area = areaBySlug(slug);
  if (!area) notFound();

  const all = await getAllListings();
  const listings = all.filter((l) => cityInArea(l.city, area));

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="gradient-primary text-white">
        <div className="container-custom">
          <div className="py-10 sm:py-12 md:py-16">
            <div className="max-w-3xl">
              <nav aria-label="Breadcrumb" className="mb-4">
                <ol className="flex items-center gap-2 text-sm text-primary-200">
                  <li>
                    <a href="/" className="hover:text-white transition-colors">
                      Home
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <a href="/neighborhoods" className="hover:text-white transition-colors">
                      Neighborhoods
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="text-white font-medium">
                    {area.name}
                  </li>
                </ol>
              </nav>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
                {area.name}
              </h1>
              <p className="text-primary-100 text-base sm:text-lg">{area.blurb}</p>
              <p className="text-primary-200 text-sm mt-2">
                {listings.length} {listings.length === 1 ? 'home' : 'homes'} available
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="py-6 sm:py-8 md:py-12 bg-gray-50">
        <div className="container-custom">
          {listings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                No homes available here right now
              </h2>
              <p className="text-gray-600 mb-6">
                New listings are added regularly — check back soon or browse all homes.
              </p>
              <Link href="/listings" className="btn-primary">
                Browse all listings
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
