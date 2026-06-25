/**
 * Neighborhoods Index
 *
 * Lists every browsable area (src/lib/neighborhoods.ts) as a card linking to
 * its area page. Static content — no per-request data needed.
 *
 * @module app/neighborhoods/page
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { NEIGHBORHOOD_AREAS } from '@/lib/neighborhoods';

export const metadata: Metadata = {
  title: 'Houston Neighborhoods | Houston Home Spotlight',
  description:
    'Browse Houston-area homes by neighborhood — Katy, Cypress, Conroe, Richmond, Sugar Land, Pearland and more.',
};

/**
 * NeighborhoodsIndex — grid of area cards.
 * @returns {JSX.Element} Areas overview page
 */
export default function NeighborhoodsIndex(): JSX.Element {
  return (
    <div className="min-h-screen">
      <section className="gradient-primary text-white">
        <div className="container-custom">
          <div className="py-10 sm:py-12 md:py-16 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              Neighborhoods We Cover
            </h1>
            <p className="text-primary-100 text-base sm:text-lg">
              From the inner loop to the master-planned suburbs — explore homes
              across the Houston metro by area.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="container-custom">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {NEIGHBORHOOD_AREAS.map((area) => (
              <Link
                key={area.slug}
                href={`/neighborhoods/${area.slug}`}
                className="card p-6 h-full border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {area.name}
                </h2>
                <p className="text-sm text-gray-700 mb-2">{area.cities.join(', ')}</p>
                <p className="text-sm text-gray-500">{area.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
