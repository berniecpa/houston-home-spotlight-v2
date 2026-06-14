/**
 * Cron-poller scaffold for AI video job completion (Phase 6).
 *
 * Invoked by the Cloudflare scheduled handler in custom-worker.ts (06-03).
 * Scans video_jobs WHERE status='processing' AND updated_at < unixepoch()-300
 * (stale jobs not updated in the last 5 minutes) and calls each provider's
 * getStatus() to check for completion.
 *
 * SCAFFOLD ONLY — the scan loop body is implemented in plan 06-03.
 * This file must compile cleanly but the loop is intentionally a no-op.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/video/poller
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { VideoEnv } from '@/lib/video/provider';
import { getProviderByName } from '@/lib/video/provider';
import { applyTerminalResult } from '@/lib/video/jobs';

/** Stale-job row columns read from video_jobs (used in 06-03 scan loop). */
interface StaleJobRow {
  id: string;
  provider: 'kie' | 'higgsfield';
  task_id: string;
  listing_id: string;
}

/**
 * Scan stale video_jobs and advance them toward a terminal state.
 *
 * Called by the Cloudflare cron scheduled handler every 5 minutes.
 * "Stale" = status = 'processing' AND updated_at < unixepoch() - 300
 * (not updated in the last 5 minutes — callback may have been missed).
 *
 * TODO (06-03): implement the scan + getStatus loop body referencing
 * getProviderByName and applyTerminalResult.
 *
 * @param env Cloudflare Worker env — provides DB binding + video secrets
 */
export async function pollVideoJobs(env: VideoEnv & { DB: D1Database }): Promise<void> {
  // Scan + write wired in 06-03.
  // The stubs below verify that imports compile and the function signature
  // is stable for the custom-worker.ts scheduled handler integration.

  const _db                  = env.DB;
  const _getProviderByName   = getProviderByName;
  const _applyTerminalResult = applyTerminalResult;

  // Suppress unused-variable errors in strict mode while keeping imports live.
  void _db;
  void _getProviderByName;
  void _applyTerminalResult;

  // Verify StaleJobRow type is sound (referenced in 06-03 loop).
  const _shape: StaleJobRow = {
    id: '',
    provider: 'kie',
    task_id: '',
    listing_id: '',
  };
  void _shape;

  // No-op: scan loop implemented in 06-03.
}
