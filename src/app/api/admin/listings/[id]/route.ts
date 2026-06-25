/**
 * Admin Listing Remove API — DELETE /api/admin/listings/[id]
 *
 * Lets the platform admin remove ANY listing, regardless of owning agent.
 *
 * Security:
 *   - requireAdmin() re-verifies decodedToken.admin server-side (defense in depth);
 *     missing token → 401, non-admin → 403.
 *   - The target listingId comes ONLY from the route segment, never the body.
 *   - deleteListingAsAdmin uses prepare().bind() — no string concatenation.
 *   - listing_images rows cascade via the ON DELETE CASCADE foreign key.
 *
 * No `runtime = 'edge'`: @opennextjs/cloudflare runs routes on the Node.js
 * runtime (workerd) and rejects edge-runtime functions during bundling.
 *
 * @module app/api/admin/listings/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import {
  requireAdmin,
  isAdminRejection,
  deleteListingAsAdmin,
} from '@/lib/admin';

/** Route context with Next.js 15 async params. */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE handler — remove any listing as admin.
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
    // --- 1. Admin claim re-verification (defense in depth) ---
    const adminResult = await requireAdmin();
    if (isAdminRejection(adminResult)) {
      return NextResponse.json(
        { success: false, message: adminResult.message },
        { status: adminResult.status }
      );
    }

    // --- 2. Resolve listingId from route segment (never from body) ---
    const { id: listingId } = await params;
    if (!listingId || typeof listingId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing listing ID in route.' },
        { status: 400 }
      );
    }

    // --- 3. Delete from D1 ---
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB as unknown as D1Database;

    const changed = await deleteListingAsAdmin(db, listingId);

    if (changed === 0) {
      return NextResponse.json(
        { success: false, message: 'Listing not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Listing removed.' });
  } catch (error) {
    console.error('DELETE /api/admin/listings/[id] error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
