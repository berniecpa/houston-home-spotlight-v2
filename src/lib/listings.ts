/**
 * Listing data utilities
 * Functions for loading and querying listing data from JSON files
 */

import { Listing, FilterOptions } from '@/types';

// Cache for loaded listings
let listingsCache: Listing[] | null = null;

/**
 * Load all listings from the JSON data files
 * @returns Array of all listings
 */
export async function loadListings(): Promise<Listing[]> {
  if (listingsCache) {
    return listingsCache;
  }

  try {
    // In a real app with filesystem access, we'd read the directory
    // For Next.js static export, we import the JSON files directly
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
 * @returns The matching listing or undefined
 */
export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  const listings = await loadListings();
  return listings.find((listing) => listing.slug === slug);
}

/**
 * Get all featured listings
 * @returns Array of featured listings
 */
export async function getFeaturedListings(): Promise<Listing[]> {
  const listings = await loadListings();
  return listings.filter((listing) => listing.featured);
}

/**
 * Filter listings by criteria
 * @param filters - Filter options
 * @returns Filtered array of listings
 */
export async function filterListings(filters: FilterOptions): Promise<Listing[]> {
  const listings = await loadListings();
  
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
}

/**
 * Clear the listings cache (useful for testing)
 */
export function clearListingsCache(): void {
  listingsCache = null;
}
