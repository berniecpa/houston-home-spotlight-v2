/**
 * Agent Profile PATCH API Route
 *
 * PATCH /api/agent/profile — Updates the agent's profile fields in D1
 * and generates/refreshes the agent slug from display_name (ADMIN-04).
 *
 * Security (STRIDE T-02-12 mitigation):
 *   - uid derived from getTokens(session cookie) — NEVER from request body
 *   - WHERE id = sessionUid only — no cross-agent writes possible
 *   - Slug is keyed off the session uid, never a body-supplied id (T-05-04)
 *
 * Security (T-02-13 mitigation):
 *   - All field values bound via D1 prepare().bind() — no string concatenation
 *
 * Security (T-05-05 mitigation):
 *   - Slug uniqueness enforced via UNIQUE constraint on agents.slug
 *   - Collision resolved with numeric suffix loop excluding caller's own row
 *
 * Validation (CLAUDE.md "validate input at system boundaries"):
 *   - All five profile fields must be non-empty strings
 *   - Returns 400 with { success: false, message } on missing fields
 *   - Returns 401 when session is missing or invalid
 *
 * @module app/api/agent/profile/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';

/** Runtime must be edge for Cloudflare Workers compatibility */
export const runtime = 'edge';

/**
 * Returns true only when `raw` parses as a URL with an http(s) scheme.
 * Rejects javascript:/data:/file: and any other scheme so hostile values
 * never reach D1 or an `<img src>` (CR-01).
 */
function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Derive a URL-safe slug from an agent's display name.
 *
 * Mirrors the listings slugify WR-06 pattern:
 *   1. Lowercase the input.
 *   2. Strip all non-alphanumeric characters (keeping existing hyphens).
 *   3. Collapse consecutive whitespace/hyphens into a single hyphen.
 *   4. Trim leading/trailing hyphens.
 *   5. Truncate to 80 characters to avoid D1 index issues.
 *   6. Fall back to `agent-<random8>` when the result is empty (e.g. CJK-only names).
 *
 * Collision resolution (numeric suffix) is performed at the call site, not here.
 *
 * @param displayName - The agent's display_name field value
 * @returns A URL-safe base slug (without collision suffix)
 */
export function slugifyName(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  if (!base) {
    return `agent-${crypto.randomUUID().slice(0, 8)}`;
  }
  return base;
}

/** Expected request body shape */
interface ProfilePatchBody {
  display_name: string;
  photo_url: string;
  phone: string;
  brokerage: string;
  license_number: string;
}

/**
 * PATCH handler — update agent profile fields in D1.
 *
 * Derives uid from session cookie (T-02-12: never trusts body-supplied uid).
 * Validates all five required fields at the boundary.
 * Updates agents row via parameterized D1 query (T-02-13).
 *
 * @param request - Incoming PATCH request with JSON body
 * @returns {Promise<NextResponse>} { success: boolean, message: string }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // --- 1. Session authentication (T-02-12: uid from session, not body) ---
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);

    if (!tokens) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // WR-03: reject unverified tokens — only verified agents may write profile data.
    if (!tokens.decodedToken.email_verified) {
      return NextResponse.json(
        { success: false, message: 'Please verify your email before updating your profile.' },
        { status: 403 }
      );
    }

    const uid = tokens.decodedToken.uid;

    // --- 2. Parse and validate request body ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { success: false, message: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }

    const {
      display_name,
      photo_url,
      phone,
      brokerage,
      license_number,
    } = body as Record<string, unknown>;

    // Validate each required field (CLAUDE.md: validate at system boundaries)
    const requiredFields: [string, unknown][] = [
      ['Full name', display_name],
      ['Photo URL', photo_url],
      ['Phone', phone],
      ['Brokerage', brokerage],
      ['License number', license_number],
    ];

    for (const [label, value] of requiredFields) {
      if (typeof value !== 'string' || !value.trim()) {
        return NextResponse.json(
          { success: false, message: `${label} is required.` },
          { status: 400 }
        );
      }
    }

    // Enforce an http(s) scheme allow-list on photo_url before persisting (CR-01).
    // React does not sanitize `src`, so reject javascript:/data: URLs here.
    if (!isSafeHttpUrl((photo_url as string).trim())) {
      return NextResponse.json(
        { success: false, message: 'Photo URL must be a valid http(s) URL.' },
        { status: 400 }
      );
    }

    // Type assertion is safe: all fields passed validation above
    const validated = body as ProfilePatchBody;

    // --- 3. Generate/refresh agent slug from display_name (ADMIN-04, T-05-04) ---
    // Slug is always derived server-side from the session uid's display_name.
    // NEVER use a body-supplied slug or uid (T-05-04 spoofing mitigation).
    const { env } = await getCloudflareContext({ async: true });

    const baseSlug = slugifyName(validated.display_name.trim());

    // Resolve UNIQUE collision with numeric suffix: jane-smith, jane-smith-2, jane-smith-3 ...
    // Exclude the caller's own row so re-saving the same name keeps the same slug (T-05-05).
    let resolvedSlug = baseSlug;
    let suffix = 2;
    while (true) {
      const collision = await env.DB.prepare(
        'SELECT id FROM agents WHERE slug = ? AND id != ?'
      )
        .bind(resolvedSlug, uid)
        .first<{ id: string }>();

      if (!collision) break;

      resolvedSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    // --- 4. Write to D1 (T-02-13: parameterized — no string concatenation) ---
    const result = await env.DB.prepare(
      `UPDATE agents
       SET display_name    = ?,
           photo_url       = ?,
           phone           = ?,
           brokerage       = ?,
           license_number  = ?,
           slug            = ?,
           updated_at      = unixepoch()
       WHERE id = ?`
    )
      .bind(
        validated.display_name.trim(),
        validated.photo_url.trim(),
        validated.phone.trim(),
        validated.brokerage.trim(),
        validated.license_number.trim(),
        resolvedSlug,
        uid
      )
      .run();

    // WR-03: if no row matched, the agent record was never upserted. Report the
    // failure instead of silently claiming success (which would lose the data).
    if (!result.meta || result.meta.changes === 0) {
      return NextResponse.json(
        { success: false, message: 'Profile record not found. Please sign in again.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: 'Profile updated.', slug: resolvedSlug });
  } catch (error) {
    console.error('PATCH /api/agent/profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
