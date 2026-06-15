# Milestones

## v1.0 MVP (Shipped: 2026-06-15)

**Phases completed:** 6 phases, 22 plans, 20 tasks

**Key accomplishments:**

- Replaced archived @cloudflare/next-on-pages with @opennextjs/cloudflare, rewired wrangler.toml for Workers runtime, migrated /api/leads env vars to getCloudflareContext, applied D1 schema, and rewrote deployment tests for Workers assertions.
- Applied D1 migration locally (6 tables), created GET /api/health with D1 binding probe via getCloudflareContext, generated cloudflare-env.d.ts with CloudflareEnv interface using corrected cf:typegen flags, and gitignored .dev.vars.
- Rewrote deploy.yml to replace Pages static build (npm run pages:build + wrangler pages deploy) with OpenNext Workers build (npx opennextjs-cloudflare build + wrangler-action@v3 command: deploy), adding the required CLOUDFLARE_ACCOUNT_ID secret field.
- next-firebase-auth-edge@1.12.0 HttpOnly cookie session foundation wired through Cloudflare Workers middleware, with confirmed v1.12.0 API names and 17/17 automated tests passing
- Complete agent auth UI: register, verify email, login, reset password — built on Plan 02-01 session cookie foundation with Firebase error mapping and instant client-side validation
- Dashboard shell with sidebar, session gate, AUTH-05 profile-completion gate, profile PATCH route, welcome card, and Coming-soon placeholders -- closing the AUTH-05 requirement end-to-end
- Firebase admin custom-claim setter script (Node.js-only), red-sidebar admin route shell, and Workers-runtime boundary guard tests -- delivering AUTH-04 privilege boundary
- Workers-safe Stripe client factory (createFetchHttpClient + apiVersion 2026-05-27.dahlia) and subscription-status helper with admin bypass, 7-day grace SQL gate, and typed CloudflareEnv secrets.
- Three Stripe API routes with session-auth checkout (admin-blocked), portal session creation, and raw-body-first webhook handler with constructEventAsync + atomic D1 batch for 5-event subscription state machine.
- 'use client' BillingWidget rendering 4 subscription states + admin notice wired to Stripe routes, force-dynamic RSC billing page reading D1, and activated sidebar Billing link.
- D1-backed listing read path with AGENT_PUBLISHABLE_SQL subscription gate, two-query image grouping, featured column migration, idempotent 3-listing seed, and forward-looking test assertions for force-dynamic conversion.
- Agent-owned listing CRUD API with publishability gate on create, parameterized D1 write helpers, ownership SELECT before mutation (403/404 guards), isSafeHttpUrl photo URL allowlist, and ordered listing_images replace-on-edit.
- force-dynamic D1 read path: /listings (RSC+ListingsClient), /listings/[slug] (no generateStaticParams), and home featured grid all read Cloudflare D1 per request with subscription gate; test suite sealed at 850 pass / 0 fail
- D1-first lead capture with slug-to-agent JOIN resolution, best-effort Resend agent email (reply_to=buyer, cc=Bernard) and Perfex CRM via Promise.allSettled, plus a force-dynamic dashboard inbox scoped to the signed-in agent.
- Agent dashboard listings management with force-dynamic RSC shell (agent_id-scoped D1), client ListingsManager table (Edit/Delete/Pause-Activate wired to 04-02 CRUD API), and ListingForm with dynamic multi-photo URL inputs (POST/PUT).
- Shared AGENT_VISIBLE_SQL visibility gate (publishable AND not suspended) applied to public listing browse/detail/leads, plus kebab-case slug generation on profile PATCH with deferred backfill and mutation 403 guards for suspended agents
- Public /agents/[slug] force-dynamic RSC using getAgentProfileBySlug (PII-safe query with AGENT_VISIBLE_SQL gate, suspension null return) + AgentProfileHeader with no email/phone props, ListingCard grid reuse, and 48 new source-grep tests
- requireAdmin() server-side guard + paginated admin agent list with inline suspend/unsuspend toggle + platform stats page — all admin routes re-verify the Firebase admin claim before D1 access
- D1 video_jobs migration (0005) + VideoProvider interface with Kie.ai adapter (HMAC-SHA256 constant-time verify, dual-parse callback) and HiggsField fallback adapter (Key auth), plus idempotent SSRF-guarded D1 job helpers and 2-attempt failover orchestrator.
- Three HTTP routes completing the async video pipeline: POST trigger (ownership+publishable+dedup+<2s 202), HMAC-verified Kie.ai callback (idempotent D1 write, middleware-exempt), and GET status endpoint (ownership-scoped polling).
- Implemented pollVideoJobs cron-poller (stale-job D1 scan with 300s guard, provider getStatus, idempotent applyTerminalResult convergence, kie→higgsfield failover within 2-attempt cap) + OpenNext custom-worker.ts scheduled handler + wrangler.toml [triggers] cron wiring at 5-minute cadence.
- Dashboard "Generate Video" button triggers async job, polls /video-status every 4s with 5-min cap and live badge updates; public detail page renders native `<video controls>` replacing the placeholder; W1 fix ensures persisted video state shows on page load.

---
