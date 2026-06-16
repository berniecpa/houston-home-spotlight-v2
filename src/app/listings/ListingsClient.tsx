'use client';

/**
 * Listings Client Component
 *
 * Receives server-fetched D1 listings as a prop and handles all client-side
 * filter state and rendering. Reproduces the original browse-page UX verbatim:
 * hero, breadcrumb, FilterBar, results-count, empty/no-match states, and the
 * responsive ListingCard grid.
 *
 * @module app/listings/ListingsClient
 */

import { useState, useCallback, useMemo } from 'react';
import { ListingCard } from '@/components/ListingCard';
import { FilterBar } from '@/components/FilterBar';
import { Listing, FilterOptions } from '@/types';

/**
 * Props for the ListingsClient component
 */
interface ListingsClientProps {
  /** Pre-fetched listings from D1 (subscription-gated, RSC-passed) */
  initialListings: Listing[];
}

/**
 * Filter listings based on current filter options
 * @param listings - All available listings
 * @param filters - Current filter criteria
 * @returns Filtered array of listings
 */
function filterListingsClientSide(
  listings: Listing[],
  filters: FilterOptions
): Listing[] {
  return listings.filter((listing) => {
    // Check min price
    if (filters.minPrice !== undefined && listing.price < filters.minPrice) {
      return false;
    }
    // Check max price
    if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) {
      return false;
    }
    // Check min beds
    if (filters.minBeds !== undefined && listing.beds < filters.minBeds) {
      return false;
    }
    return true;
  });
}

/**
 * Listings Client Component
 *
 * Manages filter state and renders the full listings browse UI.
 * Data arrives as a prop from the parent RSC — no client-side fetch needed.
 *
 * @param {ListingsClientProps} props - Component props
 * @returns {JSX.Element} The listings browse page UI
 */
export default function ListingsClient({ initialListings }: ListingsClientProps): JSX.Element {
  // All listings received from the server
  const allListings = initialListings;
  // Current filter values
  const [filters, setFilters] = useState<FilterOptions>({});

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, []);

  // Filtered listings based on current filters
  const filteredListings = useMemo(() => {
    return filterListingsClientSide(allListings, filters);
  }, [allListings, filters]);

  // Total count of listings
  const totalCount = allListings.length;
  // Filtered count
  const filteredCount = filteredListings.length;
  // Number of active filters
  const activeFilterCount = [
    filters.minPrice !== undefined,
    filters.maxPrice !== undefined,
    filters.minBeds !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="gradient-primary text-white">
        <div className="container-custom">
          <div className="py-10 sm:py-12 md:py-16">
            <div className="max-w-3xl">
              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="mb-4">
                <ol className="flex items-center gap-2 text-sm text-primary-200">
                  <li>
                    <a href="/" className="hover:text-white transition-colors">
                      Home
                    </a>
                  </li>
                  <li aria-hidden="true">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </li>
                  <li aria-current="page" className="text-white font-medium">
                    All Listings
                  </li>
                </ol>
              </nav>

              {/* Page Title */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
                Houston Area Homes
              </h1>

              {/* Results Summary */}
              <p className="text-primary-100 text-base sm:text-lg">
                {filteredCount === totalCount ? (
                  <>
                    Showing all <span className="font-semibold text-white">{totalCount}</span> available properties
                  </>
                ) : (
                  <>
                    Showing <span className="font-semibold text-white">{filteredCount}</span> of{' '}
                    <span className="font-semibold text-white">{totalCount}</span> properties
                    {activeFilterCount > 0 && (
                      <span className="ml-2 text-accent-400">
                        ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied)
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Listings Section */}
      <section className="py-6 sm:py-8 md:py-12 bg-gray-50">
        <div className="container-custom">
          {/* Filter Bar */}
          <div className="mb-6 sm:mb-8">
            <FilterBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              resultCount={filteredCount}
            />
          </div>

          {/* Empty State - No Listings */}
          {allListings.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No listings yet</h3>
              <p className="text-gray-600">
                New listings are added regularly. Check back soon or submit a property to be featured.
              </p>
            </div>
          )}

          {/* Empty State - Filters Returned No Results */}
          {allListings.length > 0 && filteredListings.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No listings match your filters</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your price range or bedroom requirements to see more properties.
              </p>
              <button
                onClick={() => setFilters({})}
                className="btn-primary"
              >
                Clear All Filters
              </button>
            </div>
          )}

          {/* Listings Grid */}
          {filteredListings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
