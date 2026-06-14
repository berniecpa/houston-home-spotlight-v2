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
  isSafeHttpUrl,
  type ListingWriteFields,
} from '@/lib/listings-db';

/** Runtime must be edge for Cloudflare Workers compatibility */
export const runtime = 'edge';

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

  return { uid, listingId, db: db as D1Database };
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
    const { listingId, db } = ownerResult;

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

    // Derive a new slug from the updated title + address
    const derivedSlug = `${(title as string).trim()} ${(address as string).trim()}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
      .slice(0, 100);

    const fields: ListingWriteFields = {
      title: (title as string).trim(),
      slug: derivedSlug,
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
    const { listingId, db } = ownerResult;

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
