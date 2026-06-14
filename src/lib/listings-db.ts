/**
 * Listing D1 write helpers — pure parameterized persistence layer.
 *
 * Covers all write-side operations for the listings table and the
 * ordered listing_images child table.  Business gates (ownership,
 * publishability) are the responsibility of the route layer; this
 * module only persists data.
 *
 * Security (STRIDE T-04-06 mitigation):
 *   - Every query uses prepare().bind() — no string concatenation.
 *
 * Security (STRIDE T-04-07 mitigation):
 *   - isSafeHttpUrl() rejects javascript:/data:/file: before insert.
 *
 * @module lib/listings-db
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Returns true only when `raw` parses as a URL with an http(s) scheme.
 * Rejects javascript:/data:/file: and any other scheme so hostile values
 * never reach D1 or an <img src> (T-04-07).
 *
 * Mirrors the identical helper in src/app/api/agent/profile/route.ts.
 */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Editable fields for creating or updating a listing.
 *
 * All fields are optional on update (the route passes only the fields it
 * wants to change); they are required on create (validated by the route
 * before calling createListing).
 */
export interface ListingWriteFields {
  /** Property display title (NOT NULL in schema) */
  title: string;
  /** URL-friendly slug derived from title + address (UNIQUE in schema) */
  slug: string;
  /** Street address (NOT NULL) */
  address: string;
  /** City (NOT NULL, default 'Houston') */
  city: string;
  /** State abbreviation (NOT NULL, default 'TX') */
  state: string;
  /** ZIP code (nullable) */
  zip?: string | null;
  /** Listing price in USD cents or dollars (NOT NULL) */
  price: number;
  /** Bedroom count (NOT NULL) */
  beds: number;
  /** Bathroom count (NOT NULL) */
  baths: number;
  /** Square footage (nullable) */
  sqft?: number | null;
  /** Property description (nullable) */
  description?: string | null;
}

/**
 * Insert a new listing row and its ordered image rows.
 *
 * Steps:
 *   1. INSERT a listings row with status 'active' and id = crypto.randomUUID().
 *   2. INSERT each imageUrl into listing_images with display_order = index.
 *
 * Ownership: the caller must pass the session uid as agentId — this module
 * never derives the agent from a request body.
 *
 * @param db         D1Database binding from Cloudflare Worker env
 * @param agentId    Firebase UID of the owning agent (from verified session)
 * @param fields     Listing metadata fields (route must validate before calling)
 * @param imageUrls  Ordered photo URL array (each must pass isSafeHttpUrl)
 * @returns          The new listing's generated id
 */
export async function createListing(
  db: D1Database,
  agentId: string,
  fields: ListingWriteFields,
  imageUrls: string[]
): Promise<string> {
  const listingId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO listings (
        id, agent_id, title, slug, address, city, state, zip,
        price, beds, baths, sqft, description, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())`
    )
    .bind(
      listingId,
      agentId,
      fields.title,
      fields.slug,
      fields.address,
      fields.city,
      fields.state,
      fields.zip ?? null,
      fields.price,
      fields.beds,
      fields.baths,
      fields.sqft ?? null,
      fields.description ?? null
    )
    .run();

  // Insert ordered images (display_order = array index)
  for (let i = 0; i < imageUrls.length; i++) {
    await db
      .prepare(
        `INSERT INTO listing_images (id, listing_id, url, display_order)
         VALUES (?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), listingId, imageUrls[i], i)
      .run();
  }

  return listingId;
}

/**
 * Update editable columns on an existing listing.
 *
 * The route layer must verify ownership (agent_id = session uid) before
 * calling this function.
 *
 * @param db        D1Database binding
 * @param listingId listings.id of the row to update
 * @param fields    New values for the editable columns
 */
export async function updateListing(
  db: D1Database,
  listingId: string,
  fields: ListingWriteFields
): Promise<void> {
  await db
    .prepare(
      `UPDATE listings
       SET title       = ?,
           slug        = ?,
           address     = ?,
           city        = ?,
           state       = ?,
           zip         = ?,
           price       = ?,
           beds        = ?,
           baths       = ?,
           sqft        = ?,
           description = ?,
           updated_at  = unixepoch()
       WHERE id = ?`
    )
    .bind(
      fields.title,
      fields.slug,
      fields.address,
      fields.city,
      fields.state,
      fields.zip ?? null,
      fields.price,
      fields.beds,
      fields.baths,
      fields.sqft ?? null,
      fields.description ?? null,
      listingId
    )
    .run();
}

/**
 * Replace all images for a listing with a new ordered set.
 *
 * Steps:
 *   1. DELETE all listing_images rows WHERE listing_id = ?
 *   2. INSERT each url with display_order = index
 *
 * The ON DELETE CASCADE on listing_images is for when the parent listing
 * row is deleted; this helper handles image replacement on edits (LIST-06).
 *
 * The route layer must verify ownership before calling this function.
 *
 * @param db        D1Database binding
 * @param listingId listing_images.listing_id to replace
 * @param imageUrls New ordered URL array (each must pass isSafeHttpUrl)
 */
export async function replaceImages(
  db: D1Database,
  listingId: string,
  imageUrls: string[]
): Promise<void> {
  // Delete existing images for this listing
  await db
    .prepare('DELETE FROM listing_images WHERE listing_id = ?')
    .bind(listingId)
    .run();

  // Re-insert with new display_order (LIST-06: ordering preserved on edit)
  for (let i = 0; i < imageUrls.length; i++) {
    await db
      .prepare(
        `INSERT INTO listing_images (id, listing_id, url, display_order)
         VALUES (?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), listingId, imageUrls[i], i)
      .run();
  }
}

/**
 * Delete a listing row from D1.
 *
 * Listing images are automatically removed via ON DELETE CASCADE on the
 * listing_images foreign key.
 *
 * The route layer must verify ownership before calling this function.
 *
 * @param db        D1Database binding
 * @param listingId listings.id to delete
 */
export async function deleteListing(
  db: D1Database,
  listingId: string
): Promise<void> {
  await db
    .prepare('DELETE FROM listings WHERE id = ?')
    .bind(listingId)
    .run();
}

/**
 * Toggle a listing's status between 'active' and 'paused' (LIST-05).
 *
 * The WHERE clause includes agent_id so a rogue caller cannot toggle a
 * listing that does not belong to them even if ownership check is skipped.
 * The route layer still performs the ownership SELECT before calling here.
 *
 * @param db        D1Database binding
 * @param listingId listings.id to update
 * @param agentId   Session uid — must match listings.agent_id
 * @param status    New status value ('active' or 'paused')
 */
export async function setListingStatus(
  db: D1Database,
  listingId: string,
  agentId: string,
  status: 'active' | 'paused'
): Promise<void> {
  await db
    .prepare(
      `UPDATE listings
       SET status     = ?,
           updated_at = unixepoch()
       WHERE id = ? AND agent_id = ?`
    )
    .bind(status, listingId, agentId)
    .run();
}
