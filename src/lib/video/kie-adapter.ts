/**
 * Kie.ai provider adapter — Kling 2.6 image-to-video (Phase 6).
 *
 * Uses raw fetch() (Workers-safe). Do NOT import node:crypto, axios, or the
 * Kie.ai npm SDK — Workers runtime does not provide node:https and no
 * Workers-compatible Kie.ai SDK exists.
 *
 * DO NOT add: export const runtime = 'edge'
 *   @opennextjs/cloudflare v1.x does not support the edge runtime declaration.
 *   [CITED: opennext.js.org/cloudflare]
 *
 * @module lib/video/kie-adapter
 */

import type { VideoProvider } from '@/lib/video/types';

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface KieCreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface KieRecordInfoResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?: string | null;
    failMsg?: string | null;
    progress?: number;
  };
}

/** Shape of resultJson embedded string on success. */
interface KieResultJson {
  resultUrls: string[];
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/**
 * Submit an image-to-video job to Kie.ai (Kling 2.6).
 *
 * [VERIFIED: docs.kie.ai/market/kling/image-to-video]
 * Endpoint: POST https://api.kie.ai/api/v1/jobs/createTask
 * Auth:     Authorization: Bearer {apiKey}
 *
 * @param imageUrl    Publicly accessible hero photo URL (maxItems:1 for Kling 2.6)
 * @param callbackUrl URL Kie.ai will POST on job completion (HMAC-signed if webhookHmacKey configured)
 * @param apiKey      KIE_API_KEY from env (wrangler secret put KIE_API_KEY)
 * @param signal      Optional AbortSignal for timeout control
 * @returns           Kie.ai-assigned taskId string
 * @throws            On HTTP error or non-200 code in response body
 */
export async function kieSubmit(
  imageUrl: string,
  callbackUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kling-2.6/image-to-video',
      callBackUrl: callbackUrl,
      input: {
        prompt: 'Smooth cinematic walkthrough of this Houston property',
        image_urls: [imageUrl],
        sound: false,
        duration: '5',
      },
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Kie.ai submit failed: HTTP ${res.status}`);
  }

  const json = (await res.json()) as KieCreateTaskResponse;
  if (json.code !== 200) {
    throw new Error(`Kie.ai submit error: code=${json.code} msg=${json.msg}`);
  }

  return json.data.taskId;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Poll Kie.ai for the current status of a job (cron-poller fallback path).
 *
 * Maps Kie.ai state enum onto internal status:
 *   waiting | queuing | generating → processing
 *   success                        → ready (videoUrl extracted from resultJson)
 *   fail                           → failed
 *
 * [VERIFIED: docs.kie.ai/market/common/get-task-detail]
 * Endpoint: GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=
 *
 * @param taskId  Kie.ai task identifier returned by kieSubmit()
 * @param apiKey  KIE_API_KEY from env
 */
export async function kieGetStatus(
  taskId: string,
  apiKey: string
): Promise<{ status: 'processing' | 'ready' | 'failed'; videoUrl?: string; error?: string }> {
  const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Kie.ai status check failed: HTTP ${res.status}`);
  }

  const json = (await res.json()) as KieRecordInfoResponse;
  const { state, resultJson, failMsg, failCode } = json.data;

  if (state === 'success') {
    const mockBody: KieCallbackBody = { data: { resultJson } };
    const videoUrl = extractKieCallbackVideoUrl(mockBody);
    return { status: 'ready', videoUrl };
  }

  if (state === 'fail') {
    // WR-06 / IN-02: surface the provider failure reason instead of dropping it.
    const error =
      failMsg ?? (failCode ? `Kie.ai failCode ${failCode}` : 'Kie.ai reported failed');
    return { status: 'failed', error };
  }

  // waiting | queuing | generating
  return { status: 'processing' };
}

// ---------------------------------------------------------------------------
// HMAC signature verification (Workers-safe, constant-time, T-06-04)
// ---------------------------------------------------------------------------

/**
 * Verify a Kie.ai webhook HMAC-SHA256 signature using constant-time comparison.
 *
 * Signing formula [VERIFIED: docs.kie.ai/common-api/webhook-verification]:
 *   message = taskId + "." + timestamp
 *   signature = base64( HMAC-SHA256(message, webhookHmacKey) )
 *
 * Uses crypto.subtle (Web Crypto API — available in Workers runtime).
 * Does NOT use node:crypto.timingSafeEqual (not available in Workers).
 *
 * Constant-time comparison: both the expected and received signatures are
 * computed as Uint8Array MAC bytes, then compared byte-by-byte with XOR
 * accumulation so the function runs in O(n) time regardless of where the
 * first mismatch occurs (ASVS V6, T-06-04).
 *
 * @param taskId    Job identifier from the callback body
 * @param timestamp Unix-seconds timestamp from X-Webhook-Timestamp header
 * @param signature Base64 signature from X-Webhook-Signature header
 * @param secret    KIE_WEBHOOK_SECRET from env (the webhookHmacKey value)
 * @returns         true if the signature matches; false otherwise
 */
export async function verifyKieSignature(
  taskId: string,
  timestamp: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const message = `${taskId}.${timestamp}`;
  const enc     = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Compute HMAC over the signing message
  const macBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const expected  = new Uint8Array(macBuffer);

  // Decode the received signature from base64 to bytes
  let received: Uint8Array;
  try {
    const binary = atob(signature);
    received = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      received[i] = binary.charCodeAt(i);
    }
  } catch {
    return false;
  }

  // Constant-time comparison: lengths must match, then XOR-accumulate diffs
  if (expected.length !== received.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected[i] ^ received[i];
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Callback video URL extraction (Pitfall 8 dual-parse)
// ---------------------------------------------------------------------------

/** Shape of the Kie.ai callback POST body (relevant fields). */
export interface KieCallbackBody {
  data?: {
    video_url?: string;
    resultJson?: string;
  };
}

/**
 * Extract the video URL from a Kie.ai callback payload.
 *
 * Kie.ai endpoints use two different payload shapes:
 *   Runway endpoint:     data.video_url (direct string)
 *   Market/createTask:  data.resultJson (stringified JSON with resultUrls[])
 *
 * Tries data.video_url first, then falls back to parsing
 * data.resultJson.resultUrls[0] (Pitfall 8 dual-parse).
 * Log the raw callback body on first live test to confirm which shape Kling 2.6 uses.
 *
 * [CITED: RESEARCH.md Pitfall 8 / Open Question 1]
 *
 * @param body  Parsed Kie.ai callback JSON body
 * @returns     Video URL string, or undefined if not extractable
 */
export function extractKieCallbackVideoUrl(body: KieCallbackBody): string | undefined {
  // Shape 1: direct video_url field (Runway-style)
  if (body?.data?.video_url) {
    return body.data.video_url;
  }

  // Shape 2: resultJson embedded string (market/createTask-style)
  if (body?.data?.resultJson) {
    try {
      const parsed = JSON.parse(body.data.resultJson) as KieResultJson;
      return parsed.resultUrls?.[0];
    } catch {
      return undefined;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// VideoProvider adapter object
// ---------------------------------------------------------------------------

/**
 * Create a Kie.ai VideoProvider adapter.
 *
 * Instantiated by provider.ts; methods delegate to kieSubmit / kieGetStatus
 * with API keys injected at call time (never module-level, T-06-01).
 *
 * @param apiKey KIE_API_KEY from env
 */
export function createKieAdapter(apiKey: string): VideoProvider {
  return {
    name: 'kie',

    submit(imageUrl: string, callbackUrl: string): Promise<string> {
      return kieSubmit(imageUrl, callbackUrl, apiKey);
    },

    getStatus(taskId: string): Promise<{ status: 'processing' | 'ready' | 'failed'; videoUrl?: string; error?: string }> {
      return kieGetStatus(taskId, apiKey);
    },
  };
}
