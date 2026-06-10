# Domain Pitfalls

**Domain:** Real estate agent marketplace SaaS — Next.js App Router + Firebase Auth + Cloudflare D1 + Stripe + AI video generation
**Researched:** 2026-06-10
**Confidence:** HIGH (stack-specific sources, official docs, verified post-mortems)

---

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or major billing surprises.

---

### Pitfall 1: `@cloudflare/next-on-pages` Is Deprecated — Migration Required Before Any Dynamic Route Work

**What goes wrong:** The current codebase uses `output: 'export'` and `@cloudflare/next-on-pages`. That package is officially deprecated. It only supports the Edge runtime, meaning every server-side route requires `export const runtime = 'edge'` — and even then, Node.js APIs, `getServerSideProps`, ISR, standard image optimization, and middleware all break silently or throw cryptic errors at deploy time. You cannot build Firebase Auth, D1 queries, or Stripe webhooks on top of the old adapter without hitting its ceiling immediately.

**Why it happens:** The migration looks optional because `@cloudflare/next-on-pages` still exists on npm and the existing static site still deploys. Developers add dynamic routes before switching adapters, then discover incompatibilities deep into a feature.

**Consequences:**
- Every API route written for Node.js runtime fails at deploy
- `firebase-admin` and D1 bindings are inaccessible in Edge-only runtime
- Image optimization breaks at build time, requiring `images.unoptimized: true` as a workaround
- Middleware redirects behave differently than documented Next.js behavior

**Prevention:**
1. Migrate to `@opennextjs/cloudflare` (OpenNext) as Phase 1, Step 1 — before writing any dynamic routes.
2. Replace `getRequestContext()` imports from `@cloudflare/next-on-pages` with `getCloudflareContext()` from `@opennextjs/cloudflare`.
3. Remove `output: 'export'` from `next.config.mjs` and add an `open-next.config.ts`.
4. Set `nodejs_compat` compatibility flag and compatibility date `2024-09-23` or later in `wrangler.toml`.
5. Update GitHub Actions deploy step to use `wrangler deploy` via OpenNext build, not `@cloudflare/next-on-pages` CLI.

**Detection:** Build error: "Route X is not edge-compatible" or runtime: "getRequestContext is not a function" after adding a non-edge API route.

**Phase:** Must complete in Phase 1 (foundation) before any other dynamic work begins.

---

### Pitfall 2: Firebase Auth Token Verification — `firebase-admin` SDK Does Not Work on Cloudflare Workers

**What goes wrong:** The `firebase-admin` Node.js SDK uses `node:crypto`, `node:http`, and native gRPC bindings that do not exist in the Cloudflare Workers V8 isolate. Attempting to call `admin.auth().verifyIdToken()` in any App Router route or middleware deployed to Cloudflare Pages/Workers will throw at runtime, not at build time.

**Why it happens:** `firebase-admin` works fine in `next dev` (Node.js process) and during local wrangler testing with `nodejs_compat`, leading developers to think it works everywhere. The crash surfaces only after a production deploy or in `wrangler dev` without the compat flag.

**Consequences:**
- Every authenticated API route 500s in production
- Custom claims (`admin` role check) are unverifiable without a working token verification path
- Developers spend hours debugging before realizing the SDK is the root cause

**Prevention:**
1. Use `next-firebase-auth-edge` — it leverages the Web Crypto API (`globalThis.crypto.subtle`) and is designed for Next.js App Router middleware plus edge/Workers environments.
2. Alternatively, use `firebase-auth-cloudflare-workers` (npm: `firebase-auth-cloudflare-workers`) which manually verifies Firebase ID tokens using `jose` + Web Crypto.
3. Verify the token's `iss` claim (`https://securetoken.google.com/<PROJECT_ID>`), `aud` claim (project ID), and `exp`. Fetch Google's public keys from `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com` and cache them via Cloudflare KV or in-memory (they rotate every 6 hours).
4. For the `admin` custom claim check: after token verification, read `decodedToken.admin === true` from the decoded JWT payload — no need for `firebase-admin` for read-only claim checks.
5. Do NOT put `firebase-admin` in any route that runs on Cloudflare. Confine admin SDK usage to local scripts (e.g., seeding custom claims via a one-off Node.js script).

**Detection:** Runtime error in production: "ReferenceError: crypto.createHash is not a function" or "Cannot find module 'node:crypto'" when calling `verifyIdToken`.

**Phase:** Phase 1 (auth foundation). Get token verification right before building any protected route.

---

### Pitfall 3: Stripe Webhook Signature Verification Fails on Edge — Node.js `crypto` Not Available

**What goes wrong:** `stripe.webhooks.constructEvent()` uses the Node.js `crypto` module to compute HMAC-SHA256 for signature verification. In Cloudflare Workers/Pages Functions, this module is not available by default. The function throws at runtime. Additionally, if the request body is consumed by a JSON parser before the webhook handler reads it, the raw bytes are altered and signature verification fails even if crypto works.

**Why it happens:** The Stripe Node.js SDK targets Node.js. The raw body problem is caused by Next.js App Router automatically parsing JSON request bodies in some middleware configurations, invalidating the signature.

**Consequences:**
- All webhooks return 400 or 500, causing Stripe to retry infinitely
- Subscription state never updates in D1 (created, cancelled, payment_failed events all lost)
- Agents stay online after subscription lapses; agents cannot access dashboard after successful payment

**Prevention:**
1. Use `stripe.webhooks.constructEventAsync()` (not `constructEvent`) — the async variant accepts a `cryptoProvider` parameter. Pass `Stripe.createSubtleCryptoProvider()` (built into Stripe SDK v12+) to use Web Crypto.
2. Read the raw body with `await request.text()` — not `request.json()` — before any other processing.
3. In Next.js App Router, mark the webhook route to opt out of body parsing by ensuring no middleware runs before it that calls `.json()` on the body.
4. Correct pattern:
   ```typescript
   const body = await request.text();
   const sig = request.headers.get('stripe-signature')!;
   const event = await stripe.webhooks.constructEventAsync(
     body, sig, process.env.STRIPE_WEBHOOK_SECRET!,
     undefined,
     Stripe.createSubtleCryptoProvider()
   );
   ```

**Detection:** Stripe Dashboard shows webhook delivery failures with "No signatures found matching the expected signature for payload" or `WebhookSignatureVerificationError` in server logs.

**Phase:** Phase 2 (subscriptions). Implement from day one of the billing phase.

---

### Pitfall 4: Cloudflare D1 Is Not Accessible in `next dev` — Only in `wrangler dev`

**What goes wrong:** Running `npm run dev` (standard Next.js development server) starts a Node.js process with no access to Cloudflare bindings. Calls to `getCloudflareContext().env.DB` return `undefined` or throw. D1 is only available when the app runs inside the Cloudflare Workers runtime, which requires `wrangler dev` or a production deploy.

**Why it happens:** Next.js dev server is a Node.js process. D1 is a Cloudflare-specific binding injected by the Workers runtime. These are two different execution contexts.

**Consequences:**
- All D1 queries throw during local development unless developers know to use `wrangler dev`
- Database migrations run against `next dev` fail silently or error
- Two development commands required: `npm run dev` for fast UI iteration, `wrangler dev` for full-stack testing — developers who do not know this ship broken features

**Prevention:**
1. In `next.config.mjs`, import and call `initOpenNextCloudflareForDev()` from `@opennextjs/cloudflare` to enable binding simulation during `next dev` (requires `@opennextjs/cloudflare` v0.6+).
2. Maintain two NPM scripts: `dev` (Next.js for UI iteration) and `dev:cf` (wrangler dev for D1/KV/binding testing).
3. Run local migrations with `wrangler d1 execute DB --local --file=./schema.sql` before testing.
4. Critical: local D1 data does NOT sync to production. Use `--remote` flag explicitly when targeting production D1 from the CLI.
5. Add a guard in code: if `getCloudflareContext` returns no env in `next dev`, throw a clear developer error rather than a confusing undefined crash.

**Detection:** `TypeError: Cannot read properties of undefined (reading 'prepare')` when calling D1 in `next dev`.

**Phase:** Phase 1 (foundation). Document the two-command dev workflow before any D1 work begins.

---

### Pitfall 5: Cloudflare D1 Runaway Write Query Billing — No Cost Guardrails

**What goes wrong:** D1 charges per row written. A missing WHERE clause in an UPDATE or DELETE (easy to introduce during refactoring) updates every row in the table. Because D1 runs behind serverless auto-scaling with no per-query cost caps, a bug like `UPDATE listings SET status = 'offline'` (missing `WHERE agent_id = ?`) iterates millions of writes instantly. A confirmed post-mortem shows $5,000 in charges within 10 seconds from exactly this scenario.

**Why it happens:** SQLite's batch write semantics combined with Cloudflare's serverless billing model have no built-in circuit breakers. The mistake is easy; the fallout is immediate.

**Consequences:**
- Unexpected four-figure billing in seconds
- All agents' listings corrupted simultaneously
- No automatic rollback (D1 does not snapshot by default)

**Prevention:**
1. Every UPDATE/DELETE query must be reviewed in code review for WHERE clause presence. Add this as an explicit checklist item.
2. Set up Cloudflare billing alerts at $10, $50, and $100 thresholds (Cloudflare Dashboard > Billing > Notifications).
3. For bulk operations (e.g., "suspend all listings for lapsed agent"), log the targeted row count before executing and assert it is within expected bounds.
4. Use transactions for multi-row mutations and test with `EXPLAIN QUERY PLAN` to verify row targets.
5. Maintain a staging D1 database separate from production for any migration or batch-update testing.

**Detection:** Cloudflare Dashboard billing spike alert. There is no other automated safety net — set alerts before any D1 writes go to production.

**Phase:** All phases involving D1 writes.

---

## Moderate Pitfalls

---

### Pitfall 6: Stripe Webhook Race Condition — User Redirects Before Webhook Arrives

**What goes wrong:** When an agent completes Stripe Checkout, they are redirected to the dashboard. The frontend immediately fetches subscription status from D1. The webhook has not arrived yet (Stripe webhooks are asynchronous, typically 1–5 seconds delayed). The dashboard shows "no active subscription." Agent panics and attempts to re-subscribe, creating duplicate subscriptions.

**Why it happens:** Stripe's checkout success redirect happens client-side synchronously. Webhook delivery is asynchronous server-to-server. There is an unavoidable timing gap.

**Prevention:**
1. On successful checkout redirect, the `session_id` is returned in the URL query param. Use it to immediately call a `/api/billing/sync-checkout` endpoint that fetches the Stripe Session and Subscription via direct Stripe API call and upserts D1 — do not wait for the webhook.
2. Store `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, and `current_period_end` directly on the `agents` D1 row.
3. Implement idempotent upsert logic shared between the sync endpoint and the webhook handler so both paths produce identical database writes.
4. Optional polling fallback: if the sync endpoint returns `incomplete`, poll with exponential backoff (1s, 2s, 3s) up to 5 attempts.

**Phase:** Phase 2 (subscriptions).

---

### Pitfall 7: Missing Stripe Webhook Events — Subscription State Silently Drifts

**What goes wrong:** Most developers handle `checkout.session.completed`. They miss `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_action_required`. Subscription status in D1 drifts from Stripe's ground truth. Agents with lapsed payments stay online; agents who cancelled their subscription retain listing access.

**Why it happens:** Stripe's event model has 200+ event types. Developers test the happy path and assume edge cases are rare.

**Consequences:**
- Agents with cancelled subscriptions retain listing access (revenue lost)
- Agents on failed payment remain active past the 7-day grace period
- Stripe customer portal plan changes are not reflected in the agent dashboard

**Prevention:**
1. Handle this minimum set of events:
   - `checkout.session.completed` — provision subscription
   - `invoice.payment_succeeded` — extend `current_period_end`, clear grace period
   - `invoice.payment_failed` — set `grace_period_start = now()`, surface warning to agent
   - `customer.subscription.updated` — sync `status`, `plan`, `current_period_end`
   - `customer.subscription.deleted` — mark subscription inactive, set listing visibility offline after grace period
   - `customer.subscription.trial_will_end` — notify agent (if trials used later)
2. Store processed Stripe event IDs in a `stripe_webhook_events` D1 table with a UNIQUE constraint on `stripe_event_id`. Check before processing to ensure idempotency.
3. Return HTTP 200 within 5 seconds. D1 writes are fast enough to do synchronously in the handler — do not introduce async queuing unless write times are measurably slow.
4. Log every received webhook event type, including unhandled ones, for observability.

**Phase:** Phase 2 (subscriptions).

---

### Pitfall 8: Firebase Custom Claims — Propagation Lag After Setting Admin Role

**What goes wrong:** Firebase custom claims (`admin: true`) are embedded in the ID token. After calling `admin.auth().setCustomUserClaims()`, the existing client token is not updated. If Bernard logs in and is then granted the admin claim server-side, his current session still carries the old token without the claim. The admin panel appears inaccessible despite the claim being set.

**Why it happens:** Firebase ID tokens are JWTs with a 1-hour TTL. Claims baked into the token at issue time do not change when server-side claims are updated.

**Prevention:**
1. After setting custom claims server-side, force a token refresh on the client: `await auth.currentUser.getIdToken(true)`.
2. Build the admin role check to be explicit: verify `decodedToken.admin === true` in the server-side token verification middleware.
3. Bernard's admin claim should be set via a one-off Node.js script run locally using `firebase-admin` — not inside the app itself — to avoid bootstrap dependency on the app being fully operational.
4. Document the admin setup process. Bernard's Firebase UID and the `admin: true` claim must be set in the Firebase project console before the admin panel will work.

**Phase:** Phase 1 (auth foundation).

---

### Pitfall 9: Cloudflare D1 Local vs. Remote Schema Drift

**What goes wrong:** `wrangler dev` creates a local SQLite database in `.wrangler/state/`. This is entirely separate from the production D1 database. Schema migrations run locally do not apply to production and vice versa. Developers test against a local schema, deploy with a different production schema, and get `SQLite_ERROR: no such table` or `no such column` at runtime.

**Why it happens:** The local/remote separation is intentional for safety, but the process of running migrations against both environments is non-obvious.

**Prevention:**
1. Maintain migrations as numbered SQL files (e.g., `migrations/001_initial.sql`, `migrations/002_add_video_url.sql`).
2. Two explicit scripts: `db:migrate:local` for wrangler local state; `db:migrate:remote` for production D1 (run deliberately, not in CI by default).
3. Add a health check endpoint or startup log that lists existing tables — confirms schema state in production.
4. Never rely on the ORM or query builder to auto-migrate. D1 has no built-in migration runner; SQL file execution via `wrangler d1 execute` is the correct approach.

**Phase:** Phase 1 (foundation), and every phase that adds or changes tables.

---

### Pitfall 10: AI Video Generation — 30-Second Worker Timeout and 10% Failure Rate

**What goes wrong:** Seedance 2.0 takes 30–90 seconds to generate a 5-second 1080p video. Cloudflare Workers have a 30-second CPU time limit. If the agent UI triggers video generation and awaits the response inline in a single API route, the Worker times out before the video is ready. The generation may still complete on Seedance's side, but the client receives an error. Additionally, Seedance has a ~90% success rate, meaning 1 in 10 generations consumes full credits for unusable output.

**Why it happens:** AI video APIs are asynchronous by nature but developers implement them as synchronous HTTP request-response patterns.

**Consequences:**
- Worker timeout error before video is ready
- Agent sees an error even when the video generates successfully
- 10% of generations charge credits for no usable output
- No fallback when primary provider fails

**Prevention:**
1. Implement video generation as a background job: the `/api/listings/[id]/generate-video` route submits the job to Seedance and immediately returns `{ job_id, status: 'pending' }`.
2. Use a Cloudflare Queue or Durable Object to poll Seedance for completion and write the `video_url` back to the `listings` D1 row when done.
3. Store `video_status` (`pending` | `processing` | `complete` | `failed`) on the listing row. The agent dashboard polls or uses server-sent events to show progress.
4. On Seedance failure, retry once, then fall back to HiggsField or Kie before marking as `failed`.
5. Do not deduct any agent credit or show success UI until `video_status = 'complete'` and `video_url` is confirmed non-null.

**Detection:** `Error: Worker exceeded CPU time limit` in production logs when video generation is triggered inline.

**Phase:** Phase 3 (AI video generation). The async architecture must be designed before any provider API integration begins.

---

### Pitfall 11: `next/image` Configuration Breaks During Adapter Migration

**What goes wrong:** The current codebase uses `output: 'export'` with `images.unoptimized: true` (required for static export). After migrating to OpenNext, leaving `images.unoptimized: true` disables all optimization in production. Removing it without configuring a Cloudflare Images loader causes the build to fail.

**Prevention:**
1. After migrating to OpenNext, remove `images.unoptimized: true`.
2. For listing photos sourced from external agent-provided URLs, use a plain `<img>` element rather than `next/image` to avoid the `remotePatterns` whitelist problem.
3. If `next/image` is used for internal assets (logos, icons), configure Cloudflare Images or accept unoptimized as temporary technical debt and document it.

**Phase:** Phase 1 (adapter migration).

---

## Minor Pitfalls

---

### Pitfall 12: Stripe Customer Portal Requires Manual Dashboard Configuration

**What goes wrong:** The Stripe Customer Portal (for agents to update payment methods, cancel subscriptions) requires explicit activation and configuration in the Stripe Dashboard. Without it, the API call to create a portal session returns a generic error. Developers often discover this during integration testing rather than before building the UI.

**Prevention:** Activate and configure the Customer Portal in Stripe Dashboard (Billing → Customer Portal) before building the "Manage Subscription" button. Set cancellation policy and payment method update permissions explicitly. Test with Stripe test-mode before going live.

**Phase:** Phase 2 (subscriptions).

---

### Pitfall 13: D1 Binding Name Must Match Exactly

**What goes wrong:** If the D1 binding name in `wrangler.toml` (e.g., `DB`) does not exactly match what `getCloudflareContext().env.DB` expects in code, the binding is `undefined` at runtime with no warning. OpenNext also hardcodes `NEXT_TAG_CACHE_D1` for ISR caching — changing that name causes silent ISR failures.

**Prevention:** Treat the D1 binding name as a contract. Define it once in `wrangler.toml`. Use a TypeScript `CloudflareEnv` interface declaration to get type errors on mismatches. Never reference binding names as strings in more than one place.

**Phase:** Phase 1 (foundation).

---

### Pitfall 14: Listing Visibility Must Be Enforced at the Database Query Layer

**What goes wrong:** If subscription-based listing visibility (active vs. offline) is enforced only in client-side React state or in UI-layer conditional rendering, lapsed agents can still access listing data via direct API calls or network inspection.

**Prevention:**
1. The `listings` D1 table includes a `published` boolean column. It is set to `false` when `subscription_status` lapses beyond the 7-day grace period.
2. The public listings API route always queries `WHERE published = 1` — the gate is at data retrieval, not presentation.
3. A recurring reconciliation step (Cloudflare Cron Trigger, or checked on each read) compares `current_period_end + 7 days` against the current timestamp and updates `published` accordingly.

**Phase:** Phase 2 (subscriptions) and Phase 3 (listing management).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Adapter migration (Phase 1) | `@cloudflare/next-on-pages` deprecated; Node.js API incompatibilities | Migrate to `@opennextjs/cloudflare` as the first task |
| Auth foundation (Phase 1) | `firebase-admin` not available on Workers | Use `next-firebase-auth-edge` or `firebase-auth-cloudflare-workers` |
| Auth foundation (Phase 1) | Custom claims not reflected until token refresh | Force `getIdToken(true)` after claim update; document admin setup process |
| D1 schema (Phase 1) | Local/remote schema drift | Version-control SQL migration files; run migrations explicitly against both environments |
| D1 writes (all phases) | Missing WHERE clause causes runaway billing | Code review checklist item; Cloudflare billing alerts at $10/$50/$100 |
| next/image (Phase 1) | Build failure after removing `output: 'export'` | Remove `images.unoptimized: true`; use `<img>` for external listing photo URLs |
| D1 local dev (Phase 1) | D1 binding unavailable in `next dev` | Use `initOpenNextCloudflareForDev()`; document two dev commands |
| Subscription billing (Phase 2) | Stripe webhook raw body consumed | Use `request.text()`; use `constructEventAsync` + `createSubtleCryptoProvider` |
| Subscription billing (Phase 2) | Race condition on checkout redirect | Implement `/api/billing/sync-checkout` endpoint; poll with backoff |
| Subscription billing (Phase 2) | Missing webhook event handlers | Handle all 6 minimum event types; idempotency via `stripe_webhook_events` table |
| Subscription billing (Phase 2) | Stripe Customer Portal not pre-configured | Activate in Dashboard before building the UI button |
| Listing visibility (Phase 2-3) | Visibility check is client-side only | Enforce `WHERE published = 1` at D1 query layer |
| AI video generation (Phase 3) | Synchronous video API call exceeds 30s timeout | Background job pattern; never await generation inline in a Worker route |
| AI video generation (Phase 3) | Seedance 10% failure rate and no fallback | Retry once, then fall back to HiggsField/Kie; confirm `video_url` before showing success |

---

## Sources

- `@cloudflare/next-on-pages` deprecation notice: [github.com/cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages) — HIGH confidence
- OpenNext Cloudflare adapter: [opennext.js.org/cloudflare](https://opennext.js.org/cloudflare) — HIGH confidence
- OpenNext bindings guide: [opennext.js.org/cloudflare/bindings](https://opennext.js.org/cloudflare/bindings) — HIGH confidence
- Firebase Auth on Cloudflare Workers: [firebase-auth-cloudflare-workers (GitHub)](https://github.com/Code-Hex/firebase-auth-cloudflare-workers) — HIGH confidence
- next-firebase-auth-edge middleware docs: [next-firebase-auth-edge-docs.vercel.app](https://next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware) — HIGH confidence
- Stripe Web Crypto / Workers support: [blog.cloudflare.com/announcing-stripe-support-in-workers](https://blog.cloudflare.com/announcing-stripe-support-in-workers/) — HIGH confidence
- Stripe webhook edge runtime verification: [jross.me/verifying-stripe-webhook-signatures-cloudflare-workers](https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/) — HIGH confidence
- Stripe webhook race condition + sync-checkout pattern: [excessivecoding.com/blog/billing-webhook-race-condition-solution-guide](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide) — MEDIUM confidence
- Stripe webhook idempotency: [dev.to/belazy/the-race-condition-stripe-webhooks](https://dev.to/belazy/the-race-condition-youre-probably-shipping-right-now-with-stripe-webhooks-mj4) — MEDIUM confidence
- D1 limits (official): [developers.cloudflare.com/d1/platform/limits](https://developers.cloudflare.com/d1/platform/limits/) — HIGH confidence
- D1 local development guide: [developers.cloudflare.com/d1/best-practices/local-development](https://developers.cloudflare.com/d1/best-practices/local-development/) — HIGH confidence
- D1 $5,000 billing incident post-mortem: [ofsecman.io/post/postmortem-5-000-incident-due-to-cloudflare-d1](https://www.ofsecman.io/post/postmortem-5-000-incident-in-10-seconds-due-to-cloudflare-d1) — MEDIUM confidence
- Seedance 2.0 pricing/reliability: [cutout.pro/learn/blog-seedance-2-0-pricing](https://www.cutout.pro/learn/blog-seedance-2-0-pricing/) — MEDIUM confidence
- Seedance 2.0 API on fal.ai: [fal.ai/seedance-2.0](https://fal.ai/seedance-2.0) — MEDIUM confidence
- Higgsfield reliability/rate limits: [geo.higgsfield.ai/task/blog/drawbacks-of-higgsfield-ai](https://geo.higgsfield.ai/task/blog/drawbacks-of-higgsfield-ai) — MEDIUM confidence
- Next.js + Cloudflare Pages incompatibilities: [thomasdesmond.me/posts/nextjs-pages-cloudflare-pages](https://thomasdesmond.me/posts/nextjs-pages-cloudflare-pages/) — MEDIUM confidence
