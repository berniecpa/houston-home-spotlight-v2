# Houston Home Spotlight — Real Estate Marketplace

## What This Is

A Houston-area real estate marketplace where licensed agents pay a monthly subscription to publish and manage property listings, and buyers browse those listings and submit inquiries. Bernard owns and administers the platform; agents self-serve via a dashboard (Firebase Auth + Stripe); listings are stored in Cloudflare D1. An AI video generation feature (Seedance + HiggsField/Kie) will let agents turn listing photos into property tour videos.

## Core Value

Agents can publish Houston listings in minutes and receive buyer inquiries directly — the platform earns recurring subscription revenue while buyers get a curated, always-current marketplace.

## Requirements

### Validated

- ✓ Public listing browse page with price/bedroom filter — existing
- ✓ Listing detail pages with photo gallery, stats, inquiry form — existing
- ✓ Lead capture POSTing to Perfex CRM — existing (Bernard-only; to be extended)
- ✓ SEO-optimized pages with JSON-LD structured data — existing
- ✓ Cloudflare Pages deployment via GitHub Actions CI — existing

### Active

**Authentication & Agents**
- [ ] Agent self-registration and login via Firebase Auth
- [ ] Agent profile management (name, photo URL, phone, brokerage, license #)
- [ ] Bernard admin panel: manage/suspend agents, view platform stats

**Listings — Agent-Managed**
- [ ] Agent dashboard: create, edit, delete their own listings
- [ ] Listing data stored in Cloudflare D1 (replaces static JSON files)
- [ ] Photos stored as pasted URLs (no file upload)
- [ ] Listing visibility tied to active subscription (grace period → offline on lapse)

**Subscriptions & Billing**
- [ ] Stripe subscription checkout for agent sign-up
- [ ] Stripe webhook handling: subscription created, renewed, cancelled, payment failed
- [ ] 7-day grace period on payment failure before listings go offline
- [ ] Agent subscription management page (upgrade, cancel, update card via Stripe portal)

**Lead Routing**
- [ ] Inquiries route to both Bernard (copy) and the listing agent (primary)
- [ ] Agent lead inbox in dashboard: view inquiries per listing

**AI Video Generation (Phase TBD)**
- [ ] Agent triggers "Generate Video" from listing dashboard
- [ ] Platform calls Seedance API with listing photo URLs
- [ ] HiggsField or Kie as alternative/fallback video generation provider
- [ ] Generated video URL saved to listing record and displayed on detail page

### Out of Scope

- Photo file upload to Cloudflare R2 — URL paste is sufficient for v1; avoid storage complexity
- MLS/IDX integration — manual listing entry only; no automated data feeds
- Buyer accounts or buyer dashboard — buyers browse as anonymous public users
- Multi-tenancy white-labeling — all agents share one platform identity (neutral marketplace)
- Per-listing pricing — subscription model only; no pay-per-listing option
- Map/school district/neighborhood search — basic price+beds filter is enough for v1
- Blog or content management — listings only
- International or multi-market listings — Houston area only

## Context

**Existing codebase state:**
- Next.js 14 App Router with `output: 'export'` (fully static SSG today)
- 3 hardcoded listing JSON files in `src/data/listings/`; import list is manually maintained in `src/lib/data.ts`
- Leads route via `/api/leads` → Perfex CRM (Bernard's Real Estate instance); env vars: `PERFEX_RE_URL`, `PERFEX_RE_KEY`
- No auth, no database, no dynamic server-side rendering today
- Deployed to Cloudflare Pages via `@cloudflare/next-on-pages`
- Known technical debt: duplicate data layer (`src/lib/listings.ts` unused), listing imports duplicated in client page

**Key architectural shift required:**
The move to Firebase Auth + Cloudflare D1 means the site can no longer be fully static. API routes will need to handle authenticated requests at runtime. The `output: 'export'` setting must be replaced with Cloudflare Workers/Pages Functions via `@cloudflare/next-on-pages`. Public listing pages can remain SSG or move to ISR; the agent dashboard will be fully dynamic.

**Tech environment:**
- Bernard uses Firebase for existing projects (Auth is the preference)
- Cloudflare is already the deployment platform — D1 (SQLite) stays in that ecosystem, no new vendor
- Stripe is the billing choice — well-documented, standard for SaaS subscriptions

## Constraints

- **Framework**: Next.js App Router — existing codebase; no rewrite
- **Auth**: Firebase Auth — Bernard's preference; not Clerk/NextAuth/Supabase Auth
- **Database**: Cloudflare D1 (SQLite) — must stay in Cloudflare ecosystem; not Postgres/Supabase/PlanetScale
- **Billing**: Stripe — subscriptions, webhooks, customer portal
- **Deployment**: Cloudflare Pages + Workers — existing; `@cloudflare/next-on-pages` adapter required for dynamic routes
- **Photos v1**: URL paste only — no file upload, no R2; keeps complexity low
- **Public UX**: Existing buyer-facing listing browse/detail experience must not regress
- **Bernard's access**: Platform owner/admin — does not pay subscription; admin role via Firebase Auth custom claim

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Subscription model (not per-listing) | Recurring revenue; simpler billing; agents are incentivized to keep listings fresh | — Pending |
| Firebase Auth (not Clerk/NextAuth) | Bernard already uses Firebase; reduces vendor sprawl | — Pending |
| Cloudflare D1 for listings data | Stay in Cloudflare ecosystem; no cold-start latency; SQLite is simple for this data shape | — Pending |
| URL-based photos (not R2 upload) | Removes storage cost and upload UX complexity for v1; agents already host photos elsewhere | — Pending |
| Grace period (7-day) on subscription lapse | Better UX than immediate cut-off; gives agents time to update billing without losing listings | — Pending |
| Leads CC Bernard on all inquiries | Bernard is platform owner; keeps him informed; agents get primary notification | — Pending |
| Static export → dynamic (Cloudflare Workers) | Required for auth, D1 queries, and Stripe webhooks at runtime | — Pending |

## Evolution
### v1.0 MVP — shipped 2026-06-15

All 6 phases code-complete; 37/37 v1 requirements implemented and code-verified; cross-phase integration clean; 1282 automated tests passing. Live-service validation (Firebase Auth, Stripe billing, Resend email, Kie.ai/HiggsField video, live D1/cron) is DEFERRED and tracked as UAT in milestones/ + per-phase *-UAT.md. Next: provision external services, apply migrations 0002–0005, deploy, and run the UAT checklists to validate end-to-end before public launch.


This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-15 after v1.0 milestone*
