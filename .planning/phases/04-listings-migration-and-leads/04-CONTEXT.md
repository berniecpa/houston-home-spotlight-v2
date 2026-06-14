# Phase 4: Listings, Migration, and Leads - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas; user accepted 3 recommendations, overrode lead-pipeline to keep Perfex in parallel.

<domain>
## Phase Boundary

Agents with an active (or grace, or admin) subscription can create, edit, delete, and pause/activate
listings stored in Cloudflare D1. The three existing static JSON listings are migrated into D1 (owned
by Bernard's admin account) with their original `/listings/[slug]` URLs preserved and no visual
regression. The public browse (`/listings`) and detail (`/listings/[slug]`) pages read from D1 and
apply the subscription/grace gate so lapsed agents' listings disappear. Buyers submit inquiries that
are saved to D1 and emailed (Resend) to the listing agent (Reply-To = buyer) with Bernard CC'd — while
ALSO preserving the existing Perfex CRM post. Agents view their inquiries in a dashboard lead inbox.

In scope: listing CRUD (agent-owned, 403 on cross-agent), JSON→D1 migration/seed, D1-backed public
listing read path + subscription gate application (using AGENT_PUBLISHABLE_SQL from Phase 3), the
reworked /api/leads route (D1 + Resend + Perfex), and the dashboard lead inbox.

Out of scope: photo file upload / R2 (V2-03), listing analytics (V2-04), CRM pipeline stages (V2-10),
AI video (Phase 6). Admin-wide management views (Phase 5).
</domain>

<decisions>
## Implementation Decisions

### Lead Delivery Pipeline
- On inquiry submit: (1) INSERT into D1 `leads` (linked to listing_id + agent_id), (2) email via Resend to the listing agent with Reply-To = buyer's email and Bernard CC'd, AND (3) STILL post to Perfex CRM as today (keep the existing integration in parallel — do not remove it).
- Resend failure must not lose the lead: D1 insert is the source of truth; email + Perfex are best-effort side effects with error logging (never block the buyer's success response on email/CRM failure).
- Bernard's CC address comes from an env var (e.g. ADMIN_NOTIFY_EMAIL); Resend API key + from-domain from env (RESEND_API_KEY, LEAD_FROM_EMAIL).

### Public Listing Rendering
- `/listings` (browse) and `/listings/[slug]` (detail) use `export const dynamic = 'force-dynamic'` and read D1 per request (NO `runtime='edge'` — @opennextjs/cloudflare ignores it).
- Public queries apply the Phase 3 subscription gate (AGENT_PUBLISHABLE_SQL / isAgentPublishable): a listing is publicly visible only when its owning agent is publishable (active OR within grace OR admin) AND the listing's own status is 'active' (not 'paused').
- A direct slug URL for a hidden/lapsed/paused listing returns notFound() (404).
- Remove `generateStaticParams` from the detail page (no longer static); the 4 pre-existing failing tests in src/tests/listing-detail-page.test.ts are updated in this phase to match the dynamic D1 read shape.

### Migration / Seed
- The 3 legacy JSON listings (heights-bungalow-historic, riverside-terrace-modern-craftsman, sugarland-estate-pool) are seeded into D1 `listings` + `listing_images`, owned by Bernard's admin agent id, status 'active', preserving each `slug` exactly so existing URLs work.
- D1 `listings` requires `title` (JSON has none) — derive a title from the address (or a sensible constructed title) deterministically during seed.
- Seed is an idempotent SQL migration / script (INSERT OR IGNORE on slug) so re-running does not duplicate. The legacy JSON files may remain on disk but are no longer the read source.
- Map JSON fields → D1: address/city/state/zip/price/beds/baths/sqft/description direct; images[] → listing_images rows (display_order by array index); featured → keep (may need a column or derive); createdAt → created_at epoch.

### Listing CRUD & Ownership
- Create/edit/delete routes derive the agent uid from the verified session (never body); edit/delete enforce ownership → 403 on another agent's listing.
- Create is gated on the agent being publishable (active/grace/admin) — a lapsed agent cannot create new listings (consistent with the subscription model).
- LIST-05 pause/activate toggles listings.status between 'active' and 'paused'; paused = hidden from public regardless of subscription.

### Claude's Discretion
- Listing form UI layout (reuse dashboard form patterns from Phase 2 ProfileForm), lead inbox table layout (mirror dashboard styling), and internal module structure of the listings data-access layer.
- Whether to add a `featured` column to listings or derive featured another way (schema currently has no featured column — pick the least-disruptive approach; admin/Bernard listings can be featured).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- D1 schema (db/migrations/0001_initial_schema.sql): `listings` (id, agent_id FK, title, slug UNIQUE, address, city, state, zip, price, beds, baths, sqft, description, status default 'active', video_url, video_status, created_at, updated_at), `listing_images` (listing_id FK ON DELETE CASCADE, url, display_order), `leads` (listing_id, agent_id, firstname, lastname, email, phonenumber, message, created_at). NOTE: no `featured` column — decide during planning.
- src/lib/subscription.ts: `AGENT_PUBLISHABLE_SQL` + `isAgentPublishable()` from Phase 3 — apply to public listing queries here.
- src/lib/data.ts: current JSON-backed `getAllListings/getListingBySlug/getFeaturedListings/filterListings/clearListingsCache` — REWORK to read D1 (keep the same async signatures so pages/components don't change shape).
- src/types/index.ts `Listing` interface (id, slug, address, city, state, zip, price, beds, baths, sqft, description, images[], videoUrl?, featured, createdAt) — the public-facing shape the D1 read path must reconstruct.
- src/app/api/leads/route.ts: existing POST → Perfex CRM (env PERFEX_RE_URL/PERFEX_RE_KEY). EXTEND to add D1 insert + Resend; keep Perfex.
- src/components/InquiryForm.tsx: posts to /api/leads (unchanged contract).
- src/app/(dashboard)/dashboard/listings/page.tsx + leads/page.tsx: Phase 2 "coming soon" placeholders to replace with real CRUD UI + lead inbox.
- src/app/api/agent/profile/route.ts: edge API + session + parameterized D1 template for the new listing CRUD routes.
- Public pages: src/app/listings/page.tsx (browse, client filter), src/app/listings/[slug]/page.tsx (detail, currently SSG), src/app/page.tsx (home featured grid), src/components/ListingCard.tsx, PhotoGallery.tsx.

### Established Patterns
- Edge API routes: session-derived uid, parameterized D1 .bind(), typed NextResponse.json status codes; NO runtime='edge', use force-dynamic for dynamic pages.
- Resend: standard fetch to https://api.resend.com/emails with Authorization: Bearer RESEND_API_KEY (Workers-friendly, no node SDK needed) — verify approach in research.
- Secrets via .dev.vars / wrangler secrets; document new vars in .env.local.example.

### Integration Points
- /api/leads gains D1 + Resend (+ keep Perfex). New listing CRUD API routes under /api/agent/listings (or similar). Public read path swaps src/lib/data.ts to D1. Dashboard listings + leads pages get real UI. Home + listings + detail pages consume the D1-backed data layer.
- The subscription gate from Phase 3 is APPLIED here (its first real consumer).
</code_context>

<specifics>
## Specific Ideas
- Preserve exact slugs: heights-bungalow-historic, riverside-terrace-modern-craftsman, sugarland-estate-pool.
- D1 insert is the lead source of truth; Resend + Perfex are best-effort and must not block the buyer success path.
- Fix the 4 pre-existing src/tests/listing-detail-page.test.ts failures as part of reworking the detail page to D1 (they are this phase's responsibility per STATE.md).
- Live email (Resend), live D1 CRUD round-trips, and Perfex delivery are DEFERRED to human verification per the autonomous-run directive; build production code + automated tests now.
</specifics>

<deferred>
## Deferred Ideas
- Photo file upload to R2 (V2-03), per-listing analytics (V2-04), CRM pipeline stages (V2-10) — all V2.
</deferred>
