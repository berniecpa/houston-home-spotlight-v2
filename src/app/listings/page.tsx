"use client";

/**
 * All Listings Page
 * 
 * Displays all property listings with filtering capabilities.
 * Features client-side filtering by price range and bedroom count.
 * 
 * @module app/listings/page
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar } from "@/components/FilterBar";
import { Listing, FilterOptions } from "@/types";

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
 * All Listings Page Component
 * 
 * Features:
 * - Hero section with page title
 * - Filter bar with price and bedroom filters
 * - Responsive grid of listing cards
 * - Empty state when no listings match filters
 * - Results count display
 * - Client-side filtering for instant feedback
 */
export default function ListingsPage(): JSX.Element {
  // All listings loaded from data
  const [allListings, setAllListings] = useState<Listing[]>([]);
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  // Error state
  const [error, setError] = useState<string | null>(null);
  // Current filter values
  const [filters, setFilters] = useState<FilterOptions>({});

  // Load listings on mount
  useEffect(() => {
    async function loadListings() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Dynamic import to load listings data
        const listingFiles = [
          import("@/data/listings/riverside-terrace-modern-craftsman.json"),
          import("@/data/listings/heights-bungalow-historic.json"),
          import("@/data/listings/sugarland-estate-pool.json"),
        ];

        const modules = await Promise.all(listingFiles);
        const listings = modules.map((module) => module.default || module);
        
        setAllListings(listings);
      } catch (err) {
        console.error("Error loading listings:", err);
        setError("Failed to load listings. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    loadListings();
  }, []);

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
                Houston Area Homes for Sale
              </h1>
              
              {/* Results Summary */}
              <p className="text-primary-100 text-base sm:text-lg">
                {!isLoading && (
                  <>
                    {filteredCount === totalCount ? (
                      <>
                        Showing all <span className="font-semibold text-white">{totalCount}</span> available properties
                      </>
                    ) : (
                      <>
                        Showing <span className="font-semibold text-white">{filteredCount}</span> of{" "}
                        <span className="font-semibold text-white">{totalCount}</span> properties
                        {activeFilterCount > 0 && (
                          <span className="ml-2 text-accent-400">
                            ({activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied)
                          </span>
                        )}
                      </>
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

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
              <p className="text-gray-600">Loading listings...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State - No Listings */}
          {!isLoading && !error && allListings.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No listings available</h3>
              <p className="text-gray-600">
                Check back soon for new properties in the Houston area.
              </p>
            </div>
          )}

          {/* Empty State - Filters Returned No Results */}
          {!isLoading && !error && allListings.length > 0 && filteredListings.length === 0 && (
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
          {!isLoading && !error && filteredListings.length > 0 && (
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
