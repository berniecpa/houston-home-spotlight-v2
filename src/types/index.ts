/**
 * Houston Home Spotlight - TypeScript Type Definitions
 * 
 * These types define the data structures used throughout the application.
 * All field names match the expected API schemas (e.g., Perfex CRM field names).
 */

/**
 * Property listing data structure
 * Represents a home for sale in the Houston area
 */
export interface Listing {
  /** Unique identifier for the listing */
  id: string;
  /** URL-friendly slug for the listing detail page */
  slug: string;
  /** Street address */
  address: string;
  /** City name */
  city: string;
  /** State abbreviation (e.g., 'TX') */
  state: string;
  /** ZIP code */
  zip: string;
  /** Listing price in USD */
  price: number;
  /** Number of bedrooms */
  beds: number;
  /** Number of bathrooms */
  baths: number;
  /** Square footage */
  sqft: number;
  /** Full property description */
  description: string;
  /** Array of image URLs */
  images: string[];
  /** Optional video tour URL */
  videoUrl?: string;
  /** Builder name for new-construction homes (e.g. "Meritage Homes"); omitted for resale */
  homebuilder?: string;
  /** Free-text incentives/promotions (e.g. "$10k toward closing"); omitted if none */
  incentives?: string;
  /** Authority link to the original MLS/Zillow/builder listing; omitted if none */
  sourceUrl?: string;
  /** Whether this listing should appear on the home page */
  featured: boolean;
  /**
   * True when the owning agent's subscription tier grants featured search
   * placement (Pro/Team). Derived at read-time from the agent's tier; drives
   * the "Featured" badge for paid placement. Optional: absent on fixtures and
   * legacy callers, treated as false.
   */
  featuredPlacement?: boolean;
  /** ISO 8601 timestamp when listing was created */
  createdAt: string;
}

/**
 * Lead form data structure
 * Field names match Perfex CRM API expectations exactly
 */
export interface LeadFormData {
  /** First name - matches Perfex CRM field name */
  firstname: string;
  /** Last name - matches Perfex CRM field name */
  lastname: string;
  /** Email address */
  email: string;
  /** Phone number - matches Perfex CRM field name */
  phonenumber: string;
  /** Message or inquiry description */
  description: string;
  /** Optional reference to the listing being inquired about */
  listingSlug?: string;
}

/**
 * Filter options for the listings page
 * All fields are optional - empty filter shows all listings
 */
export interface FilterOptions {
  /** Minimum price filter (inclusive) */
  minPrice?: number;
  /** Maximum price filter (inclusive) */
  maxPrice?: number;
  /** Minimum number of bedrooms (inclusive) */
  minBeds?: number;
}

/**
 * API response structure for lead submission
 */
export interface LeadSubmissionResponse {
  /** Whether the submission was successful */
  success: boolean;
  /** Response message */
  message: string;
  /** Optional lead ID returned from CRM */
  leadId?: string;
}

/**
 * Image metadata for property photos
 */
export interface ListingImage {
  /** Image URL */
  url: string;
  /** Optional alt text for accessibility */
  alt?: string;
  /** Whether this is the primary/first image */
  isPrimary?: boolean;
}
