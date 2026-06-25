/**
 * Houston-area neighborhood/region definitions for the public /neighborhoods pages.
 *
 * Each area groups the listing `city` values we actually carry inventory in, so
 * an area page filters listings whose `city` is in `cities` (case-insensitive).
 * Cities are assigned to a single area (non-overlapping) so a listing appears on
 * exactly one neighborhood page.
 *
 * Subdivision-level pages are intentionally out of scope for now.
 *
 * @module lib/neighborhoods
 */

/** A browsable region grouping one or more listing cities. */
export interface NeighborhoodArea {
  /** URL slug — /neighborhoods/[slug] */
  slug: string;
  /** Display name shown on the card and area page */
  name: string;
  /** Short marketing blurb */
  blurb: string;
  /** Listing `city` values that belong to this area (matched case-insensitively) */
  cities: string[];
}

/** Ordered areas shown on the homepage and at /neighborhoods. */
export const NEIGHBORHOOD_AREAS: readonly NeighborhoodArea[] = [
  {
    slug: 'houston-inner-loop',
    name: 'Houston & Inner Loop',
    blurb: 'City living close to downtown, the Heights, and the Medical Center.',
    cities: ['Houston'],
  },
  {
    slug: 'katy-cypress',
    name: 'Katy & Cypress',
    blurb: 'Master-planned communities and top schools in northwest Houston.',
    cities: ['Katy', 'Cypress', 'Waller', 'Hockley', 'Brookshire'],
  },
  {
    slug: 'conroe-montgomery',
    name: 'Conroe & Montgomery',
    blurb: 'Lake Conroe living and fast-growing communities to the north.',
    cities: ['Conroe', 'Montgomery', 'Willis', 'Magnolia', 'Pinehurst'],
  },
  {
    slug: 'new-caney-northeast',
    name: 'New Caney & Northeast',
    blurb: 'Affordable new construction along the US-59 / Grand Parkway corridor.',
    cities: ['New Caney', 'Huffman', 'Crosby', 'Cleveland', 'Splendora', 'Porter'],
  },
  {
    slug: 'richmond-sugar-land',
    name: 'Richmond & Sugar Land',
    blurb: 'Established Fort Bend communities in southwest Houston.',
    cities: ['Richmond', 'Sugar Land', 'Missouri City', 'Rosenberg', 'Fulshear', 'Needville'],
  },
  {
    slug: 'pearland-manvel',
    name: 'Pearland & Manvel',
    blurb: 'Family-friendly suburbs south of the city.',
    cities: ['Pearland', 'Manvel', 'Rosharon', 'Alvin', 'Friendswood', 'League City'],
  },
];

const SLUG_TO_AREA: ReadonlyMap<string, NeighborhoodArea> = new Map(
  NEIGHBORHOOD_AREAS.map((a) => [a.slug, a] as const)
);

/**
 * Resolve a neighborhood area by slug.
 * @param slug - URL slug from /neighborhoods/[slug]
 * @returns The matching area, or null when unknown.
 */
export function areaBySlug(slug: string): NeighborhoodArea | null {
  return SLUG_TO_AREA.get(slug) ?? null;
}

/**
 * True when a listing `city` belongs to the given area (case-insensitive, trimmed).
 * @param city - Listing city value
 * @param area - The neighborhood area
 */
export function cityInArea(city: string, area: NeighborhoodArea): boolean {
  const c = city.trim().toLowerCase();
  return area.cities.some((x) => x.toLowerCase() === c);
}
