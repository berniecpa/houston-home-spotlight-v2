/**
 * Shared types for the Phase 6 AI video generation subsystem.
 *
 * Defines the VideoProvider interface implemented by kie-adapter and
 * higgsfield-adapter, plus status enums and the VideoJobRow type that
 * maps to the video_jobs D1 table columns.
 *
 * @module lib/video/types
 */

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Common interface implemented by Kie.ai and HiggsField adapters.
 *
 * submit() returns a provider-specific task identifier (taskId for Kie.ai,
 * request_id for HiggsField); the caller stores this in video_jobs.task_id
 * via setTaskId().
 *
 * getStatus() is used by the cron-poller fallback to check job progress when
 * no callback has been received.
 */
export interface VideoProvider {
  /** Stable name used to record which provider handled a job. */
  name: 'kie' | 'higgsfield';

  /**
   * Submit an image-to-video request.
   *
   * @param imageUrl    Publicly accessible URL of the hero listing photo.
   * @param callbackUrl URL that Kie.ai (or compatible provider) should POST
   *                    on completion. HiggsField uses poller instead.
   * @returns Provider-assigned task identifier string.
   */
  submit(imageUrl: string, callbackUrl: string): Promise<string>;

  /**
   * Poll the provider for the current job status.
   *
   * Returns a normalised status that maps provider-specific state values
   * onto the three internal states.
   *
   * @param taskId Provider task identifier returned by submit().
   */
  getStatus(taskId: string): Promise<{
    status: 'processing' | 'ready' | 'failed';
    videoUrl?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Job status
// ---------------------------------------------------------------------------

/**
 * Valid values for the `status` column in video_jobs.
 *
 * queued      — row inserted; provider submission not yet attempted.
 * processing  — submitted to provider; awaiting callback or poller.
 * ready       — terminal success; listings.video_url has been written.
 * failed      — terminal failure after all provider attempts.
 */
export type VideoJobStatus = 'queued' | 'processing' | 'ready' | 'failed';

// ---------------------------------------------------------------------------
// D1 row type
// ---------------------------------------------------------------------------

/**
 * Row shape returned by D1 queries on the video_jobs table.
 *
 * Mirrors the 0005_video_jobs.sql column definitions exactly:
 *   - created_at / updated_at are epoch seconds (INTEGER / unixepoch()).
 *   - task_id is nullable until the provider submission succeeds.
 *   - error is nullable; set only on terminal failures.
 */
export interface VideoJobRow {
  /** UUID primary key. */
  id: string;
  /** FK to listings.id. */
  listing_id: string;
  /** FK to agents.id (Firebase UID). */
  agent_id: string;
  /** Provider that handled (or is handling) this job. */
  provider: 'kie' | 'higgsfield';
  /** Provider-assigned task identifier; null until submission succeeds. */
  task_id: string | null;
  /** Current job status. */
  status: VideoJobStatus;
  /** Total submission attempts (Kie.ai + HiggsField counted separately). */
  attempts: number;
  /** Latest error message; null when no error. */
  error: string | null;
  /** Row creation time (epoch seconds). */
  created_at: number;
  /** Last modification time (epoch seconds). */
  updated_at: number;
}
