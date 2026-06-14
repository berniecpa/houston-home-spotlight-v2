/**
 * All Listings Page (Server Component)
 *
 * Fetches all public D1 listings per request (force-dynamic) with the
 * subscription gate applied, then passes them to ListingsClient for
 * client-side filter rendering.
 *
 * @module app/listings/page
 */

export const dynamic = 'force-dynamic';

import { getAllListings } from '@/lib/data';
import ListingsClient from './ListingsClient';

/**
 * Listings Page Server Component
 *
 * Reads from Cloudflare D1 via getAllListings (subscription-gated) and
 * delegates all filter UI to the ListingsClient component.
 *
 * @returns {Promise<JSX.Element>} The listings page shell with pre-fetched listings
 */
export default async function ListingsPage(): Promise<JSX.Element> {
  const listings = await getAllListings();
  return <ListingsClient initialListings={listings} />;
}
