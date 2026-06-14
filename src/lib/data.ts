/**
 * Listing data access layer — Cloudflare D1 backend
 *
 * Reads listings from D1 with the Phase 5 visibility gate applied:
 * only active listings from publishable, non-suspended agents are returned
 * to public callers (AGENT_VISIBLE_SQL — Phase 3 subscription + Phase 5 suspension).
 *
 * Two-query image grouping is used to avoid N-row JOIN fanout:
 *   1. SELECT listings (with agent publishability gate)
 *   2. SELECT listing_images WHERE listing_id IN (ids from step 1)
 * Images are grouped in-memory via Map<listing_id, url[]>.
 *
 * All public functions keep the same async signatures as the prior JSON
 * implementation so consuming pages and components require no changes.
 *
 * Error handling: every function catches D1 errors, logs them, and
 * returns [] / null (fail-safe — never throws to the page).
 *
 * @module lib/data
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { AGENT_VISIBLE_SQL } from '@/lib/subscription';
import type { Listing, FilterOptions } from '@/types';

/**
 * Shape of a raw listings row returned from D1.
 * All nullable fields from the schema are typed as `| null`.
 */
interface ListingRow {
  id: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  description: string | null;
  video_url: string | null;
  /** Epoch seconds (INTEGER in D1) */
  created_at: number;
  /** 0 or 1 — added via migration 0002 */
  featured: number;
}

/**
 * Shape of a raw listing_images row returned from D1.
 */
interface ImageRow {
  listing_id: string;
  url: string;
}

/**
 * Map a raw D1 ListingRow + images array to the public Listing interface.
 * - zip ?? '' — zip is optional in schema
 * - sqft ?? 0 — sqft is optional in schema
 * - description ?? '' — description is optional in schema
 * - videoUrl from video_url (undefined when null)
 * - featured: row.featured === 1 (INTEGER 1/0 to boolean)
 * - createdAt: epoch seconds → ISO 8601 string
 */
function rowToListing(row: ListingRow, images: string[]): Listing {
  return {
    id: row.id,
    slug: row.slug,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip ?? '',
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft ?? 0,
    description: row.description ?? '',
    images,
    videoUrl: row.video_url ?? undefined,
    featured: row.featured === 1,
    createdAt: new Date(row.created_at * 1000).toISOString(),
  };
}

/**
 * Fetch all public listings from D1.
 *
 * Applies the visibility gate: only listings whose owning agent is
 * publishable (active subscription, within grace period, or admin) AND
 * not suspended AND whose own status is 'active' are returned.
 *
 * Results are ordered by created_at DESC (newest first).
 *
 * @returns Array of all public listings; empty array on D1 error.
 */
export async function getAllListings(): Promise<Listing[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const listingRows = await db
      .prepare(
        `SELECT l.id, l.slug, l.address, l.city, l.state, l.zip,
                l.price, l.beds, l.baths, l.sqft, l.description,
                l.video_url, l.created_at, l.featured
         FROM listings l
         JOIN agents a ON l.agent_id = a.id
         WHERE l.status = 'active'
           AND ${AGENT_VISIBLE_SQL}
         ORDER BY l.created_at DESC`
      )
      .all<ListingRow>();

    if (!listingRows.results.length) return [];

    // Batch-fetch images for all returned listings (two-query grouping)
    const ids = listingRows.results.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const imageRows = await db
      .prepare(
        `SELECT listing_id, url FROM listing_images
         WHERE listing_id IN (${placeholders})
         ORDER BY display_order ASC`
      )
      .bind(...ids)
      .all<ImageRow>();

    // Group images by listing_id using in-memory Map
    const imageMap = new Map<string, string[]>();
    for (const img of imageRows.results) {
      const arr = imageMap.get(img.listing_id) ?? [];
      arr.push(img.url);
      imageMap.set(img.listing_id, arr);
    }

    return listingRows.results.map((row) =>
      rowToListing(row, imageMap.get(row.id) ?? [])
    );
  } catch (error) {
    console.error('getAllListings D1 error:', error);
    return [];
  }
}

/**
 * Fetch a single public listing by its URL slug.
 *
 * Applies the same visibility gate as getAllListings. Returns null when:
 * - No listing with the given slug exists
 * - The listing is paused (status !== 'active')
 * - The owning agent's subscription is lapsed / none, or agent is suspended
 *
 * Returning null causes the detail page to call notFound() (404).
 *
 * @param slug - The URL-friendly listing slug
 * @returns The matching Listing, or null if not found / hidden.
 */
export async function getListingBySlug(slug: string): Promise<Listing | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const row = await db
      .prepare(
        `SELECT l.id, l.slug, l.address, l.city, l.state, l.zip,
                l.price, l.beds, l.baths, l.sqft, l.description,
                l.video_url, l.created_at, l.featured
         FROM listings l
         JOIN agents a ON l.agent_id = a.id
         WHERE l.slug = ?
           AND l.status = 'active'
           AND ${AGENT_VISIBLE_SQL}`
      )
      .bind(slug)
      .first<ListingRow>();

    if (!row) return null;

    const imageRows = await db
      .prepare(
        `SELECT listing_id, url FROM listing_images
         WHERE listing_id = ?
         ORDER BY display_order ASC`
      )
      .bind(row.id)
      .all<ImageRow>();

    return rowToListing(row, imageRows.results.map((r) => r.url));
  } catch (error) {
    console.error(`getListingBySlug D1 error for "${slug}":`, error);
    return null;
  }
}

/**
 * Get all featured listings.
 *
 * Delegates to getAllListings (subscription gate already applied) and
 * filters for featured === true in-memory.
 *
 * @returns Array of featured listings; empty array on D1 error.
 */
export async function getFeaturedListings(): Promise<Listing[]> {
  const all = await getAllListings();
  return all.filter((l) => l.featured);
}

/**
 * Filter listings by price and bedroom count.
 *
 * Delegates to getAllListings (subscription gate already applied) and
 * applies in-memory price/beds filtering.
 *
 * @param filters - Filter options (minPrice, maxPrice, minBeds)
 * @returns Filtered array of listings; empty array on D1 error.
 */
export async function filterListings(filters: FilterOptions): Promise<Listing[]> {
  const all = await getAllListings();
  return all.filter((l) => {
    if (filters.minPrice !== undefined && l.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && l.price > filters.maxPrice) return false;
    if (filters.minBeds !== undefined && l.beds < filters.minBeds) return false;
    return true;
  });
}

/**
 * No-op retained for test teardown compatibility.
 *
 * The prior JSON-backed implementation used a module-level listingsCache.
 * D1 reads are per-request with no module-level state to clear.
 * Exported for backward-compatibility with test files that call it.
 */
export function clearListingsCache(): void {
  // No-op: D1 data layer has no module-level cache to clear
}

/**
 * Public-safe fields returned on the agent profile path.
 *
 * Intentionally omits email and phone — PII must never reach the public
 * profile page. Only display_name, photo_url, brokerage, license_number,
 * and slug are exposed (T-05-06).
 */
export interface AgentProfile {
  /** Agent display name — shown in header and page title */
  display_name: string;
  /** Photo URL for the profile avatar; may be null if not set */
  photo_url: string | null;
  /** Brokerage/company name */
  brokerage: string | null;
  /** Real estate license number */
  license_number: string | null;
  /** URL-friendly agent slug */
  slug: string;
  /** Agent's active, publicly-visible listings */
  listings: Listing[];
}

/**
 * Raw D1 row for agent profile fields (public-safe columns only).
 * Never includes email or phone.
 */
interface AgentProfileRow {
  id: string;
  display_name: string;
  photo_url: string | null;
  brokerage: string | null;
  license_number: string | null;
  slug: string;
  /** 0 or 1 — checked to return null immediately if suspended (T-05-07) */
  is_suspended: number;
}

/**
 * Fetch a public agent profile by slug.
 *
 * Returns an AgentProfile with the agent's public-safe identity fields
 * (display_name, photo_url, brokerage, license_number, slug) plus the
 * agent's active, publicly-visible listings (status='active' AND
 * AGENT_VISIBLE_SQL), scoped to that agent, ordered created_at DESC.
 *
 * Returns null when:
 * - No agent row matches the given slug
 * - The matched agent has is_suspended = 1 (T-05-07)
 *
 * PII safety (T-05-06): email and phone are never selected — defense in
 * depth ensures the data layer itself never returns them on this path.
 *
 * SQL injection prevention (T-05-08): slug is bound via prepare().bind(),
 * never concatenated into the query string.
 *
 * @param slug - The URL-friendly agent slug from the /agents/[slug] route
 * @returns AgentProfile with listings, or null if unknown/suspended.
 */
export async function getAgentProfileBySlug(slug: string): Promise<AgentProfile | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    // Step 1: Resolve agent by slug — select only public-safe columns.
    // email and phone are intentionally omitted (T-05-06).
    const agentRow = await db
      .prepare(
        `SELECT id, display_name, photo_url, brokerage, license_number, slug, is_suspended
         FROM agents
         WHERE slug = ?`
      )
      .bind(slug)
      .first<AgentProfileRow>();

    // Unknown slug → 404
    if (!agentRow) return null;

    // Suspended agent → 404 (T-05-07); listings also hidden by AGENT_VISIBLE_SQL
    if (agentRow.is_suspended === 1) return null;

    // Step 2: Fetch agent's active, visible listings (two-query image grouping).
    // Reuses AGENT_VISIBLE_SQL so subscription + suspension gate is consistent.
    const listingRows = await db
      .prepare(
        `SELECT l.id, l.slug, l.address, l.city, l.state, l.zip,
                l.price, l.beds, l.baths, l.sqft, l.description,
                l.video_url, l.created_at, l.featured
         FROM listings l
         JOIN agents a ON l.agent_id = a.id
         WHERE l.agent_id = ?
           AND l.status = 'active'
           AND ${AGENT_VISIBLE_SQL}
         ORDER BY l.created_at DESC`
      )
      .bind(agentRow.id)
      .all<ListingRow>();

    let listings: Listing[] = [];

    if (listingRows.results.length > 0) {
      // Batch-fetch images for all profile listings (two-query grouping)
      const ids = listingRows.results.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const imageRows = await db
        .prepare(
          `SELECT listing_id, url FROM listing_images
           WHERE listing_id IN (${placeholders})
           ORDER BY display_order ASC`
        )
        .bind(...ids)
        .all<ImageRow>();

      // Group images by listing_id using in-memory Map
      const imageMap = new Map<string, string[]>();
      for (const img of imageRows.results) {
        const arr = imageMap.get(img.listing_id) ?? [];
        arr.push(img.url);
        imageMap.set(img.listing_id, arr);
      }

      listings = listingRows.results.map((row) =>
        rowToListing(row, imageMap.get(row.id) ?? [])
      );
    }

    return {
      display_name: agentRow.display_name,
      photo_url: agentRow.photo_url,
      brokerage: agentRow.brokerage,
      license_number: agentRow.license_number,
      slug: agentRow.slug,
      listings,
    };
  } catch (error) {
    console.error(`getAgentProfileBySlug D1 error for "${slug}":`, error);
    return null;
  }
}
