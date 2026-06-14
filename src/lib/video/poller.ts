/**
 * Cron-poller for AI video job completion (Phase 6, Plan 06-03).
 *
 * Called by the Cloudflare scheduled handler in custom-worker.ts every 5 minutes.
 * Scans video_jobs WHERE status='processing' AND task_id IS NOT NULL AND
 * updated_at < unixepoch()-300 (stale-job guard — avoids racing the callback path
 * on recently-submitted jobs; RESEARCH Pitfall 6, T-06-11).
 *
 * For each stale job:
 *   - status='ready'   → applyTerminalResult (same idempotent path as callback — no double-write)
 *   - status='failed'  → kie→higgsfield failover if within attempt cap (VIDEO-03)
 *   - status=provider  → still processing; leave it for the next scan
 *
 * Each job is wrapped in its own try/catch so a single provider error does not
 * abort the entire scan batch (per-job fault isolation, T-06-03).
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
import { createHiggsAdapter } from '@/lib/video/higgsfield-adapter';
import {
  setTaskId,
  recordAttempt,
  applyTerminalResult,
} from '@/lib/video/jobs';

// ---------------------------------------------------------------------------
// Stale-job row type
// ---------------------------------------------------------------------------

/** Columns read from video_jobs in the stale-scan query. */
interface StaleJobRow {
  id: string;
  provider: 'kie' | 'higgsfield';
  task_id: string;
  listing_id: string;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Failover cap (mirrors VIDEO-03 constraint from RESEARCH)
// ---------------------------------------------------------------------------

/**
 * Maximum Kie.ai attempt count before a stale job is promoted to HiggsField.
 * Set to 2 so a kie job that was submitted (attempts=1) and never completed
 * gets exactly one HiggsField retry before final failure.
 */
const KIE_ATTEMPT_CAP = 2;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scan stale processing video_jobs and advance them toward a terminal state.
 *
 * Called every 5 minutes by the Cloudflare cron scheduled handler via
 * ctx.waitUntil(pollVideoJobs(env)) in custom-worker.ts.
 *
 * "Stale" = status='processing' AND task_id IS NOT NULL AND
 *            updated_at < unixepoch() - 300.
 *
 * The `AND task_id IS NOT NULL` guard skips jobs where the provider submission
 * is still in flight (task_id is written after the HTTP round-trip).
 *
 * The `AND updated_at < unixepoch() - 300` stale guard skips jobs recently
 * submitted to avoid racing the callback path (Pitfall 6, T-06-11).
 *
 * Idempotency: applyTerminalResult is guarded by AND status='processing' so
 * a job already advanced by the callback is a clean no-op (T-06-03, VIDEO-04).
 *
 * @param env Cloudflare Worker env — provides DB binding + video secrets
 */
export async function pollVideoJobs(env: VideoEnv & { DB: D1Database }): Promise<void> {
  const db = env.DB;

  // Scan stale processing jobs (Pitfall 6: updated_at < unixepoch() - 300)
  const { results: staleJobs } = await db
    .prepare(
      `SELECT id, provider, task_id, listing_id, attempts
       FROM video_jobs
       WHERE status = 'processing'
         AND task_id IS NOT NULL
         AND updated_at < unixepoch() - 300`
    )
    .all<StaleJobRow>();

  // Per-job fault isolation: one provider error must not abort the whole scan
  for (const job of staleJobs) {
    try {
      await processStaleJob(db, env, job);
    } catch (err) {
      console.error(`[poller] failed to process job ${job.id}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-job processing logic
// ---------------------------------------------------------------------------

/**
 * Poll a single stale job for provider status and apply the appropriate action.
 *
 * @param db   D1Database binding
 * @param env  Cloudflare Worker env with video secrets
 * @param job  Stale job row from the scan query
 */
async function processStaleJob(
  db: D1Database,
  env: VideoEnv,
  job: StaleJobRow
): Promise<void> {
  // Resolve the appropriate provider adapter by name
  const adapter = getProviderByName(job.provider, env);
  const result = await adapter.getStatus(job.task_id);

  if (result.status === 'ready' && result.videoUrl) {
    // Terminal success: converge on the same idempotent write path as the callback
    // (applyTerminalResult guards with AND status='processing' — no double-write)
    await applyTerminalResult(db, job.task_id, {
      status: 'ready',
      videoUrl: result.videoUrl,
    });
    return;
  }

  if (result.status === 'failed') {
    // Kie.ai failure with attempt cap not yet exhausted → failover to HiggsField
    if (job.provider === 'kie' && job.attempts < KIE_ATTEMPT_CAP) {
      await failoverToHiggsfield(db, env, job);
      return;
    }

    // Already on HiggsField or attempts exhausted → terminal failure
    await applyTerminalResult(db, job.task_id, {
      status: 'failed',
      error: `Provider ${job.provider} reported failed after ${job.attempts} attempt(s)`,
    });
    return;
  }

  // status === 'processing': job is still running — leave it; next scan re-checks
}

/**
 * Attempt a HiggsField failover for a stale Kie.ai job that reported failed.
 *
 * Submits the job to HiggsField, records the new task_id and incremented
 * attempt count, then leaves status='processing' for the next cron scan
 * (HiggsField completion is poller-only — no webhook — so the scan re-checks
 * the HiggsField status on the subsequent cron run).
 *
 * If the HiggsField submission itself fails, applies a terminal failure
 * immediately.
 *
 * VIDEO-03: records provider='higgsfield' and attempts+1 via recordAttempt.
 *
 * @param db   D1Database binding
 * @param env  Cloudflare Worker env with video secrets
 * @param job  The stale Kie.ai job to fail over
 */
async function failoverToHiggsfield(
  db: D1Database,
  env: VideoEnv,
  job: StaleJobRow
): Promise<void> {
  const higgsAdapter = createHiggsAdapter(env.HIGGSFIELD_API_KEY);

  // We do not have the original imageUrl stored in video_jobs; the poller
  // cannot re-submit a new job. Instead, re-read the listing's hero image
  // from D1 to get the original photo URL for the fallover submission.
  const listing = await db
    .prepare(`SELECT image_urls FROM listings WHERE id = ?`)
    .bind(job.listing_id)
    .first<{ image_urls: string | null }>();

  // If the listing has no image_urls, fail the job terminally
  if (!listing?.image_urls) {
    await applyTerminalResult(db, job.task_id, {
      status: 'failed',
      error: 'HiggsField failover: no image_urls available on listing for resubmission',
    });
    return;
  }

  // Parse the first image URL (same hero-photo convention as the trigger route)
  let imageUrl: string;
  try {
    const urls = JSON.parse(listing.image_urls) as string[];
    const first = urls[0];
    if (!first) throw new Error('empty image_urls array');
    imageUrl = first;
  } catch {
    await applyTerminalResult(db, job.task_id, {
      status: 'failed',
      error: 'HiggsField failover: could not parse image_urls on listing',
    });
    return;
  }

  try {
    // Submit to HiggsField (no callbackUrl — poller-only completion per RESEARCH A3)
    const newTaskId = await higgsAdapter.submit(imageUrl, '');

    // Record the new provider-assigned task_id (replaces the kie taskId in D1)
    await setTaskId(db, job.id, newTaskId);

    // Record the failover attempt: provider='higgsfield', attempts+1 (VIDEO-03)
    await recordAttempt(db, job.id, 'higgsfield', job.attempts + 1);

    // Leave status='processing' — the next cron scan will pick up the new task_id
    // (the new task_id is now stored on the same job row; the scan re-checks it)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // HiggsField submission failed — terminal failure
    await applyTerminalResult(db, job.task_id, {
      status: 'failed',
      error: `HiggsField failover submit failed: ${msg}`,
    });
  }
}
