/**
 * Admin Platform Stats API Route — GET /api/admin/stats
 *
 * Returns four platform-wide counts for the admin stats page.
 *
 * Security (T-05-10 defense in depth):
 *   - requireAdmin() re-verifies decodedToken.admin server-side before any D1 work.
 *   - Missing token → 401; present-but-non-admin → 403.
 *   - This is defense in depth beyond middleware.ts.
 *
 * Response shape:
 *   {
 *     success: true,
 *     stats: {
 *       totalAgents: number,
 *       activeSubscriptions: number,
 *       totalListings: number,
 *       totalLeads: number
 *     }
 *   }
 *
 * @module app/api/admin/stats/route
 */

import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import {
  requireAdmin,
  isAdminRejection,
  getPlatformStats,
} from '@/lib/admin';

// No `runtime = 'edge'`: @opennextjs/cloudflare runs routes on the Node.js
// runtime (workerd) and rejects edge-runtime functions during bundling.

/**
 * GET handler — platform-wide stats for the admin stats page.
 *
 * @returns Platform counts: totalAgents, activeSubscriptions, totalListings, totalLeads
 */
export async function GET(): Promise<NextResponse> {
  try {
    // --- 1. Admin claim re-verification (T-05-10: defense in depth) ---
    const adminResult = await requireAdmin();
    if (isAdminRejection(adminResult)) {
      return NextResponse.json(
        { success: false, message: adminResult.message },
        { status: adminResult.status }
      );
    }

    // --- 2. Query D1 for platform counts ---
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB as unknown as D1Database;

    const stats = await getPlatformStats(db);

    return NextResponse.json({
      success: true,
      stats: {
        totalAgents: stats.totalAgents,
        activeSubscriptions: stats.activeSubscriptions,
        totalListings: stats.totalListings,
        totalLeads: stats.totalLeads,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
