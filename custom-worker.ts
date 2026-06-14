/**
 * custom-worker.ts — OpenNext custom worker extension for Houston Home Spotlight.
 *
 * This file is the OpenNext documented extension mechanism for adding Cloudflare
 * Worker handlers alongside the generated Next.js fetch handler.
 * [CITED: opennext.js.org/cloudflare/howtos/custom-worker]
 *
 * Responsibilities:
 *   1. Re-export the OpenNext-generated fetch handler so all normal HTTP
 *      requests (Next.js routes, API routes, assets) continue to work
 *      identically to the previous main = ".open-next/worker.js" entrypoint.
 *   2. Add a scheduled() handler that runs the video-job poller fallback
 *      every 5 minutes (wrangler.toml [triggers] crons).
 *
 * IMPORTANT: wrangler.toml must point main at this file:
 *   main = "./custom-worker.ts"
 * If main still points at ".open-next/worker.js" the cron trigger fires but
 * there is no scheduled export, so the poller silently no-ops (Pitfall 5).
 *
 * The D1 binding env.DB is available in scheduled() via the standard env
 * parameter identically to the fetch handler — all wrangler.toml bindings
 * (D1, secrets, vars) are forwarded to every handler.
 * [VERIFIED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/]
 *
 * LOCAL TESTING (trigger the scheduled handler in wrangler dev):
 *   curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=%2A%2F5+%2A+%2A+%2A+%2A"
 *
 * DEFERRED HUMAN VALIDATION:
 *   - Apply 0005_video_jobs migration before deploying
 *   - Confirm the cron fires and advances stale jobs in the Cloudflare dashboard
 */

// @ts-ignore `.open-next/worker.js` is generated at build time by `npm run cf:build`
// and does not exist in the source tree. TypeScript ignores the missing module;
// wrangler resolves it correctly at deploy time.
import { default as handler } from './.open-next/worker.js';
import { pollVideoJobs } from './src/lib/video/poller';

export default {
  /**
   * Delegate all standard HTTP requests to the OpenNext-generated fetch handler.
   * This preserves all Next.js routing, API routes, and asset serving.
   */
  fetch: handler.fetch,

  /**
   * Video-job poller fallback — runs on the Cloudflare Cron Trigger schedule.
   *
   * Scans video_jobs WHERE status='processing' AND updated_at < unixepoch()-300
   * (stale-job guard: jobs not updated in the last 5 minutes may have missed
   * their Kie.ai callback). For each stale job: polls the provider for status
   * and converges on the same idempotent applyTerminalResult write path as the
   * callback route — no double-write.
   *
   * ctx.waitUntil() keeps the Worker alive until the full scan completes even
   * after the scheduled handler function returns.
   * [CITED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/]
   *
   * @param _controller  ScheduledController (cron-specific metadata — unused)
   * @param env          Cloudflare Worker env with DB, KIE_API_KEY, HIGGSFIELD_API_KEY
   * @param ctx          ExecutionContext — used for ctx.waitUntil()
   */
  async scheduled(
    _controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(pollVideoJobs(env));
  },
} satisfies ExportedHandler<CloudflareEnv>;
