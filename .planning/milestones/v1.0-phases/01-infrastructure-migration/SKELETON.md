# Walking Skeleton — Houston Home Spotlight v2

**Phase:** 1
**Generated:** 2026-06-10

## Capability Proven End-to-End

A deployed Cloudflare Worker serves the existing public listing pages dynamically, and
GET /api/health returns { ok: true, runtime: 'cloudflare-workers', d1_tables: 6 } —
confirming the full stack (Next.js App Router -> Cloudflare Worker -> D1 database) is
live and queryable at the edge.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15.5.2 App Router | Existing codebase; no rewrite; supported by @opennextjs/cloudflare adapter |
| Workers adapter | @opennextjs/cloudflare 1.19.11 | Official Cloudflare-maintained OpenNext adapter; replaces archived @cloudflare/next-on-pages; handles RSC, streaming, chunking |
| Data layer | Cloudflare D1 (SQLite at edge) | Must stay in Cloudflare ecosystem (locked); zero-latency co-location with Worker; wrangler-managed migrations |
| Auth | Firebase Auth + next-firebase-auth-edge | Bernard's preference (locked); firebase-admin throws on Workers runtime; next-firebase-auth-edge handles server-side token verification via HttpOnly cookie (Phase 2) |
| Billing | Stripe + constructEventAsync + createSubtleCryptoProvider | Locked; sync constructEvent unavailable on Workers; async crypto provider required (Phase 3) |
| Deployment target | Cloudflare Workers via wrangler deploy | Edge performance; D1 binding; dynamic routes; replaces static Pages export |
| Local dev | next dev + initOpenNextCloudflareForDev() | Reads wrangler.toml; proxies D1 to local sqlite; no separate wrangler dev needed |
| Directory layout | src/ unchanged + db/migrations/ new | App Router in src/app/; API routes in src/app/api/; D1 migrations in db/migrations/ |
| Secret management | wrangler secret put (remote) + .dev.vars (local gitignored) | process.env unavailable in Workers; all env vars via getCloudflareContext().env |
| Grace period enforcement | SQL WHERE clause on every listing query | No cron required; subscription_grace_until INTEGER compared to unixepoch() at query time (locked) |
| AI video provider | Kie.ai (Phase 6) | Aggregates Kling/Veo/Seedance; BytePlus direct deferred as v2 cost optimization |

## Stack Touched in Phase 1

- [x] Project scaffold — @opennextjs/cloudflare installed; cf:build/cf:deploy/db:migrate:* scripts added; @cloudflare/next-on-pages removed; open-next.config.ts created
- [x] Routing — existing App Router routes preserved; output: 'export' removed; dynamic Workers routing enabled
- [x] Database — D1 schema applied (6 tables); GET /api/health queries sqlite_master (real D1 read via db.prepare().first())
- [x] API — GET /api/health created (dynamic route returning Workers runtime proof); POST /api/leads migrated to Workers env
- [x] Deployment — GitHub Actions updated to OpenNext build + wrangler deploy; production Worker live on push to main

## Configuration Contracts (Subsequent Phases Must Not Change)

| Contract | Value | Where Set |
|---|---|---|
| D1 binding name | DB | wrangler.toml [[d1_databases]] binding = "DB" |
| Worker name | houston-home-spotlight-v2 | wrangler.toml name field |
| compatibility_date | 2024-12-30 | wrangler.toml — minimum required by @opennextjs/cloudflare |
| compatibility_flags | nodejs_compat, global_fetch_strictly_public | wrangler.toml |
| Env var access pattern | const { env } = await getCloudflareContext({ async: true }) | All API routes — process.env unavailable in Workers |
| Forbidden export | export const runtime = 'edge' | Never set — @opennextjs/cloudflare does not support edge runtime |
| Migration directory | db/migrations/ | wrangler.toml migrations_dir = "db/migrations" |
| Build output | .open-next/ | opennextjs-cloudflare build output; gitignored |
| Local secrets file | .dev.vars | gitignored; wrangler reads automatically in next dev |

## Out of Scope (Deferred to Later Phases)

- Authentication, sessions, email verification, password reset (Phase 2)
- Agent dashboard, registration, login (Phase 2)
- Stripe subscriptions and webhook handling (Phase 3)
- Listing CRUD; JSON-to-D1 migration for existing listings (Phase 4)
- Buyer inquiry submission via Resend email (Phase 4)
- Admin panel, agent public profiles (Phase 5)
- AI video generation via Kie.ai (Phase 6)
- D1 query helper / Drizzle ORM (deferred to Phase 4)
- R2 photo storage (v2 only — v1 uses URL paste)
- Cloudflare Queues / Durable Objects (Phase 6 research required)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton. The architectural decisions
above are NOT renegotiated in subsequent phases.

- Phase 2: Agent can register with email/password, verify email, log in with persistent
  HttpOnly cookie session, reset password, and complete profile
- Phase 3: Agent can subscribe via Stripe Checkout; D1 tracks subscription status via webhooks;
  grace period enforced; billing self-service via Customer Portal
- Phase 4: Agent can create/edit/delete listings stored in D1; public pages migrate from JSON
  to D1; buyers submit inquiries routed to agent + Bernard via Resend
- Phase 5: Bernard manages agents from admin panel; agents have public profile pages at /agents/[slug]
- Phase 6: Agent generates listing videos via Kie.ai async pipeline; video surfaces on listing detail page
