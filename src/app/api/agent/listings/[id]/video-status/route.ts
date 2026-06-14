/**
 * Agent Video Status — GET /api/agent/listings/[id]/video-status
 *
 * Returns the current video job status and video URL for the agent's own listing.
 * Polled by the dashboard every 3-5 seconds during generation (VIDEO-02/03).
 *
 * Security mitigations:
 *   T-06-08 (Information Disclosure — status leaking other agents' jobs):
 *     Full ownership preamble (401/403/404) before any D1 read — only the
 *     authenticated owner of the listing may read its video status (ASVS V4).
 *
 * @module app/api/agent/listings/[id]/video-status/route
 */

import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';

/** Runtime must be edge for Cloudflare Workers compatibility */
export const runtime = 'edge';

/**
 * Route context: Next.js 15 async params.
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Ownership preamble result (success path).
 */
interface OwnershipResult {
  uid: string;
  listingId: string;
  db: D1Database;
}

/**
 * Ownership preamble — mirrors the pattern from [id]/route.ts.
 *
 * Returns a NextResponse rejection (401/403/404) or an OwnershipResult.
 *
 * @param listingId - listings.id from the route segment
 */
async function resolveOwnership(
  listingId: string
): Promise<NextResponse | OwnershipResult> {
  // Session authentication — uid from cookie, never from body (T-04-08)
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

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;

  // Ownership check (T-06-08)
  const existing = await db
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

  return { uid, listingId, db };
}

/** Latest video_jobs row fields relevant to status polling. */
interface VideoJobStatusRow {
  status: string;
  task_id: string | null;
}

/** listings columns needed for the status response. */
interface ListingVideoRow {
  video_status: string | null;
  video_url: string | null;
}

/**
 * GET handler — return the current video job status and video URL.
 *
 * Queries the latest video_jobs row (ORDER BY updated_at DESC LIMIT 1) plus
 * listings.video_url / video_status. Returns:
 *   { status: string, videoUrl: string | null }
 *
 * When no job row exists, falls back to listings.video_status (or 'none').
 *
 * @param _request - Incoming GET request
 * @param context  - Route context with async params
 * @returns { status, videoUrl } | 401 | 403 | 404 | 500
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id: listingId } = await params;

    // Ownership preamble (T-06-08) — must pass before any data read
    const ownerResult = await resolveOwnership(listingId);
    if (ownerResult instanceof NextResponse) return ownerResult;
    const { db } = ownerResult;

    // Fetch the latest job row for this listing
    const jobRow = await db
      .prepare(
        `SELECT status, task_id
         FROM video_jobs
         WHERE listing_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .bind(listingId)
      .first<VideoJobStatusRow>();

    // Fetch video_url and video_status from the listings table
    const listingRow = await db
      .prepare(
        `SELECT video_status, video_url FROM listings WHERE id = ?`
      )
      .bind(listingId)
      .first<ListingVideoRow>();

    // WR-04: only expose video_url when the effective status is 'ready'.
    // Otherwise a previously-ready listing whose latest generation fails (or is
    // still processing) would return { status: 'failed', videoUrl: <old url> },
    // and the dashboard would surface a stale "View video" link.
    const persistedUrl = listingRow?.video_url ?? null;

    if (!jobRow) {
      // No job has been submitted yet — fall back to listings.video_status
      const status = listingRow?.video_status ?? 'none';
      return NextResponse.json({
        status,
        videoUrl: status === 'ready' ? persistedUrl : null,
      });
    }

    return NextResponse.json({
      status: jobRow.status,
      videoUrl: jobRow.status === 'ready' ? persistedUrl : null,
    });
  } catch (error) {
    console.error('GET /api/agent/listings/[id]/video-status error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
