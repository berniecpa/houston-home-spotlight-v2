/**
 * Admin Agent List API Route — GET /api/admin/agents
 *
 * Returns a paginated list of all agents for the admin panel.
 *
 * Security (T-05-10 defense in depth):
 *   - requireAdmin() re-verifies decodedToken.admin server-side before any D1 work.
 *   - Missing token → 401; present-but-non-admin → 403.
 *   - This is defense in depth beyond middleware.ts — even if middleware is bypassed,
 *     this route enforces the admin claim.
 *
 * Security (T-05-14):
 *   - Server-side pagination with ADMIN_PAGE_SIZE (25) caps rows per request.
 *   - ?page is coerced to an integer; LIMIT/OFFSET computed and bound via .bind().
 *
 * Response shape:
 *   { success: true, agents: AdminAgentRow[], total: number, page: number, pageSize: number }
 *
 * @module app/api/admin/agents/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import {
  requireAdmin,
  isAdminRejection,
  listAgentsPaginated,
  ADMIN_PAGE_SIZE,
} from '@/lib/admin';

/** Runtime must be edge for Cloudflare Workers compatibility */
export const runtime = 'edge';

/**
 * GET handler — paginated agent list for the admin panel.
 *
 * Query parameters:
 *   - ?page=N  Page number (1-indexed, default 1)
 *
 * @param request - Incoming GET request
 * @returns Paginated agent list with total count, page, and pageSize
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // --- 1. Admin claim re-verification (T-05-10: defense in depth) ---
    const adminResult = await requireAdmin();
    if (isAdminRejection(adminResult)) {
      return NextResponse.json(
        { success: false, message: adminResult.message },
        { status: adminResult.status }
      );
    }

    // --- 2. Parse pagination params ---
    const url = new URL(request.url);
    const pageParam = url.searchParams.get('page');
    // page is 1-indexed; coerce to integer; default to 1 on missing/invalid.
    // WR-03: clamp to [1, MAX_PAGE] so a huge value cannot produce an absurd
    // OFFSET (an out-of-range page just returns an empty result set).
    const MAX_PAGE = 1_000_000;
    const page = Math.min(MAX_PAGE, Math.max(1, parseInt(pageParam ?? '1', 10) || 1));
    const pageSize = ADMIN_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // --- 3. Query D1 ---
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB as unknown as D1Database;

    const { agents, total } = await listAgentsPaginated(db, pageSize, offset);

    // --- 4. Return paginated response ---
    return NextResponse.json({
      success: true,
      agents,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('GET /api/admin/agents error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
