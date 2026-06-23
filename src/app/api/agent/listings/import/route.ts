/**
 * CSV bulk-import route — POST /api/agent/listings/import
 *
 * Accepts a CSV file upload (multipart FormData field `file`, or raw
 * text/csv body) and bulk-inserts valid rows as active listings owned by
 * the authenticated user's session uid.  Each row is validated independently;
 * a single malformed row reports its own failure and does NOT abort the rest
 * of the import.
 *
 * Security (T-IMP-01 mitigation):
 *   - uid derived from getTokens(session cookie) — agent_id is NEVER read
 *     from the CSV record.
 *
 * Security (T-IMP-02 mitigation):
 *   - Returns 401 when session tokens are absent; 403 when email is not
 *     verified.  Both agents AND admin (Bernard's uid) are accepted here —
 *     no separate requireAdmin branch is needed because admin holds a valid
 *     verified session like any agent.
 *
 * Security (T-IMP-03 mitigation):
 *   - All D1 writes go through createListing (parameterized) and a
 *     parameterized featured UPDATE; no string interpolation in SQL.
 *
 * Security (T-IMP-04 mitigation):
 *   - Image URLs are validated by validateListingRow via isSafeHttpUrl
 *     before reaching D1.
 *
 * No `runtime = 'edge'`: @opennextjs/cloudflare runs routes on the Node.js
 * runtime (workerd) and rejects edge-runtime functions during bundling.
 *
 * @module app/api/agent/listings/import/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { parseCsv, validateListingRow } from '@/lib/csv-import';
import { createListing, makeUniqueSlug } from '@/lib/listings-db';
import {
  getAgentSubscriptionState,
  isAgentPublishable,
} from '@/lib/subscription';
import { limitsForTier } from '@/lib/pricing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a URL-safe slug from a title and address.
 *
 * Mirrors the slugify function in the sibling route.ts; intentionally kept
 * local so neither file has to export an internal helper.
 *
 * @param title   Listing title
 * @param address Street address
 * @returns       URL-safe slug (max 100 chars); falls back to listing-<uuid>
 *                when the combined string contains no ASCII alphanumerics.
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

// ---------------------------------------------------------------------------
// Per-row result types
// ---------------------------------------------------------------------------

/** Successful import result for a single CSV row */
interface RowSuccess {
  row: number;
  success: true;
  id: string;
  slug: string;
}

/** Failed import result for a single CSV row */
interface RowFailure {
  row: number;
  success: false;
  reason: string;
}

/** Union type for a single CSV row's import outcome */
type RowResult = RowSuccess | RowFailure;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

/**
 * POST /api/agent/listings/import
 *
 * Accepts a CSV file (multipart FormData `file` field OR raw text/csv body).
 * Parses each row, validates it, inserts valid rows, and returns a per-row
 * results array.
 *
 * Response shape:
 *   200  { success: true, imported: number, failed: number, results: RowResult[] }
 *   400  { success: false, message: string }
 *   401  { success: false, message: 'Unauthorized' }
 *   403  { success: false, message: 'Email verification required.' }
 *   500  { success: false, message: string }
 *
 * @param request - Incoming POST request (multipart/form-data or text/csv)
 * @returns Response with per-row import results
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // --- 1. Session authentication (T-IMP-02) ---
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

    // T-IMP-01: uid always comes from the verified session token.
    const uid = tokens.decodedToken.uid;

    // --- 2. Read CSV text ---
    let csvText = '';
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { success: false, message: 'Missing file field in form data.' },
          { status: 400 }
        );
      }
      csvText = await (file as Blob).text();
    } else {
      csvText = await request.text();
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { success: false, message: 'Request body is empty.' },
        { status: 400 }
      );
    }

    // --- 3. Parse CSV ---
    const records = parseCsv(csvText);

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, message: 'CSV has no data rows.' },
        { status: 400 }
      );
    }

    // --- 4. Get D1 binding ---
    const { env } = await getCloudflareContext({ async: true });

    // --- 4b. Subscription + tier gates (enforcement) ---
    const isAdmin =
      (tokens.decodedToken as unknown as Record<string, unknown>).admin === true;
    const agentState = await getAgentSubscriptionState(env.DB, uid);

    if (!isAdmin) {
      // Must be publishable (active/grace) to import — mirrors create-listing.
      if (!agentState || !isAgentPublishable(agentState)) {
        return NextResponse.json(
          { success: false, message: 'Active subscription required to import listings.' },
          { status: 403 }
        );
      }
      // Suspended agents may not import.
      const suspended = await env.DB
        .prepare('SELECT is_suspended FROM agents WHERE id = ?')
        .bind(uid)
        .first<{ is_suspended: number }>();
      if (suspended && suspended.is_suspended === 1) {
        return NextResponse.json(
          { success: false, message: 'Account suspended — contact the administrator.' },
          { status: 403 }
        );
      }
    }

    // Tier listing cap: admin = unlimited; unknown tier (null) fails open.
    const limits = isAdmin ? null : limitsForTier(agentState?.subscription_tier ?? null);
    let activeCount = 0;
    if (limits && limits.maxListings !== null) {
      const countRow = await env.DB
        .prepare("SELECT COUNT(*) AS n FROM listings WHERE agent_id = ? AND status = 'active'")
        .bind(uid)
        .first<{ n: number }>();
      activeCount = countRow?.n ?? 0;
    }

    // --- 5. Process rows independently ---
    // taken tracks slugs committed in this batch; DB UNIQUE is the backstop.
    const taken = new Set<string>();
    const results: RowResult[] = [];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i++) {
      const rowIndex = i + 1; // 1-based for human-readable messages
      const record = records[i];

      // 5a. Validate row
      const validation = validateListingRow(record);
      if (!validation.ok) {
        results.push({ row: rowIndex, success: false, reason: validation.reason });
        failed++;
        continue;
      }

      const { fields, imageUrls, featured } = validation;

      // 5b. Image count gate — parity with createListing expectations
      if (imageUrls.length === 0) {
        results.push({
          row: rowIndex,
          success: false,
          reason: 'at least one image URL required',
        });
        failed++;
        continue;
      }

      // 5b-cap. Tier listing cap — stop importing once the active cap is hit.
      if (limits && limits.maxListings !== null && activeCount >= limits.maxListings) {
        results.push({
          row: rowIndex,
          success: false,
          reason: `plan limit of ${limits.maxListings} active listings reached — upgrade to add more`,
        });
        failed++;
        continue;
      }

      // 5c. Derive and deduplicate slug within this batch
      const baseSlug = slugify(fields.title, fields.address);
      const slug = makeUniqueSlug(baseSlug, taken);
      taken.add(slug);

      // 5d. Insert listing via shared helper (T-IMP-03: parameterized)
      try {
        const newId = await createListing(
          env.DB,
          uid,
          { ...fields, slug },
          imageUrls
        );

        // 5e. Set featured flag if requested — admin only (featured = homepage
        // placement; a regular agent can never self-feature via import).
        if (isAdmin && featured === 1) {
          await env.DB.prepare(
            'UPDATE listings SET featured = ? WHERE id = ?'
          )
            .bind(1, newId)
            .run();
        }

        results.push({ row: rowIndex, success: true, id: newId, slug });
        imported++;
        activeCount++;
      } catch (insertErr) {
        console.error(`POST /api/agent/listings/import row ${rowIndex} error:`, insertErr);
        results.push({
          row: rowIndex,
          success: false,
          reason: 'duplicate slug or database error',
        });
        failed++;
      }
    }

    // --- 6. Return per-row results ---
    return NextResponse.json({
      success: true,
      imported,
      failed,
      results,
    });
  } catch (error) {
    console.error('POST /api/agent/listings/import error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
