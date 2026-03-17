/**
 * Listing Detail Page
 * 
 * Dynamic page for displaying individual property listings.
 * Features photo gallery, property details, description, and inquiry form.
 * 
 * @module app/listings/[slug]/page
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PhotoGallery } from '@/components/PhotoGallery';
import { InquiryForm } from '@/components/InquiryForm';
import { getListingBySlug, getAllListings } from '@/lib/data';

/**
 * Generate static params for all listings at build time
 * Required for Next.js static export
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const listings = await getAllListings();
  return listings.map((listing) => ({
    slug: listing.slug,
  }));
}

/**
 * Generate metadata for the listing detail page
 */
export async function generateMetadata({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<Metadata> {
  const listing = await getListingBySlug(params.slug);
  
  if (!listing) {
    return {
      title: 'Listing Not Found | Houston Home Spotlight',
    };
  }

  return {
    title: `${listing.address} | Houston Home Spotlight`,
    description: `${listing.beds} bed, ${listing.baths} bath home in ${listing.city}, ${listing.state}. ${listing.description.slice(0, 150)}...`,
  };
}

/**
 * Format price as currency string
 * @param price - Price in USD
 * @returns Formatted price string (e.g., "$785,000")
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format number with commas
 * @param num - Number to format
 * @returns Formatted number string (e.g., "3,200")
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Listing Detail Page Component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.params - URL parameters
 * @param {string} props.params.slug - The listing slug
 * @returns {JSX.Element} The listing detail page
 */
export default async function ListingDetailPage({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<JSX.Element> {
  const listing = await getListingBySlug(params.slug);

  // Return 404 if listing not found
  if (!listing) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="container-custom py-6 sm:py-8 md:py-12">
        {/* Back Link */}
        <a
          href="/listings"
          className="inline-flex items-center text-sm text-gray-600 hover:text-primary-700 mb-4 sm:mb-6 transition-colors"
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
          Back to Listings
        </a>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {/* Left Column - Gallery and Details */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {/* Photo Gallery */}
            <section>
              <PhotoGallery images={listing.images} alt={listing.address} />
            </section>

            {/* Property Header - Mobile Only (shown above stats on mobile) */}
            <div className="lg:hidden">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {listing.address}
              </h1>
              <p className="text-lg text-gray-600 mb-4">
                {listing.city}, {listing.state} {listing.zip}
              </p>
              <p className="text-3xl sm:text-4xl font-bold text-primary-900">
                {formatPrice(listing.price)}
              </p>
            </div>

            {/* Key Stats */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {/* Price - Desktop Only */}
                <div className="hidden lg:block text-center sm:text-left">
                  <p className="text-sm text-gray-500 mb-1">Price</p>
                  <p className="text-2xl xl:text-3xl font-bold text-primary-900">
                    {formatPrice(listing.price)}
                  </p>
                </div>

                {/* Beds */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-gray-500 mb-1">Bedrooms</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <svg
                      className="w-5 h-5 text-primary-700 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {listing.beds}
                    </p>
                  </div>
                </div>

                {/* Baths */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-gray-500 mb-1">Bathrooms</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <svg
                      className="w-5 h-5 text-primary-700 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {listing.baths}
                    </p>
                  </div>
                </div>

                {/* Sqft */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-gray-500 mb-1">Square Feet</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <svg
                      className="w-5 h-5 text-primary-700 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {formatNumber(listing.sqft)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Property Description */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                About This Home
              </h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </section>

            {/* Property Details Grid */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                Property Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Address</span>
                  <span className="font-medium text-gray-900">{listing.address}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">City</span>
                  <span className="font-medium text-gray-900">{listing.city}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">State</span>
                  <span className="font-medium text-gray-900">{listing.state}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">ZIP Code</span>
                  <span className="font-medium text-gray-900">{listing.zip}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Bedrooms</span>
                  <span className="font-medium text-gray-900">{listing.beds}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Bathrooms</span>
                  <span className="font-medium text-gray-900">{listing.baths}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Square Feet</span>
                  <span className="font-medium text-gray-900">{formatNumber(listing.sqft)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Price per Sqft</span>
                  <span className="font-medium text-gray-900">
                    ${formatNumber(Math.round(listing.price / listing.sqft))}
                  </span>
                </div>
              </div>
            </section>

            {/* Video Tour - if available */}
            {listing.videoUrl && (
              <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Video Tour
                </h2>
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Video tour coming soon</p>
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Inquiry Form (Desktop) */}
          <div className="lg:col-span-1">
            {/* Desktop: Sticky form container */}
            <div className="lg:sticky lg:top-6">
              {/* Property Header - Desktop Only */}
              <div className="hidden lg:block mb-6">
                <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 mb-2">
                  {listing.address}
                </h1>
                <p className="text-lg text-gray-600">
                  {listing.city}, {listing.state} {listing.zip}
                </p>
              </div>

              {/* Inquiry Form */}
              <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Interested in this home?
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Fill out the form below and Bernard will get back to you shortly.
                </p>
                <InquiryForm listingSlug={listing.slug} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
