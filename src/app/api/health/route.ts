/**
 * Health Check API Route
 *
 * Returns Workers runtime status and verifies the D1 database binding
 * is available and queryable. Used to confirm the Walking Skeleton
 * end-to-end: Worker process running with D1 reachable.
 *
 * @module app/api/health/route
 */

import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * GET handler for health check
 *
 * Verifies the D1 binding is present and counts tables in sqlite_master.
 * Returns 503 when the DB binding is missing, 500 on unexpected errors.
 *
 * @returns {Promise<NextResponse>} JSON response with ok status, runtime, and d1_tables count
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    if (!db) {
      return NextResponse.json(
        { ok: false, error: 'D1 binding not found' },
        { status: 503 }
      );
    }

    const result = await db
      .prepare("SELECT count(*) as table_count FROM sqlite_master WHERE type='table'")
      .first<{ table_count: number }>();

    return NextResponse.json({
      ok: true,
      runtime: 'cloudflare-workers',
      d1_tables: result?.table_count ?? 0,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
