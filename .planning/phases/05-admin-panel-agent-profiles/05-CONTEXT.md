# Phase 5: Admin Panel + Agent Profiles - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas; user accepted all 4 recommendations.

<domain>
## Phase Boundary

Bernard (admin) can manage all agents and view platform health from the admin panel at /admin,
and every agent has a public profile page at /agents/[slug] listing their active listings. In scope:
the admin agent list (paginated, name/email/subscription status/account status) with suspend/unsuspend
toggle, the platform stats page (total agents, active subscriptions, total listings, total leads), the
public agent profile page, and agent-slug generation/backfill. Suspension hides an agent's listings
from public browse and their profile, and makes their dashboard read-only — composing with the Phase 3
subscription gate.

Out of scope: editing agent profile fields or deleting accounts from admin (v1 = view + suspend only);
team/brokerage sub-accounts (V2-09); admin analytics beyond the 4 counts; AI video (Phase 6).
</domain>

<decisions>
## Implementation Decisions

### Agent Profile Slug
- Auto-generate a kebab-case slug from display_name with a numeric suffix on collision (jane-smith, jane-smith-2).
- Assigned/refreshed when the agent completes or updates their profile (extend the existing /api/agent/profile PATCH). Backfill existing agents (one-time migration or lazy on-read) so /agents/[slug] resolves.
- Slug uniqueness enforced (agents.slug is already UNIQUE in schema).

### Public Profile Exposure (PII)
- /agents/[slug] shows: display_name, photo_url, brokerage, license_number, and the agent's ACTIVE, publicly-visible listings only.
- NEVER expose email or phone on the public profile — buyers contact via the per-listing inquiry form. Avoids scraping/PII leakage.
- Accessible without login (public page, force-dynamic reading D1).

### Suspension Semantics (ADMIN-02)
- Suspending sets agents.is_suspended=1. Effects: (a) all the agent's listings disappear from public browse AND their /agents profile; (b) the /agents/[slug] page returns notFound() while suspended; (c) the agent can still log in but the dashboard is READ-ONLY with a visible "Account suspended — contact the administrator" banner — listing create/edit/delete/pause blocked server-side (403) and disabled in the UI.
- Data RETAINED; unsuspending (is_suspended=0) restores public visibility and dashboard write access.
- ENFORCEMENT: public visibility now requires is_suspended=0 IN ADDITION TO the Phase 3 publishable gate. Extend public listing reads (src/lib/data.ts getAllListings/getListingBySlug) and the lead-lookup gate with `a.is_suspended = 0`. Listing-mutation routes (Phase 4 /api/agent/listings*) add an is_suspended check → 403.

### Admin Agent List (v1 scope)
- Paginated list of all agents: display_name, email, subscription_status, account status (active/suspended). Server-side pagination (LIMIT/OFFSET + total count).
- Inline suspend/unsuspend toggle → admin-only API route (PATCH) flipping is_suspended; admin-claim verified server-side (never trust client).
- NO editing agent profile fields and NO account deletion in v1.
- All admin routes/pages guarded by the Firebase admin claim (middleware protects /admin/*; admin API routes must independently re-verify the claim server-side).

### Claude's Discretion
- Admin table layout, pagination size (suggest 25/page), stats card layout (mirror dashboard styling).
- Slug backfill as SQL migration vs lazy on-read — pick the most robust; if it needs agent rows to exist, defer application like the Phase 4 seed.
- Internal module structure of admin data-access helpers.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/app/(admin)/layout.tsx + src/app/(admin)/admin/page.tsx — admin shell from Phase 2 (red sidebar + ADMIN badge), middleware-guarded by the admin claim. FILL /admin + add admin sub-pages (agents list, stats).
- middleware.ts — already gates /admin/* on decodedToken.admin; admin API routes must ALSO re-verify server-side.
- agents table (0001 schema): is_admin, is_suspended (default 0), slug (UNIQUE), subscription_status, display_name, photo_url, brokerage, license_number, email — NO new columns required.
- src/lib/subscription.ts AGENT_PUBLISHABLE_SQL + isAgentPublishable — compose with is_suspended=0 for public visibility.
- src/lib/data.ts getAllListings/getListingBySlug — extend with is_suspended=0; ADD a by-agent-slug active-listings query for the profile page.
- src/app/api/agent/profile/route.ts — extend PATCH to generate/refresh the agent slug.
- src/app/api/agent/listings/* (Phase 4) — add is_suspended → 403 guard on mutations.
- src/lib/listings-db.ts — reuse for profile-page active-listings query.
- src/components/dashboard/* + ListingCard.tsx — styling + the card to reuse on the public profile.

### Established Patterns
- Edge API routes: session-derived uid, admin-claim re-verification for admin routes, parameterized D1 .bind(), typed NextResponse status; NO runtime='edge' on pages (force-dynamic only); API routes may use runtime='edge'.
- Public pages: force-dynamic RSC reading D1 via getCloudflareContext.
- Pagination: server-side LIMIT/OFFSET with total count.

### Integration Points
- New: /agents/[slug] public profile; /admin agent list + stats; admin API route(s) for suspend toggle + stats counts.
- Modified: public listing reads gain is_suspended=0; listing-mutation routes gain is_suspended 403 guard; profile PATCH gains slug generation; dashboard shows suspended banner + disables actions.
- ListingCard / listing detail may link to the owning agent's /agents/[slug] profile.
</code_context>

<specifics>
## Specific Ideas
- Public visibility is now a 3-part gate: subscription publishable (Phase 3) AND listing.status='active' (Phase 4) AND agent.is_suspended=0 (Phase 5). Apply to browse, detail, profile, and lead-lookup consistently.
- Admin API routes must re-verify the Firebase admin claim server-side, not rely solely on middleware.
- Live admin actions, slug-backfill application, and visual checks are DEFERRED to human verification per the autonomous-run directive; build production code + automated tests now.
</specifics>

<deferred>
## Deferred Ideas
- Team/brokerage sub-accounts (V2-09), admin profile editing / account deletion, richer admin analytics — post-v1.
</deferred>
