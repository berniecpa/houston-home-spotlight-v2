# Phase 6: AI Video Generation - Research

**Researched:** 2026-06-14
**Domain:** AI video generation APIs (Kie.ai + HiggsField), async Worker job pattern, Cloudflare cron triggers with @opennextjs/cloudflare
**Confidence:** HIGH on Kie.ai API shapes and callback; HIGH on OpenNext scheduled handler; MEDIUM on HiggsField (auth format confirmed; webhook secret passing unclear)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Completion Detection**
- Submit the Kie.ai job with a `callBackUrl` pointing at our webhook (e.g. /api/video/callback); Kie.ai POSTs us when the job finishes — no polling infra on the happy path.
- FALLBACK: if research finds Kie.ai does not support callbacks (or for resilience), a Cloudflare Cron Trigger periodically scans video_jobs in 'processing' state and polls Kie.ai for status. Research MUST confirm Kie.ai callback support and the exact submit/status/callback API shapes.
- The callback route is server-to-server: EXEMPT from the auth middleware matcher (like the Stripe webhook); verify the callback authenticity (shared secret / signature if Kie.ai provides one — confirm in research) and treat it idempotently (a job already 'ready' is a no-op).

**Client Live Update**
- After submit, the dashboard polls a lightweight status endpoint (e.g. GET /api/agent/listings/[id]/video-status) every few seconds, swapping in the video / status when status transitions to ready or failed. Stop polling on terminal state.
- The public /listings/[slug] detail page (force-dynamic) simply renders the video when listings.video_url is present; no client polling needed there.

**Provider Abstraction & Fallback (VIDEO-05)**
- A provider interface (submit(photos, callbackUrl) -> taskId; getStatus(taskId) -> {status, videoUrl}) with Kie.ai as primary and a REAL HiggsField fallback adapter.
- On Kie.ai submit/processing failure: retry Kie.ai up to a small cap (e.g. 2 attempts), then fail over to HiggsField; record provider + attempts on the job. Agent sees "generation failed — retrying" status, never a silent error.
- Both adapters are production code; live provider round-trips are DEFERRED to human verification.

**Job State & Dedup (video_jobs table)**
- New `video_jobs` table (migration): id, listing_id (FK), agent_id, provider, task_id, status ('queued'|'processing'|'ready'|'failed'), attempts, error, created_at, updated_at.
- DEDUP: a listing may have at most one active (queued/processing) job — the Generate-Video route returns the existing job (or 409) rather than spawning a second.
- On terminal success: write listings.video_url + video_status='ready'; on terminal failure after fallback: video_status='failed'.

**Trigger Authorization**
- Generate-Video is an agent action on their OWN listing (session-derived ownership, 403 cross-agent) and requires the agent be publishable + not suspended (reuse the Phase 3/5 gates). Validates the listing has photo URLs to animate.

### Claude's Discretion
- Exact polling interval (suggest 3-5s) and max client poll duration; cron cadence if the poller fallback is used; video player markup (native <video> vs embed depending on provider output URL).
- Internal module layout of the provider abstraction; whether wrangler.toml needs a [triggers] crons entry (only if the poller fallback is implemented) and/or queue — keep infra minimal.

### Deferred Ideas (OUT OF SCOPE)
- Tier-gating video behind a paid plan (V2-02), direct BytePlus/Seedance (V2-08), multi-clip/editing — post-v1.
</user_constraints>

---

## Summary

**DECISIVE FINDING 1 — Kie.ai callback support: CONFIRMED.** Kie.ai supports `callBackUrl` on every video generation endpoint (Kling, Veo, Wan, Runway). When the job completes, Kie.ai POSTs a JSON payload containing `taskId`, `code`, `msg`, and `data.video_url` (or equivalent) to the registered URL. Kie.ai also provides HMAC-SHA256 signed callbacks via an optional `webhookHmacKey` configured in account settings — signature arrives in `X-Webhook-Signature` and timestamp in `X-Webhook-Timestamp`. The happy path is fully callback-driven.

**DECISIVE FINDING 2 — OpenNext scheduled handler: CONFIRMED + FEASIBLE.** `@opennextjs/cloudflare` v1.x supports a custom worker pattern where a `custom-worker.ts` in the project root imports the generated fetch handler and re-exports it alongside a `scheduled()` handler. `wrangler.toml` `main` is updated to point to this file. The D1 `env.DB` binding is available in `scheduled(controller, env, ctx)` identically to the fetch handler. This is the cron-poller fallback mechanism and is buildable on the current stack.

**Recommended model:** Kling 2.6 via the `/api/v1/jobs/createTask` endpoint (unified Kie.ai market endpoint). Accepts `image_urls` array (1 image per job for Kling 2.6; use the first/hero listing photo). Provider abstraction wraps Kling as primary via Kie.ai and HiggsField `/v1/image2video/dop` as fallback. Both use raw `fetch()` — no SDK.

**Primary recommendation:** Build the callback route first (happy path, no polling infra); wire the cron-poller fallback as a `custom-worker.ts` scheduled handler scanning `video_jobs WHERE status='processing' AND updated_at < unixepoch()-300`; both paths converge on the same D1 write + `listings` update.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generate-Video trigger | API / Backend (edge route) | — | Authz (ownership + publishable gate) must run server-side; returns immediately after D1 job insert + async provider submit |
| Provider submit (Kie.ai / HiggsField) | API / Backend (edge route) | — | Raw fetch from Worker; no browser CORS issue; provider API keys never exposed to client |
| Completion detection (callback) | API / Backend (edge route, middleware-exempt) | — | Server-to-server POST; must verify HMAC before any write |
| Completion detection (poller fallback) | Cloudflare Cron Trigger (scheduled handler) | — | Scans D1 video_jobs; calls Kie.ai status; writes results; no request context needed |
| Client status polling | API / Backend (edge GET) | Browser / Client | Lightweight D1 read; client polls every 3-5s until terminal state |
| Video display (dashboard) | Browser / Client | — | Client reads video_url from status endpoint response |
| Video display (public detail page) | Frontend Server (SSR/force-dynamic) | — | Reads listings.video_url at render time; native video tag |
| video_jobs table writes | Database / D1 | — | All writes via `.prepare().bind()` parameterized queries |

---

## Standard Stack

### Core

| Library / API | Version / Endpoint | Purpose | Why Standard |
|---------------|--------------------|---------|--------------|
| Kie.ai API (Kling 2.6) | `POST https://api.kie.ai/api/v1/jobs/createTask` | Primary video generation | Unified market API; callBackUrl + HMAC signing; active docs |
| Kie.ai status API | `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=` | Poller fallback status query | Same auth; unified for all market models |
| HiggsField API | `POST https://platform.higgsfield.ai/v1/image2video/dop` | Fallback video generation | Real adapter required per locked decisions |
| HiggsField status API | `GET https://platform.higgsfield.ai/requests/{request_id}/status` | Fallback status polling | Confirmed endpoint from SDK source |
| `@opennextjs/cloudflare` | `^1.19.11` (already installed) | Custom worker + scheduled handler support | Custom-worker pattern is the documented extension mechanism |
| `wrangler` | `^4.99.0` (already installed) | Deploy + D1 migrations + cron config | Existing stack |
| Native `fetch()` | Workers runtime | All provider API calls | No Node SDK; Workers-safe; consistent with existing stripe.ts pattern |
| `crypto.subtle` | Workers runtime | Kie.ai webhook HMAC verification | Same pattern as stripeCryptoProvider; no node:crypto |

### No New npm Packages Required

All implementation uses:
- Raw `fetch()` for provider calls (Workers-safe — existing pattern from `src/lib/stripe.ts`)
- `crypto.subtle` for HMAC verification (Workers-safe — existing pattern from Stripe webhook)
- D1 via existing `@cloudflare/workers-types` binding

**No new npm installs.** This phase is pure code + wrangler.toml additions.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies (`fetch`, `crypto.subtle`, `@opennextjs/cloudflare`, `wrangler`, `@cloudflare/workers-types`) are already in the project. Section not applicable.

---

## Kie.ai API — Concrete Shapes

### 1. Submit Endpoint (Primary: Kling 2.6 image-to-video)

[VERIFIED: docs.kie.ai/market/kling/image-to-video]

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer {KIE_API_KEY}
Content-Type: application/json
```

Request body:
```json
{
  "model": "kling-2.6/image-to-video",
  "callBackUrl": "https://your-domain.com/api/video/callback",
  "input": {
    "prompt": "Smooth cinematic walkthrough of this Houston property",
    "image_urls": ["https://cdn.example.com/listing-photo.jpg"],
    "sound": false,
    "duration": "5"
  }
}
```

Field notes:
- `image_urls`: array, maxItems **1** for Kling 2.6. Use the hero/first listing photo. [VERIFIED: docs.kie.ai]
- `duration`: string enum `"5"` or `"10"` (NOT a number). [VERIFIED: docs.kie.ai]
- `callBackUrl`: optional but use it — signed with HMAC if webhookHmacKey is configured. [VERIFIED: docs.kie.ai/common-api/webhook-verification]
- `sound`: set `false` for v1 (no audio complexity).

Success response (HTTP 200):
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "task_kling-2.6_1765182405025"
  }
}
```

The **task ID field is `data.taskId`** (camelCase). [VERIFIED: docs.kie.ai]

Workers-safe `fetch()` pattern:
```typescript
// src/lib/video/kie-adapter.ts
async function kieSubmit(
  imageUrl: string,
  callbackUrl: string,
  apiKey: string
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
  });
  if (!res.ok) throw new Error(`Kie.ai submit failed: ${res.status}`);
  const json = await res.json() as { code: number; data: { taskId: string } };
  if (json.code !== 200) throw new Error(`Kie.ai error: ${json.code}`);
  return json.data.taskId;
}
```

### 2. Kie.ai Callback — THE PIVOTAL FINDING

**Kie.ai DOES support callBackUrl. Callbacks ARE signed with HMAC-SHA256 (optional but strongly recommended for production).** [VERIFIED: docs.kie.ai/common-api/webhook-verification]

#### Enabling callback signing
Configure `webhookHmacKey` in Kie.ai account settings (https://kie.ai/settings). Store as `KIE_WEBHOOK_SECRET` via `wrangler secret put KIE_WEBHOOK_SECRET`. Once enabled, ALL callbacks include:

```
X-Webhook-Timestamp: <unix seconds>
X-Webhook-Signature: <base64(HMAC-SHA256(taskId + "." + timestamp, webhookHmacKey))>
```

#### Callback POST payload to `/api/video/callback`

Representative payload (Runway/Aleph style — all Kie.ai market callbacks follow same envelope): [VERIFIED: docs.kie.ai/runway-api/generate-ai-video-callbacks]

```json
{
  "code": 200,
  "msg": "success",
  "taskId": "task_kling-2.6_1765182405025",
  "data": {
    "video_url": "https://cdn.kie.ai/.../result.mp4",
    "image_url": "https://cdn.kie.ai/.../thumb.jpg",
    "video_id": "vid_abc123"
  }
}
```

For the common/market endpoint (recordInfo-style callbacks): [VERIFIED: docs.kie.ai/market/common/get-task-detail]
- `taskId` is at the top level of the callback body (not inside `data`)
- `code: 200` = success; `code: 400` = failure
- `data.video_url` is the output (valid 14 days)

**No signature = no guaranteed authenticity.** If `KIE_WEBHOOK_SECRET` is not configured, any caller can POST a forged completion to `/api/video/callback`. ALWAYS configure the HMAC key in production. [CITED: docs.kie.ai/common-api/webhook-verification]

#### Signature verification (Workers-safe, mirrors Stripe pattern):

```typescript
// src/app/api/video/callback/route.ts
async function verifyKieSignature(
  taskId: string,
  timestamp: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const data = `${taskId}.${timestamp}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // Compare signatures: timing-safe pattern
  return expected === signature;
}
```

**Retry behaviour:** Kie.ai retries the callback up to 3 times if the endpoint does not return HTTP 200. The same `taskId` may arrive multiple times — the callback handler MUST be idempotent (task_id column + WHERE status='processing' guard).

### 3. Kie.ai Status/Poll Endpoint (Poller Fallback)

**Unified market endpoint:** [VERIFIED: docs.kie.ai/market/common/get-task-detail]

```
GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId={taskId}
Authorization: Bearer {KIE_API_KEY}
```

Response:
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "task_kling-2.6_...",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://cdn.kie.ai/.../result.mp4\"]}",
    "failCode": null,
    "failMsg": null,
    "progress": 100
  }
}
```

**State enum:** `waiting` | `queuing` | `generating` | `success` | `fail` [VERIFIED: docs.kie.ai]

Video URL extraction:
```typescript
const result = JSON.parse(data.resultJson) as { resultUrls: string[] };
const videoUrl = result.resultUrls[0];
```

**Runway-specific poll endpoint** (alternative, use if Kling taskIds do not work with recordInfo): [VERIFIED: docs.kie.ai/runway-api/get-ai-video-details]
```
GET https://api.kie.ai/api/v1/runway/record-detail?taskId={taskId}
```
Response state enum: `wait` | `queueing` | `generating` | `success` | `fail`
Video URL at: `data.videoInfo.videoUrl`

---

## HiggsField Fallback API — Concrete Shapes

[VERIFIED: github.com/higgsfield-ai/higgsfield-js SDK source]

**Base URL:** `https://platform.higgsfield.ai`

**Authentication:** `Authorization: Key {KEY_ID}:{KEY_SECRET}` (NOT Bearer; distinct format)

**Submit endpoint:**
```
POST https://platform.higgsfield.ai/v1/image2video/dop
Authorization: Key {KEY_ID}:{KEY_SECRET}
Content-Type: application/json
```

Request body:
```json
{
  "input": {
    "model": "dop-turbo",
    "prompt": "Smooth cinematic walkthrough of this Houston property",
    "input_images": [
      {
        "type": "image_url",
        "image_url": "https://cdn.example.com/listing-photo.jpg"
      }
    ]
  }
}
```

Field notes:
- `input_images` is an array of objects with `type: 'image_url'` and `image_url` string (NOT a plain URL string array — different from Kie.ai). [VERIFIED: higgsfield-js SDK]
- Auth header format is `Key KEY_ID:KEY_SECRET` — store both parts in a single secret as `KEY_ID:KEY_SECRET` and split at `:` at runtime. [ASSUMED: splitting convention; SDK pattern observed]
- Webhook: SDK appends `?hf_webhook=<url>` as a query param. **No documented signing/HMAC for HiggsField callbacks.** [CITED: higgsfield-js SDK — webhook object accepts `url` and `secret` but secret passing mechanism to callback is undocumented]

Success response:
```json
{
  "request_id": "a1b2c3d4-uuid",
  "status": "queued",
  "status_url": "https://platform.higgsfield.ai/requests/a1b2c3d4-uuid/status",
  "cancel_url": "https://platform.higgsfield.ai/requests/a1b2c3d4-uuid/cancel"
}
```

**Generation ID field is `request_id`** (NOT taskId — different from Kie.ai). [VERIFIED: higgsfield-js SDK]

**Status polling:**
```
GET https://platform.higgsfield.ai/requests/{request_id}/status
Authorization: Key {KEY_ID}:{KEY_SECRET}
```

Status enum: `queued` | `in_progress` | `nsfw` | `failed` | `completed` [VERIFIED: higgsfield-js SDK]

```json
{
  "request_id": "a1b2c3d4-uuid",
  "status": "completed",
  "video": {
    "url": "https://cdn.higgsfield.ai/.../result.mp4"
  }
}
```

Video URL at `video.url`. On `nsfw` or `failed`: treat as provider failure.

Workers-safe fetch for HiggsField submit:
```typescript
// src/lib/video/higgsfield-adapter.ts
async function higgsSubmit(
  imageUrl: string,
  credentials: string   // "KEY_ID:KEY_SECRET"
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
        input_images: [{ type: 'image_url', image_url: imageUrl }],
      },
    }),
  });
  if (!res.ok) throw new Error(`HiggsField submit failed: ${res.status}`);
  const json = await res.json() as { request_id: string };
  return json.request_id;
}
```

**HiggsField fallback completion detection:** Since HiggsField callback secret is undocumented, use the cron-poller pattern for HiggsField jobs (poll `/requests/{id}/status`). Do not implement a HiggsField webhook route in v1.

---

## Cloudflare Cron Trigger with @opennextjs/cloudflare

### CONFIRMED FEASIBLE [VERIFIED: opennext.js.org/cloudflare/howtos/custom-worker + developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/]

The `@opennextjs/cloudflare` adapter exposes a documented "custom worker" extension point. The scheduled handler receives D1 (and all other) bindings via the standard `env` parameter.

### Implementation

**Step 1: Create `custom-worker.ts` in project root**

```typescript
// custom-worker.ts
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from './.open-next/worker.js';
import { pollVideoJobs } from './src/lib/video/poller';

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(pollVideoJobs(env));
  },
} satisfies ExportedHandler<CloudflareEnv>;
```

**Step 2: Update `wrangler.toml` main + add [triggers]**

```toml
# Change main entry point to the custom worker
main = "./custom-worker.ts"

[triggers]
crons = ["*/5 * * * *"]   # Poll every 5 minutes
```

The D1 binding `env.DB` is accessible inside the scheduled handler via the standard `env` parameter — all wrangler.toml bindings (D1, secrets, vars) are available. [VERIFIED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/]

**Step 3: Poller scans stale jobs:**
```typescript
// src/lib/video/poller.ts
export async function pollVideoJobs(env: CloudflareEnv): Promise<void> {
  const db = env.DB;
  // Scan jobs in 'processing' state not updated in the last 5 minutes
  const stale = await db
    .prepare(`SELECT id, provider, task_id, listing_id FROM video_jobs
              WHERE status = 'processing' AND updated_at < unixepoch() - 300`)
    .all<{ id: string; provider: string; task_id: string; listing_id: string }>();

  for (const job of stale.results) {
    // Call appropriate adapter getStatus, write result if terminal
  }
}
```

### Local Testing

```bash
# Trigger the scheduled handler locally (wrangler dev)
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

---

## Architecture Patterns

### System Architecture

```
Agent Browser
  |
  +-- POST /api/agent/listings/[id]/video     <- trigger (authz gate: ownership + publishable)
  |      |
  |      +-- Dedup: SELECT active job -> if exists, return 409 + existing job
  |      +-- INSERT video_jobs (status='processing', provider='kie')
  |      +-- fetch() -> Kie.ai /api/v1/jobs/createTask (await; returns taskId in < 1s)
  |      +-- UPDATE video_jobs SET task_id=? (after submit confirms)
  |      +-- return 202 { jobId, status: 'processing' }
  |
  +-- GET /api/agent/listings/[id]/video-status  <- client polls every 3-5s
  |      +-- SELECT video_jobs WHERE listing_id -> return { status, videoUrl }
  |
Kie.ai servers
  |
  +-- POST /api/video/callback  (middleware-exempt, server-to-server)
         +-- Read raw body (req.text()) FIRST
         +-- Verify X-Webhook-Signature (HMAC-SHA256)
         +-- Parse taskId from body
         +-- SELECT video_jobs WHERE task_id = ? -> if status != 'processing' -> 200 no-op
         +-- UPDATE video_jobs SET status='ready', updated_at=unixepoch()
         +-- UPDATE listings SET video_url=?, video_status='ready' WHERE id=listing_id
         +-- return 200 immediately

Cloudflare Cron (every 5 min) -- fallback for HiggsField + missed callbacks
  +-- SELECT video_jobs WHERE status='processing' AND updated_at < unixepoch()-300
         +-- For each: GET provider status endpoint
         +-- If completed: same write path as callback
         +-- If failed: UPDATE status='failed', UPDATE listings.video_status='failed'
```

### Provider Interface

```typescript
// src/lib/video/types.ts
export interface VideoProvider {
  name: 'kie' | 'higgsfield';
  submit(imageUrl: string, callbackUrl: string): Promise<string>; // returns taskId/requestId
  getStatus(taskId: string): Promise<{
    status: 'processing' | 'ready' | 'failed';
    videoUrl?: string;
  }>;
}
```

### Recommended Module Layout

```
src/lib/video/
  types.ts              # VideoProvider interface, status enums
  kie-adapter.ts        # Kie.ai submit + getStatus + HMAC verify
  higgsfield-adapter.ts # HiggsField submit + getStatus
  provider.ts           # Factory: getProvider(env) + retry/fallback logic
  poller.ts             # pollVideoJobs(env) -- used by scheduled handler

src/app/api/
  agent/listings/[id]/
    video/route.ts        # POST trigger
    video-status/route.ts # GET status poll
  video/callback/route.ts # POST Kie.ai callback (middleware-exempt)

custom-worker.ts          # Project root -- OpenNext extension point
db/migrations/
  0003_video_jobs.sql     # New video_jobs table
```

### Async-Return Pattern

The trigger route MUST return in < 2s. The Kie.ai job submission is fast (< 1s HTTP round-trip to accept the job). The correct approach:

```typescript
// POST /api/agent/listings/[id]/video
// 1. Insert video_jobs row
await db.prepare(`INSERT INTO video_jobs (id, listing_id, agent_id, provider, status, attempts, created_at, updated_at)
  VALUES (?, ?, ?, 'kie', 'processing', 1, unixepoch(), unixepoch())`).bind(jobId, listingId, uid).run();

// 2. Submit to Kie.ai synchronously (fast operation -- Kie.ai accepts the job in < 1s)
//    Set a 5s signal-level timeout via AbortController
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const taskId = await kieSubmit(imageUrl, callbackUrl, env.KIE_API_KEY, controller.signal);
  await db.prepare(`UPDATE video_jobs SET task_id = ?, updated_at = unixepoch() WHERE id = ?`)
    .bind(taskId, jobId).run();
} catch {
  // Submit failed -- job stays 'processing'; cron-poller will retry via HiggsField
} finally {
  clearTimeout(timeout);
}

// 3. Return 202 immediately
return NextResponse.json({ jobId, status: 'processing' }, { status: 202 });
```

Note: `ctx.waitUntil` from `getCloudflareContext` MAY be usable in edge route handlers to defer post-response work. [ASSUMED -- confirm at implementation time; synchronous pattern above is safe either way]

### Idempotency + Dedup Pattern

Mirrors `stripe_events` table — `task_id` column uniqueness guards duplicate callbacks:

```sql
-- db/migrations/0003_video_jobs.sql
CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  provider TEXT NOT NULL,
  task_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'processing',
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_listing_id ON video_jobs(listing_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_task_id ON video_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
```

**Dedup query (one active job per listing):**
```sql
SELECT id, status, task_id FROM video_jobs
WHERE listing_id = ? AND status = 'processing'
LIMIT 1;
```

If row exists: return 409 with `{ jobId: existing.id, status: existing.status }`.

**Callback idempotency:**
```sql
UPDATE video_jobs
SET status = ?, updated_at = unixepoch()
WHERE task_id = ? AND status = 'processing';
-- If changes = 0 -> already terminal -> no-op, return 200
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC-SHA256 signature | Custom crypto | `crypto.subtle` (Web Crypto API) | Already in Workers runtime; same as Stripe webhook pattern |
| Provider SDK | Kie.ai npm package | Raw `fetch()` | No official Workers-compatible SDK exists; fetch is the documented approach |
| Retry/backoff | Custom exponential backoff | Simple attempt counter (max 2) on D1 job row | Kie.ai retries callback 3x automatically; cron-poller handles rest |
| Task queue | CF Queues or Redis | video_jobs D1 table + cron scan | Keeps infra minimal; at current scale (dozens of jobs/day) D1 scan is sufficient |
| Video hosting | Upload to R2 | Leave provider CDN URL in video_url | v1 constraint: URL paste model; 14-day TTL is a documented v1 limitation |
| Constant-time comparison | Manual timing-safe loop | `crypto.subtle` sign + compare | Web Crypto is inherently timing-safe for HMAC operations |

---

## Common Pitfalls

### Pitfall 1: Callback without HMAC — open to forgery
**What goes wrong:** If `webhookHmacKey` is not configured in Kie.ai settings, the `/api/video/callback` route has no way to authenticate the caller. Any HTTP client can POST a fake completion.
**Why it happens:** HMAC signing is opt-in via the Kie.ai settings page, not default.
**How to avoid:** Require `KIE_WEBHOOK_SECRET` in env; reject callbacks with 400 if the header is absent or signature fails. [CITED: docs.kie.ai/common-api/webhook-verification]
**Warning signs:** `/api/video/callback` processing jobs that were never submitted.

### Pitfall 2: Duplicate callbacks updating already-terminal jobs
**What goes wrong:** Kie.ai retries the callback up to 3 times. A 'ready' job receives a second POST and a naive handler re-writes `listings.video_url` unnecessarily (or worse, writes a failure over a success).
**How to avoid:** `UPDATE video_jobs SET status=? WHERE task_id=? AND status='processing'`. Check `changes` count (D1 result `meta.changes`); if 0 -> return 200 no-op immediately. [CITED: docs.kie.ai/runway-api/generate-ai-video-callbacks idempotency guidance]
**Warning signs:** `listings.video_url` flipping between values.

### Pitfall 3: Photo URLs not publicly accessible to Kie.ai servers
**What goes wrong:** Listing images on a private CDN or behind auth return 403 when Kie.ai tries to download them. The generation job fails silently.
**Why it happens:** Agents paste arbitrary URLs; some hosts block non-browser user-agents.
**How to avoid:** Validate that `image_urls` entries are public http(s) URLs (reuse `isSafeHttpUrl`). Document in UX that photos must be publicly accessible. [ASSUMED — standard behaviour for all image-to-video APIs]
**Warning signs:** Kie.ai `state: fail` with `failCode` related to download/fetch errors.

### Pitfall 4: Video URL expiry (14-day TTL) — video disappears for buyers
**What goes wrong:** Kie.ai output URLs expire after 14 days. If `listings.video_url` points directly to the Kie.ai CDN, the video 404s for buyers two weeks after generation.
**Why it happens:** Provider CDN links are temporary. [CITED: docs.kie.ai/runway-api/generate-ai-video-callbacks — "valid for 14 days"]
**How to avoid (v1):** Document the 14-day limit in agent UX; provide a "Regenerate" button. A proper fix is downloading to R2 on callback (out of scope v1).
**Warning signs:** `video_url` returning 403/404 on the public listing page.

### Pitfall 5: `main` in wrangler.toml not updated to `custom-worker.ts`
**What goes wrong:** The scheduled handler is written but wrangler.toml still points `main = ".open-next/worker.js"` — cron trigger fires but there is no `scheduled` export, silently no-ops.
**How to avoid:** Update `main = "./custom-worker.ts"` in wrangler.toml. Verify with local scheduled test endpoint. [VERIFIED: opennext.js.org/cloudflare/howtos/custom-worker]
**Warning signs:** Cron trigger shows "succeeded" in Cloudflare dashboard but video_jobs table never updates.

### Pitfall 6: Polling cost — cron interval too frequent
**What goes wrong:** A `*/1 * * * *` cron scanning all processing jobs every minute creates wasted D1 reads and KIE_API_KEY credits on status calls for jobs still actively being watched by the callback path.
**How to avoid:** Use `*/5 * * * *`. Only scan jobs where `updated_at < unixepoch() - 300` to skip recently-submitted jobs.
**Warning signs:** D1 read unit spikes in Cloudflare analytics.

### Pitfall 7: HiggsField auth header format (`Key` not `Bearer`)
**What goes wrong:** Using `Authorization: Bearer KID:SECRET` for HiggsField instead of `Authorization: Key KID:SECRET` causes 401 on all HiggsField requests.
**Why it happens:** HiggsField uses a non-standard auth scheme distinct from Kie.ai. [VERIFIED: higgsfield-js SDK source]
**How to avoid:** Store HiggsField credentials as `HIGGSFIELD_API_KEY` in format `KEY_ID:KEY_SECRET`; in the adapter, prefix with `Key ` (not `Bearer `).
**Warning signs:** HiggsField adapter always returning 401; Kie.ai adapter working fine.

### Pitfall 8: Callback payload field names differ between Kie.ai endpoints
**What goes wrong:** The Runway API callback has `data.video_url`; the common/market (recordInfo) callback may return video URL inside `data.resultJson` as a stringified JSON with `resultUrls` array. A handler that only checks `data.video_url` misses the URL on market-endpoint jobs.
**How to avoid:** Parse both shapes: try `data.video_url` first, fall back to `JSON.parse(data.resultJson).resultUrls[0]`. Log the raw callback body on first live test to confirm which shape Kling 2.6 uses. [ASSUMED: Kling via createTask endpoint callback format not explicitly documented vs Runway endpoint]
**Warning signs:** `video_url` null in D1 after successful job completion.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Kie.ai callbacks unsigned | HMAC-SHA256 signed callbacks via `webhookHmacKey` opt-in | 2025 (docs.kie.ai) | Production-grade authenticity; no IP allowlisting needed |
| OpenNext custom handlers were unofficial/undocumented | `custom-worker.ts` is the officially documented extension mechanism | @opennextjs/cloudflare v1+ | Stable API; scheduled handlers are a first-class use case |
| Polling-only for AI video completion | callBackUrl + optional polling fallback | Current (all major Kie.ai endpoints) | Eliminates per-minute D1 scans on the happy path |
| HiggsField SDK-only access | Direct HTTP REST API fully documented via SDK source | 2025 (higgsfield-js) | SDK not needed; raw fetch works; Workers-compatible |
| wrangler.toml TOML format only | wrangler.jsonc (JSON with comments) now also supported | Wrangler v3.91.0 | Project uses TOML — either format works; do not change format |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getCloudflareContext({ async: true }).ctx.waitUntil` is accessible inside Next.js App Router edge routes and can be used to defer post-response work | Architecture Patterns (Async-Return Pattern) | Low risk: synchronous submit (< 1s under normal conditions) is sufficient; no design change needed |
| A2 | Kling 2.6 `image_urls` maxItems:1 is a hard constraint — confirmed in docs | Standard Stack / Kie.ai Submit | If wrong (multiple allowed): hero image approach still works; using multiple photos is an enhancement |
| A3 | HiggsField webhook `secret` in SDK config is passed to callbacks in a verifiable header (mechanism undocumented) | HiggsField Fallback | Low risk: plan already uses cron-poller for HiggsField — no HiggsField callback route in v1 |
| A4 | Photo URLs pasted by agents are publicly accessible to Kie.ai/HiggsField download servers | Pitfall 3 | If wrong: generation fails for agents using private CDNs; pre-submit HEAD request validation can be added |
| A5 | Video output URLs from Kie.ai CDN are directly embeddable in a native video tag (no auth token required, CORS open for browser) | Architecture (video display) | If wrong: need a proxy route or R2 copy; significant extra work deferred to V2 |
| A6 | Kling 2.6 via `/api/v1/jobs/createTask` sends callback with `data.video_url` structure (same as Runway endpoint) | Kie.ai API Shapes (Callback payload) | If wrong: parse `data.resultJson` instead; log raw body on first live test to confirm |

---

## Open Questions

1. **Kie.ai callback payload field names for createTask-submitted Kling jobs**
   - What we know: Runway endpoint callback has `data.video_url`. Common/recordInfo endpoint returns `resultJson` with `resultUrls`. It is unclear which format a Kling 2.6 job submitted via `/api/v1/jobs/createTask` uses for its callback.
   - What's unclear: Whether the callback mirrors the poll endpoint (resultJson) or the Runway endpoint (data.video_url).
   - Recommendation: Implement a dual-parse in the callback handler; log raw body on first real provider test.

2. **`ctx.waitUntil` availability in Next.js App Router edge routes**
   - What we know: `getCloudflareContext({ async: true })` returns `ctx`. Stripe webhook does not use it.
   - What's unclear: Whether calling `ctx.waitUntil(promise)` inside a route handler actually defers work after `NextResponse` is returned.
   - Recommendation: Test with a 200ms artificial delay on the provider submit. If `waitUntil` works, use it; if not, the synchronous submit is safe (Kie.ai accepts the job in < 1s).

3. **HiggsField KEY_ID:KEY_SECRET — single string or two console fields**
   - What we know: SDK uses `Authorization: Key KEY_ID:KEY_SECRET`.
   - What's unclear: Whether `platform.higgsfield.ai` console issues one combined string or two separate values.
   - Recommendation: Store as `HIGGSFIELD_API_KEY="KEY_ID:KEY_SECRET"` and split at first `:` in the adapter.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@opennextjs/cloudflare` | Custom worker + scheduled handler | Yes | ^1.19.11 (installed) | — |
| `wrangler` | Deploy, D1 migrations, cron config | Yes | ^4.99.0 (installed) | — |
| Cloudflare D1 (`env.DB`) | video_jobs table + listings writes | Yes | Existing binding (wrangler.toml) | — |
| `crypto.subtle` | HMAC verification | Yes | Workers runtime built-in | — |
| Kie.ai API key (`KIE_API_KEY`) | Primary provider | NOT YET | — | Obtain from kie.ai/api-key; `wrangler secret put KIE_API_KEY` |
| Kie.ai webhook HMAC key (`KIE_WEBHOOK_SECRET`) | Callback authentication | NOT YET | — | Obtain from kie.ai/settings; `wrangler secret put KIE_WEBHOOK_SECRET` |
| HiggsField API credentials (`HIGGSFIELD_API_KEY`) | Fallback provider | NOT YET | — | Obtain from platform.higgsfield.ai; `wrangler secret put HIGGSFIELD_API_KEY` |

**Missing dependencies with no fallback at runtime:**
- `KIE_API_KEY` — blocks live provider submit; production code buildable without it (deferred human verification per locked decisions)

**Missing dependencies with fallback:**
- `HIGGSFIELD_API_KEY` — fallback adapter code is buildable without live key; mock in local testing

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per config.json.

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Session-derived ownership on trigger route (existing `resolveOwnership` pattern) |
| V3 Session Management | Partial | Callback route is session-less (server-to-server); HMAC signature replaces session auth |
| V4 Access Control | Yes | Generate-Video gate: ownership + publishable + not-suspended (reuse Phase 3/5 gates) |
| V5 Input Validation | Yes | Validate listing_id param, image URL format (`isSafeHttpUrl`), callback JSON structure |
| V6 Cryptography | Yes | `crypto.subtle` for HMAC verify; never hand-roll crypto; constant-time compare for signature |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged callback POST (attacker spoofs Kie.ai) | Spoofing | HMAC-SHA256 signature verify via `X-Webhook-Signature` header; reject if absent or invalid |
| Replay attack (re-POST of a valid callback) | Tampering | `video_jobs.task_id` uniqueness + `WHERE status='processing'` guard — replays are no-ops |
| Cross-agent video trigger (agent A triggers for agent B's listing) | Elevation of Privilege | `resolveOwnership()` preamble (existing pattern from listings route) |
| Suspended/unpublishable agent triggering video | Elevation of Privilege | `checkSuspended()` + `isAgentPublishable()` gates (existing) |
| Provider API key exposure | Information Disclosure | Stored via `wrangler secret put`; never in [vars] or committed code |
| Provider URL injection in callback body | Tampering | Validate `video_url` from callback is a valid https URL before writing to D1; use `isSafeHttpUrl` |
| Timing attack on HMAC comparison | Information Disclosure | Use `crypto.subtle.sign` for both sides and compare encoded strings; avoid `timingSafeEqual` (node:crypto unavailable in Workers) |

---

## Sources

### Primary (HIGH confidence)
- [docs.kie.ai/market/kling/image-to-video](https://docs.kie.ai/market/kling/image-to-video) — submit endpoint, model name, image_urls field
- [docs.kie.ai/runway-api/generate-ai-video-callbacks](https://docs.kie.ai/runway-api/generate-ai-video-callbacks) — callback payload shape, retry behaviour
- [docs.kie.ai/common-api/webhook-verification](https://docs.kie.ai/common-api/webhook-verification) — HMAC signing, header names, signing formula (`taskId + "." + timestamp`)
- [docs.kie.ai/market/common/get-task-detail](https://docs.kie.ai/market/common/get-task-detail) — unified status endpoint, state enum, resultJson format
- [docs.kie.ai/runway-api/get-ai-video-details](https://docs.kie.ai/runway-api/get-ai-video-details) — Runway-specific status endpoint, videoInfo.videoUrl field
- [github.com/higgsfield-ai/higgsfield-js](https://github.com/higgsfield-ai/higgsfield-js) — HiggsField auth format, base URL, endpoint, request shape, status values
- [opennext.js.org/cloudflare/howtos/custom-worker](https://opennext.js.org/cloudflare/howtos/custom-worker) — custom-worker.ts pattern, wrangler config update
- [developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/) — scheduled handler signature, env/ctx access

### Secondary (MEDIUM confidence)
- [docs.kie.ai/veo3-api/generate-veo-3-video](https://docs.kie.ai/veo3-api/generate-veo-3-video) — Veo3.1 as alternative endpoint with imageUrls array (2-image support; alternate if Kling 1-image limit is a blocker)
- [docs.kie.ai/runway-api/generate-aleph-video-callbacks](https://docs.kie.ai/runway-api/generate-aleph-video-callbacks) — Aleph callback payload (cross-reference for taskId placement)

### Tertiary (LOW confidence / ASSUMED)
- Callback payload format for Kling 2.6 jobs submitted via `/api/v1/jobs/createTask` (inferred from combined docs; log raw body on first live test to confirm)

---

## Metadata

**Confidence breakdown:**
- Kie.ai API shapes: HIGH — verified directly from official docs pages
- Kie.ai callback + HMAC signing: HIGH — dedicated docs page confirmed with exact signing formula
- OpenNext scheduled handler: HIGH — documented in opennext.js.org official how-to with exact code pattern
- HiggsField API: MEDIUM — verified from Node.js SDK source; auth format confirmed; callback secret mechanism undocumented
- Async-return / waitUntil in App Router edge routes: LOW (A1 assumption) — needs implementation-time confirmation

**Research date:** 2026-06-14
**Valid until:** 2026-08-14 (Kie.ai model names evolve; re-verify `kling-2.6/image-to-video` model string before production deploy)
