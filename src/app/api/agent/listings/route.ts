/**
 * Agent Listings API — GET (list own) + POST (create)
 *
 * GET  /api/agent/listings — Returns the calling agent's own listings
 *                            ordered by created_at DESC (dashboard table, LIST-08).
 *
 * POST /api/agent/listings — Creates a new listing with ordered photo URLs.
 *                            Gated on isAgentPublishable (LIST-03).
 *
 * Security (STRIDE T-04-08 mitigation):
 *   - uid derived from getTokens(session cookie) — NEVER from request body.
 *
 * Security (STRIDE T-04-06 mitigation):
 *   - All D1 queries use prepare().bind() — no string concatenation.
 *
 * Security (STRIDE T-04-05 mitigation):
 *   - POST gated on isAgentPublishable — lapsed/none agents receive 403.
 *
 * Security (STRIDE T-05-03 mitigation):
 *   - POST additionally gated on is_suspended — suspended agents receive 403.
 *   - GET remains allowed: suspended agents can still view their own listings (read-only).
 *
 * Security (STRIDE T-04-07 mitigation):
 *   - Photo URLs validated via isSafeHttpUrl before persisting.
 *
 * @module app/api/agent/listings/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import {
  getAgentSubscriptionState,
  isAgentPublishable,
} from '@/lib/subscription';
import {
  createListing,
  isSafeHttpUrl,
  type ListingWriteFields,
} from '@/lib/listings-db';
import { limitsForTier } from '@/lib/pricing';

// No `runtime = 'edge'`: @opennextjs/cloudflare runs routes on the Node.js
// runtime (workerd) and rejects edge-runtime functions during bundling.

/**
 * Derive a URL-safe slug from a title and address.
 * Lower-cases, strips non-alphanumeric characters, joins with hyphens.
 * Truncates to 100 characters to avoid D1 index issues.
 *
 * WR-06: titles/addresses consisting solely of non-ASCII characters
 * (CJK, emoji, Cyrillic) collapse to an empty string after the strip/trim.
 * When that happens we fall back to `listing-<random>` so we never insert an
 * empty slug (which would collide on the next empty-slug listing and return a
 * confusing 409).
 */
function slugify(title: string, address: string): string {
  const combined = `${title} ${address}`;
  const base = combined
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 100);

  if (!base) {
    return `listing-${crypto.randomUUID().slice(0, 8)}`;
  }
  return base;
}

/**
 * GET handler — return the calling agent's own listings (LIST-08).
 *
 * Returns id, title, slug, address, price, beds, baths, status, created_at
 * for the dashboard listings table.  Ordered newest-first.
 *
 * @returns { success: boolean, listings: OwnListing[] }
 */
export async function GET(): Promise<NextResponse> {
  try {
    // --- 1. Session authentication (T-04-08: uid from session, not body) ---
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

    // --- 2. Query agent's own listings from D1 ---
    const { env } = await getCloudflareContext({ async: true });

    const result = await env.DB.prepare(
      `SELECT id, title, slug, address, price, beds, baths, status, created_at, featured
       FROM listings
       WHERE agent_id = ?
       ORDER BY created_at DESC`
    )
      .bind(uid)
      .all<{
        id: string;
        title: string;
        slug: string;
        address: string;
        price: number;
        beds: number;
        baths: number;
        status: string;
        created_at: number;
        featured: number;
      }>();

    return NextResponse.json({
      success: true,
      listings: result.results,
    });
  } catch (error) {
    console.error('GET /api/agent/listings error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST handler — create a listing for a publishable agent (LIST-01, LIST-03).
 *
 * Steps:
 *   1. Verify session; reject 401/403 on missing/unverified.
 *   2. Parse and validate body (required fields + non-empty http(s) imageUrls).
 *   3. Check agent publishability; reject 403 if lapsed/none.
 *   4. Derive slug; reject 409 if it already exists in D1.
 *   5. Call createListing — inserts listing + ordered image rows.
 *   6. Return 201 { success: true, id, slug }.
 *
 * @param request - Incoming POST request with JSON body
 * @returns { success: boolean, id?: string, slug?: string, message: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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
    // Admin custom claim — only admins may set the homepage `featured` flag.
    const isAdmin =
      (tokens.decodedToken as unknown as Record<string, unknown>).admin === true;

    // --- 2. Parse request body ---
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
      homebuilder,
      incentives,
      sourceUrl,
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

    // Validate required numeric fields
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

    // Validate imageUrls — at least one required, all must be http(s) (T-04-07)
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

    const { env } = await getCloudflareContext({ async: true });

    // --- 3. Publishability gate (T-04-05 / LIST-03) ---
    const agentState = await getAgentSubscriptionState(env.DB, uid);
    if (!agentState || !isAgentPublishable(agentState)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Active subscription required to create listings.',
        },
        { status: 403 }
      );
    }

    // --- 3b. Suspension gate (T-05-03 / ADMIN-02) ---
    // Suspended agents may not create new listings. Read is_suspended from D1
    // for the session uid — never from the request body.
    const suspendedRow = await env.DB.prepare(
      'SELECT is_suspended FROM agents WHERE id = ?'
    )
      .bind(uid)
      .first<{ is_suspended: number }>();

    if (suspendedRow && suspendedRow.is_suspended === 1) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account suspended — contact the administrator.',
        },
        { status: 403 }
      );
    }

    // --- 3c. Tier listing cap (enforcement) ---
    // Admin bypasses; an unknown tier (null) fails open (no cap) so a paying
    // agent is never locked out. Counts the agent's currently-active listings.
    if (agentState.is_admin !== 1) {
      const limits = limitsForTier(agentState.subscription_tier);
      if (limits && limits.maxListings !== null) {
        const countRow = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM listings WHERE agent_id = ? AND status = 'active'"
        )
          .bind(uid)
          .first<{ n: number }>();
        if ((countRow?.n ?? 0) >= limits.maxListings) {
          return NextResponse.json(
            {
              success: false,
              message: `Your plan allows up to ${limits.maxListings} active listings. Upgrade your plan to add more.`,
            },
            { status: 403 }
          );
        }
      }
    }

    // --- 3d. Optional source/authority URL must be http(s) when provided. ---
    if (
      typeof sourceUrl === 'string' &&
      sourceUrl.trim() &&
      !isSafeHttpUrl(sourceUrl.trim())
    ) {
      return NextResponse.json(
        { success: false, message: 'Source URL must be a valid http(s) URL.' },
        { status: 400 }
      );
    }

    // --- 3e. Duplicate guard: reject a second ACTIVE listing at the same
    // normalized address + ZIP so the same home is not posted twice. ---
    const normAddress = (address as string).trim().toLowerCase();
    const normZip = typeof zip === 'string' ? zip.trim() : '';
    const dupe = await env.DB.prepare(
      "SELECT id FROM listings WHERE lower(trim(address)) = ? AND coalesce(trim(zip),'') = ? AND status = 'active'"
    )
      .bind(normAddress, normZip)
      .first<{ id: string }>();
    if (dupe) {
      return NextResponse.json(
        { success: false, message: 'An active listing already exists at this address.' },
        { status: 409 }
      );
    }

    // --- 4. Derive slug and check for UNIQUE collision ---
    const derivedSlug = slugify(
      (title as string).trim(),
      (address as string).trim()
    );

    const existingSlug = await env.DB.prepare(
      'SELECT id FROM listings WHERE slug = ?'
    )
      .bind(derivedSlug)
      .first<{ id: string }>();

    if (existingSlug) {
      return NextResponse.json(
        {
          success: false,
          message:
            'A listing with a similar title and address already exists. Please use a more specific title.',
        },
        { status: 409 }
      );
    }

    // --- 5. Build validated fields and call createListing ---
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
      homebuilder:
        typeof homebuilder === 'string' && homebuilder.trim() ? homebuilder.trim() : null,
      incentives:
        typeof incentives === 'string' && incentives.trim() ? incentives.trim() : null,
      sourceUrl:
        typeof sourceUrl === 'string' && sourceUrl.trim() ? sourceUrl.trim() : null,
      // Featured is admin-only: ignore the field entirely for non-admins.
      featured: isAdmin && (featured === 1 || featured === true) ? 1 : 0,
    };

    const sanitizedImageUrls = (imageUrls as string[]).map((u) => u.trim());

    const newId = await createListing(env.DB, uid, fields, sanitizedImageUrls);

    return NextResponse.json(
      { success: true, id: newId, slug: derivedSlug },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/agent/listings error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
