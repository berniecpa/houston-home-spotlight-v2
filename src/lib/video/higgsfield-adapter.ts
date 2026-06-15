/**
 * HiggsField provider adapter — dop-turbo image-to-video (Phase 6 fallback).
 *
 * Uses raw fetch() (Workers-safe). Do NOT import node:crypto, the HiggsField
 * npm SDK, or axios — Workers runtime does not provide node:https.
 *
 * Auth format: `Authorization: Key KEY_ID:KEY_SECRET`
 *   NOT Bearer. [VERIFIED: higgsfield-js SDK source]
 *   Pitfall 7: using Bearer causes 401 on all requests.
 *
 * Credentials are stored as `HIGGSFIELD_API_KEY` in env in the format
 * "KEY_ID:KEY_SECRET" and passed in full as the `credentials` parameter.
 * The adapter prefixes with "Key " — do NOT split at call time.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/video/higgsfield-adapter
 */

import type { VideoProvider } from '@/lib/video/types';

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface HiggsSubmitResponse {
  /** Provider-assigned job identifier (NOT taskId — different from Kie.ai). */
  request_id: string;
  status: string;
  status_url?: string;
  cancel_url?: string;
}

interface HiggsStatusResponse {
  request_id: string;
  /** queued | in_progress | nsfw | failed | completed */
  status: string;
  video?: {
    url: string;
  };
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/**
 * Submit an image-to-video job to HiggsField (dop-turbo model).
 *
 * [VERIFIED: github.com/higgsfield-ai/higgsfield-js SDK source]
 * Endpoint: POST https://platform.higgsfield.ai/v1/image2video/dop
 * Auth:     Authorization: Key {KEY_ID}:{KEY_SECRET}
 *
 * NOTE: callbackUrl is accepted for VideoProvider interface compatibility.
 * HiggsField completion is detected via the cron-poller (no webhook in v1
 * due to undocumented signing mechanism — RESEARCH Assumption A3).
 *
 * @param imageUrl    Publicly accessible hero photo URL
 * @param credentials Full "KEY_ID:KEY_SECRET" string from env.HIGGSFIELD_API_KEY
 * @returns           HiggsField request_id (stored as task_id in video_jobs)
 * @throws            On HTTP error
 */
export async function higgsSubmit(
  imageUrl: string,
  credentials: string
): Promise<string> {
  const res = await fetch('https://platform.higgsfield.ai/v1/image2video/dop', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        model: 'dop-turbo',
        prompt: 'Smooth cinematic walkthrough of this Houston property',
        input_images: [
          {
            type: 'image_url',
            image_url: imageUrl,
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`HiggsField submit failed: HTTP ${res.status}`);
  }

  const json = (await res.json()) as HiggsSubmitResponse;
  return json.request_id;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Poll HiggsField for the current status of a job.
 *
 * Maps HiggsField status enum onto internal status:
 *   queued | in_progress → processing
 *   completed            → ready (videoUrl = video.url)
 *   nsfw | failed        → failed
 *
 * [VERIFIED: higgsfield-js SDK source]
 * Endpoint: GET https://platform.higgsfield.ai/requests/{request_id}/status
 * Auth:     Authorization: Key {KEY_ID}:{KEY_SECRET}
 *
 * @param requestId   HiggsField request_id returned by higgsSubmit()
 * @param credentials Full "KEY_ID:KEY_SECRET" string from env.HIGGSFIELD_API_KEY
 */
export async function higgsGetStatus(
  requestId: string,
  credentials: string
): Promise<{ status: 'processing' | 'ready' | 'failed'; videoUrl?: string; error?: string }> {
  const res = await fetch(
    `https://platform.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Key ${credentials}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`HiggsField status check failed: HTTP ${res.status}`);
  }

  const json = (await res.json()) as HiggsStatusResponse;

  if (json.status === 'completed') {
    return { status: 'ready', videoUrl: json.video?.url };
  }

  if (json.status === 'nsfw' || json.status === 'failed') {
    // IN-02: surface the provider's terminal status as the failure reason.
    return { status: 'failed', error: `HiggsField reported ${json.status}` };
  }

  // queued | in_progress
  return { status: 'processing' };
}

// ---------------------------------------------------------------------------
// VideoProvider adapter object
// ---------------------------------------------------------------------------

/**
 * Create a HiggsField VideoProvider adapter.
 *
 * Instantiated by provider.ts; methods delegate to higgsSubmit / higgsGetStatus
 * with credentials injected at call time (never module-level, T-06-01).
 *
 * The submit() signature accepts callbackUrl for VideoProvider interface
 * compatibility; it is not forwarded to HiggsField (poller-only completion).
 *
 * @param credentials HIGGSFIELD_API_KEY from env (format: "KEY_ID:KEY_SECRET")
 */
export function createHiggsAdapter(credentials: string): VideoProvider {
  return {
    name: 'higgsfield',

    // callbackUrl param omitted; HiggsField is poller-only (RESEARCH A3).
    // Structurally still satisfies VideoProvider.submit(imageUrl, callbackUrl).
    submit(imageUrl: string): Promise<string> {
      return higgsSubmit(imageUrl, credentials);
    },

    getStatus(requestId: string): Promise<{ status: 'processing' | 'ready' | 'failed'; videoUrl?: string; error?: string }> {
      return higgsGetStatus(requestId, credentials);
    },
  };
}
