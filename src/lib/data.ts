/**
 * Data loading utilities
 * Functions for loading and querying listing data from JSON files
 */

import { Listing, FilterOptions } from '@/types';

// Cache for loaded listings
let listingsCache: Listing[] | null = null;

/**
 * Load all listings from the JSON data files
 * Uses caching to avoid repeated file system operations
 * @returns Array of all listings
 */
export async function getAllListings(): Promise<Listing[]> {
  if (listingsCache) {
    return listingsCache;
  }

  try {
    // Import JSON files directly for Next.js static export compatibility
    const listingFiles = [
      import('@/data/listings/riverside-terrace-modern-craftsman.json'),
      import('@/data/listings/heights-bungalow-historic.json'),
      import('@/data/listings/sugarland-estate-pool.json'),
    ];

    const listings = await Promise.all(listingFiles);
    listingsCache = listings.map((module) => module.default || module);
    
    return listingsCache;
  } catch (error) {
    console.error('Error loading listings:', error);
    return [];
  }
}

/**
 * Get a single listing by its slug
 * @param slug - The URL-friendly slug
 * @returns The matching listing or null if not found
 */
export async function getListingBySlug(slug: string): Promise<Listing | null> {
  try {
    const listings = await getAllListings();
    const listing = listings.find((l) => l.slug === slug);
    return listing || null;
  } catch (error) {
    console.error(`Error finding listing with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Get all featured listings
 * @returns Array of featured listings
 */
export async function getFeaturedListings(): Promise<Listing[]> {
  try {
    const listings = await getAllListings();
    return listings.filter((listing) => listing.featured);
  } catch (error) {
    console.error('Error loading featured listings:', error);
    return [];
  }
}

/**
 * Filter listings by criteria
 * @param filters - Filter options (minPrice, maxPrice, minBeds)
 * @returns Filtered array of listings
 */
export async function filterListings(filters: FilterOptions): Promise<Listing[]> {
  try {
    const listings = await getAllListings();
    
    return listings.filter((listing) => {
      if (filters.minPrice !== undefined && listing.price < filters.minPrice) {
        return false;
      }
      if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) {
        return false;
      }
      if (filters.minBeds !== undefined && listing.beds < filters.minBeds) {
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error('Error filtering listings:', error);
    return [];
  }
}

/**
 * Clear the listings cache (useful for testing)
 */
export function clearListingsCache(): void {
  listingsCache = null;
}
