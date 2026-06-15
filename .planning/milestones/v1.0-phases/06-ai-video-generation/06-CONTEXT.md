# Phase 6: AI Video Generation - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas; user accepted all 4 recommendations.

<domain>
## Phase Boundary

Agents can trigger AI video generation for one of their listings from the dashboard. The platform
submits an async job to Kie.ai with the listing's photo URLs, returns immediately (<2s), and learns
of completion via a Kie.ai webhook callback (cron-poller fallback). On completion it writes video_url
to the listing; the dashboard updates live by polling a status endpoint, and the public listing detail
page displays the video when video_url is present. On Kie.ai failure the platform retries then fails
over to a HiggsField adapter. Duplicate "Generate Video" requests for a listing do not spawn
concurrent jobs.

In scope: the Generate-Video trigger (dashboard, agent-owned + publishable gate), the provider
abstraction (Kie.ai primary + HiggsField fallback), async submission, the completion webhook + cron
poller fallback, the video_jobs table + dedup, the client status-polling endpoint + UI, and the
public detail-page video render.

Out of scope: second subscription tier gating video (V2-02), direct BytePlus/Seedance integration
(V2-08), video editing/templates. Live provider validation is deferred per the autonomous-run directive.
</domain>

<decisions>
## Implementation Decisions

### Completion Detection
- Submit the Kie.ai job with a `callBackUrl` pointing at our webhook (e.g. /api/video/callback); Kie.ai POSTs us when the job finishes — no polling infra on the happy path.
- FALLBACK: if research finds Kie.ai does not support callbacks (or for resilience), a Cloudflare Cron Trigger periodically scans video_jobs in 'processing' state and polls Kie.ai for status. Research MUST confirm Kie.ai callback support and the exact submit/status/callback API shapes.
- The callback route is server-to-server: EXEMPT from the auth middleware matcher (like the Stripe webhook); verify the callback authenticity (shared secret / signature if Kie.ai provides one — confirm in research) and treat it idempotently (a job already 'ready' is a no-op).

### Client Live Update
- After submit, the dashboard polls a lightweight status endpoint (e.g. GET /api/agent/listings/[id]/video-status) every few seconds, swapping in the video / status when status transitions to ready or failed. Stop polling on terminal state.
- The public /listings/[slug] detail page (force-dynamic) simply renders the video when listings.video_url is present; no client polling needed there.

### Provider Abstraction & Fallback (VIDEO-05)
- A provider interface (submit(photos, callbackUrl) -> taskId; getStatus(taskId) -> {status, videoUrl}) with Kie.ai as primary and a REAL HiggsField fallback adapter.
- On Kie.ai submit/processing failure: retry Kie.ai up to a small cap (e.g. 2 attempts), then fail over to HiggsField; record provider + attempts on the job. Agent sees "generation failed — retrying" status, never a silent error.
- Both adapters are production code; live provider round-trips are DEFERRED to human verification.

### Job State & Dedup (video_jobs table)
- New `video_jobs` table (migration): id, listing_id (FK), agent_id, provider, task_id, status ('queued'|'processing'|'ready'|'failed'), attempts, error, created_at, updated_at. The migration FILE is created now; application is deferred like prior phases if it needs live D1.
- DEDUP: a listing may have at most one active (queued/processing) job — the Generate-Video route returns the existing job (or 409) rather than spawning a second.
- On terminal success: write listings.video_url + video_status='ready'; on terminal failure after fallback: video_status='failed'.

### Trigger Authorization
- Generate-Video is an agent action on their OWN listing (session-derived ownership, 403 cross-agent) and requires the agent be publishable + not suspended (reuse the Phase 3/5 gates). Validates the listing has photo URLs to animate.

### Claude's Discretion
- Exact polling interval (suggest 3-5s) and max client poll duration; cron cadence if the poller fallback is used; video player markup (native <video> vs embed depending on provider output URL).
- Internal module layout of the provider abstraction; whether wrangler.toml needs a [triggers] crons entry (only if the poller fallback is implemented) and/or queue — keep infra minimal.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- listings table (0001 schema): video_url, video_status columns ALREADY exist — the final result lands here. NEW: video_jobs table via migration.
- src/app/api/stripe/webhook/route.ts (Phase 3) — template for a server-to-server webhook: raw body read, signature/secret verification, idempotency via a PK table (stripe_events analog -> video_jobs/task_id), middleware exemption.
- middleware.ts — the video callback route must be EXEMPT from the auth matcher (server-to-server).
- src/lib/subscription.ts (AGENT_VISIBLE_SQL / isAgentPublishable) + src/app/api/agent/listings/[id]/route.ts (ownership + suspension 403 pattern) — reuse for the trigger authz gate.
- src/lib/stripe.ts pattern (Workers-safe fetch client) — Kie.ai/HiggsField calls use raw fetch (no Node SDK) on the edge runtime.
- src/components/dashboard/ListingsManager.tsx — where the "Generate Video" button + status live.
- src/app/listings/[slug]/page.tsx (force-dynamic) — render the video when video_url present (Listing type already has videoUrl?).
- src/lib/listings-db.ts / src/lib/data.ts — listing reads/writes.

### Established Patterns
- Edge API routes (runtime='edge' on API routes only; force-dynamic on pages), session-derived ownership, parameterized D1 .bind(), typed NextResponse status codes.
- Webhook: raw body first, secret/signature verify, idempotent table write, middleware-exempt.
- Secrets via .dev.vars / wrangler secrets: KIE_API_KEY, HIGGSFIELD_API_KEY, and a callback secret if Kie.ai signs callbacks; document in .env.local.example.

### Integration Points
- New: POST trigger route (/api/agent/listings/[id]/video or similar), POST callback route (/api/video/callback, middleware-exempt), GET status endpoint, provider modules (src/lib/video/*), video_jobs migration, optional wrangler [triggers] cron for poller fallback.
- Modified: ListingsManager (Generate Video button + status/poll), listing detail page (render video), .env.local.example (+ video secrets), middleware matcher note for callback exemption.
</code_context>

<specifics>
## Specific Ideas
- Webhook callback is the happy path; cron poller is the resilience fallback — research confirms Kie.ai callback support + API shapes BEFORE planning commits to one.
- Dedup: at most one active job per listing; duplicate Generate-Video returns the in-flight job, never a second concurrent job (success criterion 4).
- All live provider round-trips (Kie.ai submit/callback, HiggsField fallback), the video_jobs migration application, and the cron trigger are DEFERRED to human verification; build production code + automated tests now.
- Research the Kie.ai API (Higgsfield MCP / Kie.ai docs): submit endpoint + params (image-to-video, photo URLs), task id response, status endpoint, callBackUrl support + payload, auth header; and the HiggsField generate_video equivalent.
</specifics>

<deferred>
## Deferred Ideas
- Tier-gating video behind a paid plan (V2-02), direct BytePlus/Seedance (V2-08), multi-clip/editing — post-v1.
</deferred>
