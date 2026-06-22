/**
 * Agent Listings [id] API — PUT (edit) + DELETE + PATCH (status toggle)
 *
 * PUT    /api/agent/listings/[id] — Edit listing fields and replace images (LIST-02).
 * DELETE /api/agent/listings/[id] — Delete a listing (images cascade, LIST-02).
 * PATCH  /api/agent/listings/[id] — Toggle listing status active/paused (LIST-05).
 *
 * Security (STRIDE T-04-04 mitigation):
 *   - Shared ownership preamble: SELECT agent_id FROM listings WHERE id = ?
 *     Returns 404 if listing absent, 403 if existing.agent_id !== session uid.
 *   - No mutation proceeds without this check.
 *
 * Security (STRIDE T-04-08 mitigation):
 *   - uid derived from getTokens(session cookie) — NEVER from request body.
 *
 * Security (STRIDE T-04-06 mitigation):
 *   - All D1 queries use prepare().bind() — no string concatenation.
 *
 * Security (STRIDE T-05-03 mitigation):
 *   - PUT/DELETE/PATCH check agents.is_suspended for the session uid.
 *   - Suspended agents receive 403 ("Account suspended — contact the administrator.").
 *   - GET remains allowed: suspended agents can view own listings read-only.
 *
 * @module app/api/agent/listings/[id]/route
 */

import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import {
  updateListing,
  replaceImages,
  deleteListing,
  setListingStatus,
  setListingFeatured,
  isSafeHttpUrl,
  type ListingUpdateFields,
} from '@/lib/listings-db';

// No `runtime = 'edge'`: @opennextjs/cloudflare runs routes on the Node.js
// runtime (workerd) and rejects edge-runtime functions during bundling.

/**
 * Shared route context type: Next.js 15 async params.
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Extract the listing id from Next.js 15 async params.
 * Using `const { id } = await params` is the canonical Next.js 15 pattern.
 */
async function getListingId(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  return id;
}

/**
 * Shared ownership preamble result (success path).
 */
interface OwnershipResult {
  uid: string;
  listingId: string;
  db: D1Database;
  /** True when the session token carries the admin custom claim. */
  isAdmin: boolean;
}

/**
 * Shared ownership preamble.
 *
 * Loads the session uid and the listing's agent_id from D1.
 * Returns a NextResponse (401/403/404) when the request should be rejected,
 * or an OwnershipResult when the caller is the verified owner.
 *
 * @param listingId - listings.id from the route segment
 * @returns NextResponse (rejection) | OwnershipResult (success)
 */
async function resolveOwnership(
  listingId: string
): Promise<NextResponse | OwnershipResult> {
  // --- 1. Session authentication (T-04-08) ---
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  if (!tokens) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!tokens.decodedToken.email_verified) {
    return NextResponse.json(
      { success: false, message: 'Email verification required.' },
      { status: 403 }
    );
  }

  const uid = tokens.decodedToken.uid;
  const isAdmin =
    (tokens.decodedToken as unknown as Record<string, unknown>).admin === true;

  // --- 2. D1 context ---
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;

  // --- 3. Ownership check (T-04-04 / LIST-02) ---
  const existing = await (db as D1Database)
    .prepare('SELECT agent_id FROM listings WHERE id = ?')
    .bind(listingId)
    .first<{ agent_id: string }>();

  if (!existing) {
    return NextResponse.json(
      { success: false, message: 'Listing not found.' },
      { status: 404 }
    );
  }

  if (existing.agent_id !== uid) {
    return NextResponse.json(
      { success: false, message: 'Forbidden.' },
      { status: 403 }
    );
  }

  return { uid, listingId, db: db as D1Database, isAdmin };
}

/**
 * Check whether the session agent is suspended (T-05-03).
 *
 * Returns a 403 NextResponse when is_suspended=1, or null when the agent
 * is allowed to proceed. Must be called AFTER resolveOwnership (requires db).
 *
 * @param db  - D1Database binding from the owner result
 * @param uid - Session-derived agent uid (never from body — T-04-08)
 * @returns NextResponse (403) if suspended, null if allowed
 */
async function checkSuspended(
  db: D1Database,
  uid: string
): Promise<NextResponse | null> {
  const row = await db
    .prepare('SELECT is_suspended FROM agents WHERE id = ?')
    .bind(uid)
    .first<{ is_suspended: number }>();

  if (row && row.is_suspended === 1) {
    return NextResponse.json(
      { success: false, message: 'Account suspended — contact the administrator.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Full listing detail row returned by GET (all editable columns).
 */
interface ListingDetailRow {
  id: string;
  title: string;
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
  status: 'active' | 'paused';
  featured: number;
}

/**
 * GET handler — return the owner's full listing detail for the edit form (CR-02).
 *
 * The summary list endpoint (GET /api/agent/listings) returns only a subset of
 * columns, which previously forced the edit form to seed city/state/zip/sqft/
 * description with hardcoded defaults — silently overwriting real data on save.
 * This endpoint returns every editable column plus the ordered image URLs so
 * the form can pre-fill from real values.
 *
 * @param _request - Incoming GET request
 * @param context  - Route context with async params
 * @returns { success: boolean, listing?: {...}, imageUrls?: string[], message?: string }
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const id = await getListingId(params);
    const ownerResult = await resolveOwnership(id);

    if (ownerResult instanceof NextResponse) return ownerResult;
    const { listingId, db } = ownerResult;

    const row = await db
      .prepare(
        `SELECT id, title, slug, address, city, state, zip,
                price, beds, baths, sqft, description, status, featured
         FROM listings
         WHERE id = ?`
      )
      .bind(listingId)
      .first<ListingDetailRow>();

    if (!row) {
      return NextResponse.json(
        { success: false, message: 'Listing not found.' },
        { status: 404 }
      );
    }

    const images = await db
      .prepare(
        `SELECT url FROM listing_images
         WHERE listing_id = ?
         ORDER BY display_order ASC`
      )
      .bind(listingId)
      .all<{ url: string }>();

    return NextResponse.json({
      success: true,
      listing: row,
      imageUrls: images.results.map((r) => r.url),
    });
  } catch (error) {
    console.error('GET /api/agent/listings/[id] error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler — edit listing fields and replace images (LIST-02).
 *
 * Validates required fields and image URLs, then calls updateListing +
 * replaceImages.  Only the verified owner may edit.
 *
 * @param request - Incoming PUT request with JSON body
 * @param context - Route context with async params
 * @returns { success: boolean, message: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const id = await getListingId(params);
    const ownerResult = await resolveOwnership(id);

    if (ownerResult instanceof NextResponse) return ownerResult;
    const { uid, listingId, db, isAdmin } = ownerResult;

    // Suspension gate (T-05-03): suspended agents may not edit listings.
    const suspended = await checkSuspended(db, uid);
    if (suspended) return suspended;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { success: false, message: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    const {
      title,
      address,
      city,
      state,
      zip,
      price,
      beds,
      baths,
      sqft,
      description,
      imageUrls,
      featured,
    } = body as Record<string, unknown>;

    // Validate required string fields
    const stringRequired: [string, unknown][] = [
      ['Title', title],
      ['Address', address],
    ];
    for (const [label, value] of stringRequired) {
      if (typeof value !== 'string' || !value.trim()) {
        return NextResponse.json(
          { success: false, message: `${label} is required.` },
          { status: 400 }
        );
      }
    }

    // Validate numeric fields
    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json(
        { success: false, message: 'Price must be a positive number.' },
        { status: 400 }
      );
    }
    if (typeof beds !== 'number' || beds < 0) {
      return NextResponse.json(
        { success: false, message: 'Beds must be a non-negative number.' },
        { status: 400 }
      );
    }
    if (typeof baths !== 'number' || baths < 0) {
      return NextResponse.json(
        { success: false, message: 'Baths must be a non-negative number.' },
        { status: 400 }
      );
    }

    // Validate imageUrls (T-04-07)
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { success: false, message: 'At least one image URL is required.' },
        { status: 400 }
      );
    }
    for (const url of imageUrls as unknown[]) {
      if (typeof url !== 'string' || !url.trim() || !isSafeHttpUrl(url.trim())) {
        return NextResponse.json(
          { success: false, message: 'All image URLs must be valid http(s) URLs.' },
          { status: 400 }
        );
      }
    }

    // CR-02: do NOT regenerate the slug on edit — the original slug is
    // preserved so the public /listings/[slug] URL never breaks. The slug
    // column is therefore omitted from updateListing entirely.
    const fields: ListingUpdateFields = {
      title: (title as string).trim(),
      address: (address as string).trim(),
      city: typeof city === 'string' && city.trim() ? city.trim() : 'Houston',
      state: typeof state === 'string' && state.trim() ? state.trim() : 'TX',
      zip: typeof zip === 'string' && zip.trim() ? zip.trim() : null,
      price: price as number,
      beds: beds as number,
      baths: baths as number,
      sqft: typeof sqft === 'number' && sqft > 0 ? sqft : null,
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null,
    };

    const sanitizedUrls = (imageUrls as string[]).map((u) => u.trim());

    await updateListing(db, listingId, fields);
    await replaceImages(db, listingId, sanitizedUrls);

    // Featured is admin-only and managed separately so a non-admin edit can
    // never clear or set it. Only apply when an admin explicitly sends the field.
    if (isAdmin && featured !== undefined) {
      await setListingFeatured(
        db,
        listingId,
        featured === 1 || featured === true ? 1 : 0
      );
    }

    return NextResponse.json({ success: true, message: 'Listing updated.' });
  } catch (error) {
    console.error('PUT /api/agent/listings/[id] error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler — delete the owner's listing (images cascade, LIST-02).
 *
 * @param _request - Incoming DELETE request
 * @param context  - Route context with async params
 * @returns { success: boolean, message: string }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const id = await getListingId(params);
    const ownerResult = await resolveOwnership(id);

    if (ownerResult instanceof NextResponse) return ownerResult;
    const { uid, listingId, db } = ownerResult;

    // Suspension gate (T-05-03): suspended agents may not delete listings.
    const suspended = await checkSuspended(db, uid);
    if (suspended) return suspended;

    await deleteListing(db, listingId);

    return NextResponse.json({ success: true, message: 'Listing deleted.' });
  } catch (error) {
    console.error('DELETE /api/agent/listings/[id] error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler — toggle listing status between active and paused (LIST-05).
 *
 * Body: { status: 'active' | 'paused' }
 * Rejects any other status value with 400.
 *
 * @param request - Incoming PATCH request with JSON body
 * @param context - Route context with async params
 * @returns { success: boolean, message: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const id = await getListingId(params);
    const ownerResult = await resolveOwnership(id);

    if (ownerResult instanceof NextResponse) return ownerResult;
    const { uid, listingId, db } = ownerResult;

    // Suspension gate (T-05-03): suspended agents may not toggle listing status.
    const suspended = await checkSuspended(db, uid);
    if (suspended) return suspended;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { success: false, message: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    const { status } = body as Record<string, unknown>;

    // Validate status enum — only 'active' or 'paused' accepted (LIST-05)
    if (status !== 'active' && status !== 'paused') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid status value. Must be "active" or "paused".',
        },
        { status: 400 }
      );
    }

    await setListingStatus(db, listingId, uid, status as 'active' | 'paused');

    return NextResponse.json({
      success: true,
      message: `Listing ${status === 'active' ? 'activated' : 'paused'}.`,
    });
  } catch (error) {
    console.error('PATCH /api/agent/listings/[id] error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
