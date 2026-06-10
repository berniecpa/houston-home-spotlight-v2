# Project Research Summary

**Project:** Houston Home Spotlight v2 — Real Estate Agent Marketplace SaaS
**Domain:** Two-sided subscription real estate marketplace (agent-paying, buyer-browsing)
**Researched:** 2026-06-10
**Confidence:** HIGH

## Executive Summary

Houston Home Spotlight v2 is a niche regional real estate marketplace SaaS where Houston-area agents pay a monthly subscription ($79/month recommended) to publish and manage listings, and buyers browse publicly for free. The build sits on top of an existing Next.js static site and must transition the entire deployment model before any SaaS feature work can begin. The existing `@cloudflare/next-on-pages` adapter was archived September 2025 and only supports the Edge runtime — it cannot support Firebase Auth, Cloudflare D1 access, Stripe webhook verification, or ISR. Migration to `@opennextjs/cloudflare` is the unconditional gate that all 4 research dimensions confirm must happen first.

The recommended approach is a Cloudflare-native stack: `@opennextjs/cloudflare` for deployment, Cloudflare D1 with Drizzle ORM for the database, `next-firebase-auth-edge` for Firebase Auth token verification (not `firebase-admin`, which cannot run on Workers), and Stripe with `constructEventAsync` plus `createSubtleCryptoProvider` for webhooks. The feature scope is intentionally constrained: no MLS/IDX, no buyer accounts, no file uploads, no SMS. Agents get listing CRUD, subscription billing, lead notifications, and a lead inbox. AI video generation is a confirmed differentiator but belongs in a post-launch phase after the business model is validated.

The three highest risks are: (1) writing auth or D1 code before the adapter migration is complete — the build will appear to succeed but routes will fail silently at deploy; (2) using `firebase-admin` in any Cloudflare Workers route — it throws at runtime on production even if it works locally; and (3) Stripe webhook handling — the sync body must be read as raw text before verification and `constructEventAsync` must be used with a WebCrypto provider. All three have well-documented prevention patterns baked into the architecture recommendations.

---

## Key Findings

### Recommended Stack

The stack is fully Cloudflare-native. The deployment foundation is `@opennextjs/cloudflare@^1.19.11` with `wrangler@^4.99.0`, replacing the archived `@cloudflare/next-on-pages`. The Next.js version must be pinned to `^15.5.18` within the 15.x line — upgrading to 16.x breaks the OpenNext peer dependency until 16.2.6 lands. Firebase Auth is handled client-side with the Firebase JS SDK plus `next-firebase-auth-edge@^1.12.0` on the server, which uses Web Crypto instead of Node.js crypto and works within the Workers runtime. Database is Cloudflare D1 queried via `drizzle-orm@^0.45.2` with `drizzle-kit@^0.31.10` generating SQL migrations applied by wrangler. Billing uses `stripe@^22.2.0` initialized with `Stripe.createFetchHttpClient()`. Email provider is Resend (`resend@^4.x`) for lead notifications. AI video uses Kie.ai as the v1 entry point (single API key, aggregates Kling/Veo/Seedance) with a path to direct BytePlus/Seedance in v2.

**Core technologies:**
- `@opennextjs/cloudflare@^1.19.11`: Deploy Next.js to Cloudflare Workers — replaces archived next-on-pages; enables Node.js runtime, middleware, ISR
- `wrangler@^4.99.0`: Cloudflare CLI — D1 migrations, local dev, deploy
- `next-firebase-auth-edge@^1.12.0`: Firebase Auth on Workers — uses Web Crypto, not firebase-admin; middleware + Server Component token access
- `drizzle-orm@^0.45.2` + `drizzle-kit@^0.31.10`: D1 ORM — TypeScript-first, SQL migration output consumed by wrangler
- `stripe@^22.2.0`: Subscription billing — native Workers support via `createFetchHttpClient()` + `constructEventAsync`
- `resend@^4.x`: Transactional email — lead notifications to agents + Bernard
- Kie.ai REST API: AI video generation entry point — aggregator, single API key, async task model

### Expected Features

Features research cross-referenced against kvCORE, AgentFire, Luxury Presence, Placester, RealEstateSites, and BoldLeads.

**Must have (table stakes) — v1:**
- Agent self-registration + login (Firebase Auth; email/password + email verification)
- Agent profile (name, photo URL, phone, brokerage, license #)
- Listing CRUD (create, edit, delete, status toggle — gated behind active subscription)
- Listing detail: photos, price, beds/baths, address, description
- Listing visibility tied to active subscription (webhook-driven D1 status)
- Stripe subscription checkout ($79/month, single tier, no setup fee)
- Stripe Customer Portal (self-service billing management)
- Lead/inquiry email notification to agent + Bernard via Resend
- Agent lead inbox in dashboard (D1 leads table filtered by agent_id)
- 7-day grace period on payment failure (no hard cutoff)
- Public listing browse with price + bed filter (already exists; must survive migration)
- Bernard admin panel (manage agents, suspend, view stats)
- Password reset / account recovery (Firebase built-in)
- Subscription status visible on agent dashboard

**Should have (differentiators) — v1 polish or early v2:**
- AI listing video via Kie.ai (genuine differentiator vs. comparable $49-$149/mo platforms)
- Agent public profile page (shareable URL; SEO surface)
- Graceful lapse UX (countdown banner before listings go offline)
- Listing performance analytics (views + inquiry count per listing)
- Houston neighborhood SEO pages (ISR; targets hyperlocal buyer search)

**Defer (v2+):**
- MLS/IDX integration — expensive data licensing, legal complexity
- Photo file upload to R2 — URL paste avoids storage infra in v1
- Buyer accounts — anonymous browse converts without added auth complexity
- SMS lead notifications — email is sufficient for v1
- Annual pricing option — validate monthly model first
- Map search / school district filter — engineering-heavy, low v1 priority
- Team/brokerage sub-accounts — one agent = one subscription in v1
- Built-in CRM — deliver leads to agent's existing CRM; out of scope

### Architecture Approach

The architecture is a three-tier Next.js App Router structure deployed as a Cloudflare Worker: public pages (anonymous, ISR-cached, D1-backed), an agent dashboard (Firebase Auth-gated), and an admin panel (Firebase custom claim `admin: true` required). A single `middleware.ts` using `next-firebase-auth-edge` handles auth enforcement for `/dashboard/*` and `/admin/*`. The critical security note is that middleware alone is insufficient (CVE-2025-29927 allows header manipulation to bypass Next.js middleware) — all sensitive API routes must independently re-verify tokens using `getTokens()`. Subscription state is denormalized onto the `agents` D1 row (`subscription_status`, `subscription_grace_until`) so public listing queries only require a two-table JOIN. The grace period is enforced inline in every public listing SQL query with no cron job required.

**Major components:**
1. `middleware.ts` (next-firebase-auth-edge) — auth gate; verifies Firebase cookie; enforces route protection and admin claim; must NOT be the sole auth layer (CVE-2025-29927)
2. Route Handlers (`/api/listings`, `/api/leads`, `/api/webhooks/stripe`, `/api/auth/*`, `/api/admin/*`) — all CRUD and integrations; Stripe webhook uses `constructEventAsync` + `createSubtleCryptoProvider`
3. Cloudflare D1 (agents, listings, subscriptions, leads tables) — source of truth; subscription state denormalized on agents row for fast public reads
4. `(public)` route group — ISR listing pages; visibility enforced at SQL query layer, not in UI
5. `(dashboard)` route group — agent listing CRUD, lead inbox, billing management
6. `(admin)` route group — Bernard-only; agent management, suspension, platform stats
7. Firebase Auth (external) — identity provider; ID tokens verified via Web Crypto in middleware
8. Stripe (external) — subscription lifecycle; webhooks update D1 agents + subscriptions + listings tables

**D1 schema (4 tables):** `agents`, `listings`, `subscriptions`, `leads`

Key schema decisions:
- `agents.subscription_status` and `agents.subscription_grace_until` are denormalized for fast listing visibility checks (avoids JOIN on every public page load)
- `listings.images` is a JSON TEXT array (SQLite has no native array type)
- All timestamps are Unix epochs (INTEGER) — avoids SQLite timezone ambiguity
- Grace period enforcement is a SQL WHERE clause, not a cron job

### Critical Pitfalls

1. **`@cloudflare/next-on-pages` is archived — migrate first.** Any dynamic route written against the old adapter fails at deploy. Remove `output: 'export'`, install `@opennextjs/cloudflare`, create `open-next.config.ts`, set `nodejs_compat` in wrangler config. Phase 1, Step 1, no exceptions.

2. **`firebase-admin` throws on Cloudflare Workers at runtime.** Uses `node:crypto` internals unavailable in the V8 isolate. Works in `next dev` (Node.js), crashes in production. Use `next-firebase-auth-edge` for all server-side token verification on Workers.

3. **Stripe `constructEvent` (sync) fails on Workers — use `constructEventAsync`.** Pass `Stripe.createSubtleCryptoProvider()` as the fifth argument. Read body with `request.text()` before any other processing. Parsing the body as JSON first invalidates the HMAC signature.

4. **CVE-2025-29927 middleware bypass — API routes need independent token verification.** Attackers can manipulate `x-middleware-subrequest` header to bypass Next.js middleware. Every sensitive API route must call `getTokens()` independently.

5. **D1 runaway writes — missing WHERE clause causes immediate four-figure billing.** A confirmed post-mortem: $5,000 in charges in 10 seconds from a WHERE-less UPDATE. Set Cloudflare billing alerts at $10/$50/$100 before any D1 writes reach production. Code review must include WHERE clause verification on every UPDATE/DELETE.

6. **Stripe webhook race condition on checkout redirect.** Agent dashboard loads before webhook arrives. Implement `/api/billing/sync-checkout` to fetch Stripe session directly and upsert D1 immediately — do not wait for the webhook for the post-payment success state.

7. **AI video is async-only — 30-90s exceeds Workers 30s CPU limit.** Submit job to Kie.ai, return `{ task_id, status: 'pending' }` immediately, poll for completion via background mechanism, write `video_url` to listing row on completion. Never await generation inline.

---

## Implications for Roadmap

Based on combined research, the phase structure has hard dependencies that cannot be reordered.

### Phase 1: Adapter Migration + Infrastructure Foundation
**Rationale:** All 4 research dimensions agree this is the unconditional gate. No dynamic route, auth integration, or D1 query can be correctly built or tested until `output: 'export'` is removed and `@opennextjs/cloudflare` replaces `@cloudflare/next-on-pages`. Zero user-facing features but enables everything that follows.
**Delivers:** Working Cloudflare Workers deployment; D1 schema applied (all 4 tables); wrangler dev workflow functional; local + remote D1 migration pipeline established; `next.config.mjs` migration complete; GitHub Actions deploy pipeline updated
**Avoids:** Pitfalls 1 (deprecated adapter), 4 (D1 in `next dev`), 9 (local/remote schema drift), 11 (`next/image` breakage), 13 (D1 binding name)
**Research flag:** Standard — OpenNext migration is precisely documented in Cloudflare official docs

### Phase 2: Auth + Agent Onboarding
**Rationale:** Auth is the second hard dependency. The agent dashboard, listing CRUD, and Stripe integration all require a verified identity. `next-firebase-auth-edge` middleware must be proven working before any protected route is built on top of it.
**Delivers:** Firebase Auth (login/register/email-verify/password-reset); agent profile form; HttpOnly session cookies via `next-firebase-auth-edge`; middleware protecting `/dashboard/*` and `/admin/*`; `/api/auth/login` upsert of agent row in D1 on first login; Bernard admin custom claim (`admin: true`) set via one-off script
**Addresses:** Agent self-registration, agent profile, password reset, Bernard admin access
**Avoids:** Pitfalls 2 (firebase-admin on Workers), 8 (custom claims propagation lag), CVE-2025-29927 (independent API route token verification)
**Research flag:** Needs phase research — `next-firebase-auth-edge` + `@opennextjs/cloudflare` middleware cookie interaction needs prototype verification before building auth-dependent routes

### Phase 3: Subscription Billing + Listing Visibility Gate
**Rationale:** Subscription is the business model's activation gate. Listing CRUD is gated behind an active subscription, so billing must precede listing management. Stripe webhooks set the `agents.subscription_status` field that all listing visibility queries depend on.
**Delivers:** Stripe Checkout (single tier, $79/month); Stripe Customer Portal; full webhook handler (6 minimum events); 7-day grace period (D1 query-enforced); subscription status dashboard widget; `/api/billing/sync-checkout` for race condition prevention; idempotent webhook event log in D1
**Addresses:** Subscription checkout, subscription management, subscription status display, 7-day grace period, listing visibility tied to subscription
**Avoids:** Pitfalls 3 (Stripe crypto), 5 (D1 runaway writes), 6 (webhook race condition), 7 (missing webhook events), 12 (Customer Portal pre-configuration), 14 (visibility at DB layer)
**Research flag:** Standard — Stripe subscription patterns are mature and fully confirmed

### Phase 4: Listing CRUD + Lead Routing + Public Migration
**Rationale:** Listing management and lead flow are the core product value delivery. This phase also migrates the existing static JSON listings to D1, completing the full architectural transition. Public pages are preserved with identical URLs.
**Delivers:** Agent listing CRUD with subscription gate; `/listings` and `/listings/[slug]` pages migrated from JSON to D1 with ISR (revalidate = 300); `lib/data.ts` replaced with D1 queries including grace period enforcement; lead inquiry form writing to D1 leads table; email notification via Resend; agent lead inbox in dashboard; static JSON files deleted
**Addresses:** Listing CRUD, listing detail, public browse, inquiry form, lead notification, agent lead inbox
**Avoids:** Pitfall 5 (D1 runaway writes on listing status updates), slug regression (existing URLs preserved)
**Research flag:** Standard — D1 query patterns and ISR revalidation with OpenNext are documented

### Phase 5: Admin Panel + Polish + Agent Profile Pages
**Rationale:** Admin and polish features are independently valuable but do not block core business operations. Completes the product for launch readiness.
**Delivers:** Bernard admin panel (agent list, suspend toggle, platform stats); agent public profile pages (`/agents/[slug]`); graceful lapse UX (countdown banner during grace period); listing performance analytics (views + inquiry count); Houston neighborhood SEO pages (ISR); `revalidatePath` on listing publish/unpublish
**Addresses:** Bernard admin panel, agent public profile, graceful lapse UX, listing analytics, Houston SEO
**Research flag:** Standard — admin patterns use the same auth as dashboard; no new infrastructure

### Phase 6: AI Video Generation (Post-Validation)
**Rationale:** Primary differentiator but requires async job infrastructure. Build after validating the core business model with paying agents. Also the trigger for a $129/month upgrade tier.
**Delivers:** Async video generation via Kie.ai (submit task, store task_id, poll for completion, write video_url to listing row); `video_status` column on listings table; video display on listing detail; retry + fallback to HiggsField on Kie.ai failure; credits not deducted until video_url confirmed non-null
**Addresses:** AI video differentiator; enables $129/month upgrade tier
**Avoids:** Pitfall 10 (30s Worker timeout from inline video API call)
**Research flag:** Needs phase research — Cloudflare Queues vs. Durable Objects for async polling; Kie.ai rate limits and pricing confirmation; BytePlus Seedance US regional availability

### Phase Ordering Rationale

- Phase 1 is the hard gate: `output: 'export'` makes middleware and D1 access impossible. No dynamic route can be correctly tested without this migration.
- Phase 2 before Phase 3: `/api/auth/login` upserts the agent row in D1. Stripe Checkout links a Stripe customer to that agent row. Auth must exist before billing.
- Phase 3 before Phase 4: Listing creation requires an active subscription check. The `subscription_status` D1 field must be populated by webhooks before listing CRUD can enforce the gate.
- Phase 4 bundles migration + CRUD: Migrating public listings and adding listing CRUD together avoids a gap where the schema exists but public pages still read from JSON files.
- Phase 5 can be partially parallelized with Phase 4 (admin panel depends only on auth + D1 schema, not listing CRUD).
- Phase 6 is post-launch: async job infrastructure is non-trivial and the feature validates a price increase that requires paying subscribers to test.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (Auth):** `next-firebase-auth-edge` + `@opennextjs/cloudflare` middleware cookie interaction — build a working prototype before building all auth-dependent routes. The `cookies()` from `next/headers` does not work in Workers middleware; `next-firebase-auth-edge` uses the raw request object (confirmed working in principle but needs hands-on validation in this stack combination).
- **Phase 6 (AI Video):** Cloudflare Queues vs. Durable Objects for async polling architecture; Kie.ai pricing stability; BytePlus Seedance US account setup for v2 direct integration.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Cloudflare official docs + OpenNext docs cover the exact migration steps in detail.
- **Phase 3:** Stripe subscription patterns are mature; `constructEventAsync` + WebCrypto provider confirmed; 6-event minimum list is complete.
- **Phase 4:** D1 query patterns and ISR revalidation with OpenNext are documented; Resend integration is straightforward.
- **Phase 5:** Admin panel uses the same auth pattern as dashboard; no new infrastructure required.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core packages confirmed on npm with correct versions; official docs for OpenNext, Stripe Workers support, next-firebase-auth-edge all verified |
| Features | HIGH | Cross-referenced against 7 comparable platforms; pricing benchmarks from public pricing pages; scope decisions well-justified |
| Architecture | HIGH | Route structure, D1 schema, middleware pattern, data flow all from official docs; CVE-2025-29927 from disclosed CVE report |
| Pitfalls | HIGH (critical) / MEDIUM (some) | Critical pitfalls from official sources and confirmed post-mortems; Stripe race condition and D1 billing incident from community post-mortems |

**Overall confidence:** HIGH

### Gaps to Address

- **Email provider final decision:** Resend is recommended (simpler API, generous free tier). SendGrid and Cloudflare Email Workers are alternatives. No architectural blocker either way — decision before Phase 4 implementation begins.
- **Kie.ai pricing stability:** Video generation pricing noted as potentially shifting. Confirm rate limits and per-video costs before Phase 6 planning. The async architecture is provider-agnostic so a provider swap is low-risk.
- **`next-firebase-auth-edge` middleware cookie prototype:** The cookie handling interaction with `@opennextjs/cloudflare` needs a working prototype early in Phase 2. Documented and confirmed working in principle; quirks should be caught before building dependent routes.
- **Stripe Customer Portal pre-configuration:** Must be activated manually in the Stripe Dashboard before Phase 3 UI work begins. An ops step, not a code gap, but it blocks the billing self-service feature if missed.
- **BytePlus real-name verification for v2:** BytePlus ModelArk requires regional account setup and real-name verification for US accounts. Kie.ai is the confirmed v1 path; BytePlus is the cost-optimization target for v2 at scale but availability is unconfirmed.

---

## Sources

### Primary (HIGH confidence)
- [OpenNext Cloudflare — Get Started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext Cloudflare — Bindings](https://opennext.js.org/cloudflare/bindings)
- [Cloudflare: Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [next-firebase-auth-edge — Middleware Docs](https://next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware)
- [Drizzle ORM — Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Stripe — Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Cloudflare Blog: Stripe Support in Workers](https://blog.cloudflare.com/announcing-stripe-support-in-workers/)
- [Cloudflare D1 — Migrations Reference](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1 — Local Development](https://developers.cloudflare.com/d1/best-practices/local-development/)

### Secondary (MEDIUM confidence)
- [Stripe Webhook Signatures on Cloudflare Workers](https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/)
- [Stripe Webhook Race Condition Solution](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide)
- [CVE-2025-29927 — Next.js Middleware Bypass](https://www.authgear.com/post/nextjs-middleware-authentication/)
- [D1 $5,000 Billing Incident Post-Mortem](https://www.ofsecman.io/post/postmortem-5-000-incident-in-10-seconds-due-to-cloudflare-d1)
- [Kie.ai API Documentation](https://docs.kie.ai/)
- [Seedance 2.0 API Guide 2026](https://www.nxcode.io/resources/news/seedance-2-0-api-guide-pricing-setup-2026)
- [Hard Paywall vs. Freemium Conversion](https://insart.com/case-study-insart-saas-paywalls-free-trial-conversion/)

### Tertiary (competitive context)
- AgentFire, Luxury Presence, Placester, RealEstateSites public pricing pages (feature + pricing benchmarks)
- kvCORE/BoldTrail platform overview (feature scope reference)

---
*Research completed: 2026-06-10*
*Ready for roadmap: yes*
