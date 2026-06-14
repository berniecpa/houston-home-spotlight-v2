export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { getFeaturedListings } from "@/lib/data";

/**
 * Home Page Component
 * 
 * Landing page for Houston Home Spotlight featuring:
 * - Hero section with headline, subheadline, and CTA
 * - Featured listings grid
 * 
 * @module app/page
 */

export default async function Home(): Promise<JSX.Element> {
  const featuredListings = await getFeaturedListings();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="container-custom relative z-10">
          <div className="py-16 sm:py-20 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Find Your Dream Home in{" "}
                <span className="text-accent-400">Houston</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl md:text-2xl text-primary-100 mb-8 leading-relaxed max-w-2xl mx-auto">
                Discover beautiful homes for sale in Houston&apos;s most desirable neighborhoods. 
                Let Bernard help you find the perfect property.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/listings"
                  className="btn-accent w-full sm:w-auto text-lg px-8 py-4"
                >
                  Browse Listings
                  <svg
                    className="ml-2 w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white border-2 border-white/30 rounded-lg hover:bg-white/10 transition-colors duration-200 w-full sm:w-auto"
                >
                  Contact Bernard
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
            preserveAspectRatio="none"
          >
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Featured Listings Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gray-50">
        <div className="container-custom">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-900 mb-4">
              Featured Listings
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Handpicked properties that stand out for their quality, location, and value.
            </p>
          </div>

          {/* Featured Listings Grid */}
          {featuredListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {featuredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No featured listings available at this time.
              </p>
            </div>
          )}

          {/* View All Button */}
          <div className="text-center mt-10 sm:mt-12">
            <Link
              href="/listings"
              className="btn-primary inline-flex items-center"
            >
              View All Listings
              <svg
                className="ml-2 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Work With Me Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container-custom">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-900 mb-4">
              Why Work With Bernard?
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Your trusted partner in finding the perfect Houston home.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-primary-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Local Expertise
              </h3>
              <p className="text-gray-600 text-sm">
                Deep knowledge of Houston neighborhoods and market trends.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-primary-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Responsive Service
              </h3>
              <p className="text-gray-600 text-sm">
                Quick responses and dedicated support throughout your journey.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-primary-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Trusted Advisor
              </h3>
              <p className="text-gray-600 text-sm">
                Honest guidance focused on your best interests.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-primary-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Curated Selection
              </h3>
              <p className="text-gray-600 text-sm">
                Access to exclusive listings and off-market properties.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-primary-900">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Find Your Perfect Home?
            </h2>
            <p className="text-primary-100 text-base sm:text-lg mb-8">
              Let&apos;s discuss what you&apos;re looking for. I&apos;ll help you navigate 
              the Houston market and find a home that fits your lifestyle.
            </p>
            <Link
              href="/contact"
              className="btn-accent inline-flex items-center text-lg px-8 py-4"
            >
              Get in Touch
              <svg
                className="ml-2 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
