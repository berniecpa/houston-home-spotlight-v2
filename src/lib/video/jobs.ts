/**
 * D1 job-state helpers for the video_jobs table (Phase 6).
 *
 * All writes use prepare().bind() — no string concatenation in SQL value
 * positions (T-06-02, ASVS V5). Provider video URLs are validated via
 * isSafeHttpUrl before any listings write (T-06-02).
 *
 * Idempotency (T-06-03): applyTerminalResult guards every UPDATE with
 * `AND status = 'processing'` so a replayed callback is a clean no-op.
 *
 * @module lib/video/jobs
 */

import type { D1Database } from '@cloudflare/workers-types';
import { isSafeHttpUrl } from '@/lib/listings-db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Columns returned by findActiveJob. */
export interface ActiveJobRow {
  id: string;
  status: string;
  task_id: string | null;
}

/** Outcome of a terminal write (T-06-03 idempotency). */
export interface TerminalWriteResult {
  /** true when the UPDATE changed a row; false if already terminal (no-op). */
  applied: boolean;
}

/** Outcome shapes for applyTerminalResult. */
export type TerminalOutcome =
  | { status: 'ready'; videoUrl: string }
  | { status: 'failed'; error?: string };

// ---------------------------------------------------------------------------
// Job helpers
// ---------------------------------------------------------------------------

/**
 * Return the first active (queued or processing) video job for a listing.
 *
 * Used as the DEDUP gate — if a row is returned the caller should return the
 * existing job rather than spawning a new one (VIDEO-04).
 *
 * @param db        D1Database binding from CloudflareEnv
 * @param listingId listings.id to check
 */
export async function findActiveJob(
  db: D1Database,
  listingId: string
): Promise<ActiveJobRow | null> {
  return db
    .prepare(
      `SELECT id, status, task_id
       FROM video_jobs
       WHERE listing_id = ? AND status IN ('queued', 'processing')
       LIMIT 1`
    )
    .bind(listingId)
    .first<ActiveJobRow>();
}

/**
 * Insert a new video_jobs row in 'processing' status.
 *
 * The caller must have already run findActiveJob and confirmed no active job
 * exists for this listing (VIDEO-04 dedup).
 *
 * @param db        D1Database binding
 * @param job       New job fields (caller supplies generated id)
 */
export async function insertJob(
  db: D1Database,
  job: { id: string; listingId: string; agentId: string; provider: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO video_jobs
         (id, listing_id, agent_id, provider, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'processing', 1, unixepoch(), unixepoch())`
    )
    .bind(job.id, job.listingId, job.agentId, job.provider)
    .run();
}

/**
 * Record the provider-assigned task_id after a successful submission.
 *
 * Called once the provider HTTP call returns so the callback / poller can
 * look up the job by task_id.
 *
 * @param db     D1Database binding
 * @param jobId  video_jobs.id of the row to update
 * @param taskId Provider-returned task identifier (Kie.ai taskId or HiggsField request_id)
 */
export async function setTaskId(
  db: D1Database,
  jobId: string,
  taskId: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE video_jobs
       SET task_id    = ?,
           updated_at = unixepoch()
       WHERE id = ?`
    )
    .bind(taskId, jobId)
    .run();
}

/**
 * Record a provider attempt on the job row (VIDEO-03 attempt tracking).
 *
 * Called when a submission attempt completes (success or failure) to update
 * which provider was used and how many attempts have been made.
 *
 * @param db       D1Database binding
 * @param jobId    video_jobs.id
 * @param provider Provider name ('kie' | 'higgsfield')
 * @param attempts Total attempt count so far
 * @param error    Optional error message from the failed attempt
 */
export async function recordAttempt(
  db: D1Database,
  jobId: string,
  provider: string,
  attempts: number,
  error?: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE video_jobs
       SET provider   = ?,
           attempts   = ?,
           error      = ?,
           updated_at = unixepoch()
       WHERE id = ?`
    )
    .bind(provider, attempts, error ?? null, jobId)
    .run();
}

/** Outcome of an atomic failover transition (CR-02 / WR-07). */
export interface FailoverWriteResult {
  /** true when the row transitioned to the new provider/task_id atomically. */
  applied: boolean;
  /**
   * Set when the UPDATE was rejected by the task_id UNIQUE constraint — the
   * caller must finalize the job as failed rather than leave it wedged in
   * 'processing' (WR-07).
   */
  taskIdCollision?: boolean;
}

/**
 * Atomically transition a still-processing job onto the failover provider.
 *
 * CR-02 / WR-07: the kie→higgsfield failover must swap provider, task_id and
 * attempts in a SINGLE guarded statement so:
 *   - the original Kie task_id is replaced atomically — a late Kie callback for
 *     the old task_id then matches NO processing row and is a clean no-op
 *     (applyTerminalResult's WHERE task_id=? AND status='processing' guard);
 *   - there is never a crash window where task_id points at HiggsField while
 *     provider still reads 'kie' (the old two-write setTaskId+recordAttempt bug);
 *   - the monotonic processing→terminal invariant the replay defense relies on
 *     is preserved (the job is never returned to processing under a new id by a
 *     non-atomic sequence).
 *
 * The UPDATE is guarded by `WHERE id=? AND status='processing'` so a job that
 * was already advanced to a terminal state (by a callback) is not resurrected.
 *
 * If the new task_id collides with another row's UNIQUE task_id the UPDATE
 * throws; this is caught and surfaced as `{ applied:false, taskIdCollision:true }`
 * so the caller can fail the job terminally instead of wedging it (WR-07).
 *
 * @param db          D1Database binding
 * @param jobId       video_jobs.id of the row to transition
 * @param newProvider Failover provider name (e.g. 'higgsfield')
 * @param newTaskId   Provider-assigned task identifier for the failover attempt
 * @param attempts    New total attempt count
 */
export async function failoverProviderAtomic(
  db: D1Database,
  jobId: string,
  newProvider: string,
  newTaskId: string,
  attempts: number
): Promise<FailoverWriteResult> {
  try {
    const result = await db
      .prepare(
        `UPDATE video_jobs
         SET provider   = ?,
             task_id    = ?,
             attempts   = ?,
             error      = NULL,
             updated_at = unixepoch()
         WHERE id = ? AND status = 'processing'`
      )
      .bind(newProvider, newTaskId, attempts, jobId)
      .run();

    return { applied: result.meta.changes > 0 };
  } catch (err) {
    // task_id UNIQUE collision (or other constraint failure) — surface so the
    // caller finalizes the job as failed rather than leaving it stuck (WR-07).
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg) || /constraint/i.test(msg)) {
      return { applied: false, taskIdCollision: true };
    }
    throw err;
  }
}

/**
 * Finalize a still-processing job as failed by its job id (CR-02 / WR-07).
 *
 * Unlike applyTerminalResult (which keys on task_id), this keys on the job's
 * primary key, so it works even when the failover task_id swap could not be
 * applied. Guarded by `AND status='processing'` to preserve idempotency — a
 * job already terminal is a clean no-op and a 'ready' job is never resurrected.
 *
 * @param db     D1Database binding
 * @param jobId  video_jobs.id of the row to fail
 * @param error  Failure reason to persist on the job and reflect on the listing
 */
export async function failJobById(
  db: D1Database,
  jobId: string,
  error: string
): Promise<TerminalWriteResult> {
  const updateResult = await db
    .prepare(
      `UPDATE video_jobs
       SET status     = 'failed',
           error      = ?,
           updated_at = unixepoch()
       WHERE id = ? AND status = 'processing'`
    )
    .bind(error, jobId)
    .run();

  if (updateResult.meta.changes === 0) {
    return { applied: false };
  }

  const job = await db
    .prepare(`SELECT listing_id FROM video_jobs WHERE id = ?`)
    .bind(jobId)
    .first<{ listing_id: string }>();

  if (job) {
    await db
      .prepare(
        `UPDATE listings
         SET video_status = 'failed',
             updated_at   = unixepoch()
         WHERE id = ?`
      )
      .bind(job.listing_id)
      .run();
  }

  return { applied: true };
}

/**
 * Apply a terminal result (ready or failed) to a video_jobs row and,
 * on success, write video_url / video_status to the listings table.
 *
 * Idempotency (T-06-03, VIDEO-04): the UPDATE is guarded by
 * `AND status = 'processing'`.  If meta.changes === 0 the job is already
 * in a terminal state (prior callback / duplicate POST) — return
 * `{ applied: false }` immediately without touching listings.
 *
 * SSRF guard (T-06-02): on 'ready' outcome the videoUrl is validated via
 * isSafeHttpUrl before any D1 write; an invalid URL is treated as failure.
 *
 * @param db      D1Database binding
 * @param taskId  Provider task_id identifying the job
 * @param outcome Terminal outcome with status and optional videoUrl / error
 */
export async function applyTerminalResult(
  db: D1Database,
  taskId: string,
  outcome: TerminalOutcome
): Promise<TerminalWriteResult> {
  // SSRF guard: validate provider-returned video URL before any write (T-06-02)
  let effectiveOutcome: TerminalOutcome = outcome;
  if (outcome.status === 'ready' && !isSafeHttpUrl(outcome.videoUrl)) {
    // Treat an unsafe URL as a failure to prevent SSRF / javascript: injection
    effectiveOutcome = { status: 'failed', error: 'Provider returned unsafe video URL' };
  }

  // Idempotent guard: only transition rows currently in 'processing' (T-06-03)
  const updateResult = await db
    .prepare(
      `UPDATE video_jobs
       SET status     = ?,
           error      = ?,
           updated_at = unixepoch()
       WHERE task_id = ? AND status = 'processing'`
    )
    .bind(
      effectiveOutcome.status,
      effectiveOutcome.status === 'failed' ? (effectiveOutcome.error ?? null) : null,
      taskId
    )
    .run();

  // meta.changes === 0 means the row was already terminal — no-op (VIDEO-04)
  if (updateResult.meta.changes === 0) {
    return { applied: false };
  }

  // Resolve listing_id from the job row so we can update listings
  const job = await db
    .prepare(`SELECT listing_id FROM video_jobs WHERE task_id = ?`)
    .bind(taskId)
    .first<{ listing_id: string }>();

  if (!job) {
    // Job row disappeared — report applied anyway
    return { applied: true };
  }

  if (effectiveOutcome.status === 'ready') {
    // Write video_url and set video_status = 'ready' on the listing (VIDEO-02)
    await db
      .prepare(
        `UPDATE listings
         SET video_url    = ?,
             video_status = 'ready',
             updated_at   = unixepoch()
         WHERE id = ?`
      )
      .bind((effectiveOutcome as { status: 'ready'; videoUrl: string }).videoUrl, job.listing_id)
      .run();
  } else {
    // Terminal failure — mark listing video_status = 'failed' (VIDEO-02/03)
    await db
      .prepare(
        `UPDATE listings
         SET video_status = 'failed',
             updated_at   = unixepoch()
         WHERE id = ?`
      )
      .bind(job.listing_id)
      .run();
  }

  return { applied: true };
}
