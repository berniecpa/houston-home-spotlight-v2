/**
 * Video provider orchestration — retry/failover logic (Phase 6).
 *
 * submitWithFallback: attempt Kie.ai up to 2 times, then fail over to
 * HiggsField once. Returns { provider, taskId } of the first successful
 * submission, or throws if all attempts fail.
 *
 * No exponential backoff or sleep — RESEARCH "Don't Hand-Roll" guidance:
 * simple attempt counter only. Kie.ai retries its own callbacks 3×;
 * the cron-poller handles the rest.
 *
 * API keys are read from env at call time — never at module level (T-06-01).
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/video/provider
 */

import type { VideoProvider } from '@/lib/video/types';
import { createKieAdapter } from '@/lib/video/kie-adapter';
import { createHiggsAdapter } from '@/lib/video/higgsfield-adapter';

// ---------------------------------------------------------------------------
// Environment interface (subset used by this module)
// ---------------------------------------------------------------------------

/** Minimal env fields required by the video provider layer. */
export interface VideoEnv {
  KIE_API_KEY: string;
  /** KIE_WEBHOOK_SECRET is used by the callback route (06-02), not here. */
  KIE_WEBHOOK_SECRET?: string;
  HIGGSFIELD_API_KEY: string;
}

// ---------------------------------------------------------------------------
// Provider result
// ---------------------------------------------------------------------------

/** Return value from submitWithFallback: identifies which provider succeeded. */
export interface SubmitResult {
  /** Provider name that accepted the job. */
  provider: 'kie' | 'higgsfield';
  /** Provider-assigned task identifier to store in video_jobs.task_id. */
  taskId: string;
}

// ---------------------------------------------------------------------------
// Failover orchestrator
// ---------------------------------------------------------------------------

/**
 * Submit an image-to-video job with automatic Kie.ai → HiggsField failover.
 *
 * Attempts Kie.ai up to KIE_MAX_ATTEMPTS (2) times, then falls over to
 * HiggsField once. Records errors from each attempt.
 *
 * Retry cap (VIDEO-03): capped at 2 Kie.ai attempts before failover.
 * No sleep between attempts (RESEARCH "Don't Hand-Roll").
 *
 * @param env         Cloudflare Worker env with video secrets
 * @param imageUrl    Publicly accessible hero photo URL
 * @param callbackUrl Callback URL for Kie.ai webhook (deferred for HiggsField)
 * @returns           { provider, taskId } of the successful submission
 * @throws            If all providers fail
 */
export async function submitWithFallback(
  env: VideoEnv,
  imageUrl: string,
  callbackUrl: string
): Promise<SubmitResult> {
  const KIE_MAX_ATTEMPTS = 2;
  const errors: string[] = [];

  // --- Kie.ai primary: up to 2 attempts (VIDEO-03) ---
  const kieAdapter = createKieAdapter(env.KIE_API_KEY);
  for (let attempt = 1; attempt <= KIE_MAX_ATTEMPTS; attempt++) {
    try {
      const taskId = await kieAdapter.submit(imageUrl, callbackUrl);
      return { provider: 'kie', taskId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Kie.ai attempt ${attempt}: ${msg}`);
    }
  }

  // --- HiggsField fallback: one attempt ---
  const higgsAdapter = createHiggsAdapter(env.HIGGSFIELD_API_KEY);
  try {
    const taskId = await higgsAdapter.submit(imageUrl, callbackUrl);
    return { provider: 'higgsfield', taskId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`HiggsField: ${msg}`);
  }

  // All providers failed
  throw new Error(`All video providers failed:\n${errors.join('\n')}`);
}

// ---------------------------------------------------------------------------
// Provider resolver (used by poller and callback route)
// ---------------------------------------------------------------------------

/**
 * Return a VideoProvider adapter for the given provider name.
 *
 * Used by the cron-poller (06-03) to call getStatus() on the correct
 * provider based on video_jobs.provider.
 *
 * @param name Provider name stored in video_jobs.provider
 * @param env  Cloudflare Worker env with video secrets
 */
export function getProviderByName(
  name: 'kie' | 'higgsfield',
  env: VideoEnv
): VideoProvider {
  if (name === 'higgsfield') {
    return createHiggsAdapter(env.HIGGSFIELD_API_KEY);
  }
  return createKieAdapter(env.KIE_API_KEY);
}
