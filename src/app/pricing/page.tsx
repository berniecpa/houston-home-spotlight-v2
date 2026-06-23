/**
 * Pricing Page (public)
 *
 * Marketing page showing the three subscription tiers via the shared
 * PricingTable. Selecting a tier starts Stripe checkout (or routes a
 * logged-out visitor to register first).
 *
 * @module app/pricing/page
 */

import type { Metadata } from 'next';
import { PricingTable } from '@/components/PricingTable';

export const metadata: Metadata = {
  title: 'Pricing — Houston Home Spotlight',
  description:
    'Simple, tiered plans for Houston real estate agents — publish listings, capture buyer leads, and generate AI property-tour videos.',
};

/**
 * PricingPage — public pricing/marketing page.
 *
 * @returns {JSX.Element} Pricing page
 */
export default function PricingPage(): JSX.Element {
  return (
    <div className="container-custom py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-gray-900">
          Plans for every Houston agent
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Publish listings, capture buyer inquiries, and turn photos into AI
          property-tour videos. Cancel anytime.
        </p>
      </div>

      <div className="mt-12">
        <PricingTable ctaLabel="Get started" />
      </div>

      <p className="mt-10 text-center text-sm text-gray-500">
        Questions about plans?{' '}
        <a href="/contact" className="text-primary-600 hover:underline">
          Contact us
        </a>
        .
      </p>
    </div>
  );
}
