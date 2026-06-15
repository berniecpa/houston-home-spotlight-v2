# Phase 1: Infrastructure Migration - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Migrate the platform from fully-static Next.js export to Cloudflare Workers with dynamic routes. Remove `output: 'export'`, install `@opennextjs/cloudflare` (replaces archived `@cloudflare/next-on-pages`), apply the D1 schema (4 tables), configure local dev with D1 bindings, add a `/api/health` route to verify Workers runtime, and update the GitHub Actions deploy workflow to use the OpenNext build + wrangler deploy pipeline.

This phase delivers zero user-facing features — it is the architectural gate that makes all subsequent phases possible.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key decisions already made at project init (from STATE.md):
- Use `@opennextjs/cloudflare` (NOT the archived `@cloudflare/next-on-pages`) — unconditional Phase 1 gate
- D1 schema: 4 tables — `agents`, `listings`, `subscriptions`, `leads`
- Local dev: `initOpenNextCloudflareForDev()` resolves D1 bindings for `wrangler dev`
- Stripe async crypto (`constructEventAsync` + `createSubtleCryptoProvider`) needed for Workers later — schema can pre-create tables
- Grace period enforced via SQL WHERE clause on every listing query — no cron job required

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/data.ts` — primary listing data layer (module-import based today; will need D1 adapter in Phase 4)
- `src/lib/listings.ts` — duplicate unused module; candidate for deletion
- `src/app/api/leads/route.ts` — existing API route pattern (POST handler → CRM proxy)
- `next.config.mjs` — currently has `output: 'export'`; this is the primary config change target

### Established Patterns
- API routes: typed `NextResponse.json()` returns, `try/catch`, explicit HTTP status codes
- TypeScript strict mode enabled (`tsconfig.json`)
- Path alias `@/*` maps to `src/*`
- Tailwind CSS utility classes, no CSS modules

### Integration Points
- `next.config.mjs` — remove `output: 'export'`, add OpenNext config
- `package.json` — add `@opennextjs/cloudflare`, `wrangler`; update build scripts
- `.github/workflows/deploy.yml` — replace Pages static build with OpenNext + wrangler deploy
- New files needed: `wrangler.toml`, D1 migration SQL, `open-next.config.ts`

</code_context>

<specifics>
## Specific Ideas

- `/api/health` route must confirm D1 binding is accessible (query D1 version or table count) to distinguish Workers runtime from static export
- Wrangler should be configured with a `[d1_databases]` binding named `DB` (consistent with OpenNext D1 patterns)
- D1 migrations should live in `db/migrations/` to follow wrangler convention
- The existing Perfex CRM env vars (`PERFEX_RE_URL`, `PERFEX_RE_KEY`) must remain accessible — add to `wrangler.toml` vars or `[vars]` section

</specifics>

<deferred>
## Deferred Ideas

- D1 query helper/ORM wrapper (Drizzle ORM consideration) — deferred to Phase 4 when first D1 reads are needed
- R2 storage setup — explicitly out of scope (v1 photos are URL-paste only)
- Cloudflare Queues / Durable Objects for async polling — deferred to Phase 6 research

</deferred>
