/**
 * ListingCard Component
 * 
 * A reusable card component for displaying property listings.
 * Shows primary image, address, price, and key stats (beds/baths/sqft).
 * Links to the listing detail page.
 * 
 * @module components/ListingCard
 */

import Link from "next/link";
import Image from "next/image";
import { Listing } from "@/types";

/**
 * Props for the ListingCard component
 */
interface ListingCardProps {
  /** The listing data to display */
  listing: Listing;
}

/**
 * Format price as currency string
 * @param price - Price in USD
 * @returns Formatted price string (e.g., "$785,000")
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format number with commas
 * @param num - Number to format
 * @returns Formatted number string (e.g., "3,200")
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * ListingCard component - Displays a property listing in card format
 * 
 * Features:
 * - Primary image with aspect ratio preservation
 * - Address, city, state display
 * - Formatted price
 * - Beds, baths, and sqft summary
 * - Hover effects for interactivity
 * - Mobile-optimized (full width)
 * 
 * @param {ListingCardProps} props - Component props
 * @returns {JSX.Element} The listing card
 */
export function ListingCard({ listing }: ListingCardProps): JSX.Element {
  const primaryImage = listing.images[0] || "https://picsum.photos/seed/placeholder/800/600";
  
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group block w-full"
      aria-label={`View details for ${listing.address}`}
    >
      <article className="card h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1">
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          <Image
            src={primaryImage}
            alt={`${listing.address} - Primary Photo`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
            priority={listing.featured}
          />
          {/* Featured Badge */}
          {listing.featured && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-accent-500 text-primary-900 rounded-full shadow-sm">
                Featured
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5">
          {/* Price */}
          <p className="text-2xl font-bold text-primary-900 mb-2">
            {formatPrice(listing.price)}
          </p>

          {/* Address */}
          <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">
            {listing.address}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {listing.city}, {listing.state} {listing.zip}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-700 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5">
              <svg 
                className="w-4 h-4 text-primary-700" 
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
              <span className="font-medium">{listing.beds}</span>
              <span className="text-gray-500">{listing.beds === 1 ? "bed" : "beds"}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <svg 
                className="w-4 h-4 text-primary-700" 
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
              <span className="font-medium">{listing.baths}</span>
              <span className="text-gray-500">{listing.baths === 1 ? "bath" : "baths"}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <svg 
                className="w-4 h-4 text-primary-700" 
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
              <span className="font-medium">{formatNumber(listing.sqft)}</span>
              <span className="text-gray-500">sqft</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default ListingCard;
