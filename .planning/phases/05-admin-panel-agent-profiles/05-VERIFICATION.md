---
phase: 05-admin-panel-agent-profiles
verified: 2026-06-14T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Apply slug backfill migration (IN-01 known-divergent SQL)"
    expected: "All existing agents in local and remote D1 receive a non-NULL slug. No UNIQUE-constraint abort occurs. Agents whose display_name contains characters other than spaces (apostrophes, ampersands, etc.) get a usable slug; any divergence from slugifyName is corrected when the agent re-saves their profile."
    why_human: "The backfill SQL uses chained replace() approximations that cannot strip all non-alphanumeric characters and has no numeric-suffix collision resolution. Requires agent rows to exist and a human to verify SELECT id, display_name, slug FROM agents post-migration and confirm no NULL/duplicate slugs remain."
  - test: "Live suspension round-trip on browse page and listing detail"
    expected: "After setting is_suspended=1 for an agent via PATCH /api/admin/agents/[id], all of that agent's listings disappear from /listings (browse) and /listings/[slug] (detail) returns 404. Restoring is_suspended=0 restores visibility."
    why_human: "Requires a live wrangler dev environment with real agent rows, D1 bindings, and Firebase session cookies. Cannot verify browser rendering or network round-trips statically."
  - test: "Live suspension round-trip on agent profile page"
    expected: "/agents/[slug] for a suspended agent returns 404. Unsuspending the agent makes the profile page and their listings accessible again."
    why_human: "Requires a live wrangler dev instance with agent rows and a slug (post backfill or after a profile save). Suspension path through getAgentProfileBySlug returns null, which triggers notFound() -- must confirm this produces an HTTP 404 in the actual Next.js/Cloudflare edge response."
  - test: "Lead submission refused for suspended agent listing"
    expected: "POST /api/leads with a suspended agent's listing slug returns { success: false, message: 'Listing not found.' } and writes no row to the leads table."
    why_human: "Requires a live D1 with a real agent, listing, and a suspended state to trigger the AGENT_VISIBLE_SQL path in the leads route."
  - test: "Dashboard suspended banner rendering"
    expected: "An agent with is_suspended=1 sees the 'Account suspended -- contact the administrator' red banner at the top of every /dashboard/* page. The banner disappears when is_suspended=0."
    why_human: "Requires a live browser session with a real Firebase session cookie for a suspended agent. Visual/DOM rendering cannot be verified statically."
  - test: "Admin agent list and suspend toggle -- live round-trip"
    expected: "Bernard (admin claim) opens /admin/agents, sees the paginated table showing name / email / subscription status / account status. Clicking Suspend on an agent flips the row to 'Suspended' status and restores it with Unsuspend. Prev/Next pagination works correctly."
    why_human: "Requires live Firebase admin session, D1 agent rows, and browser rendering of the AgentRow client component and router.refresh() re-fetch cycle."
  - test: "Admin API 403 from non-admin session -- live round-trip"
    expected: "A standard-agent session calling GET /api/admin/agents or PATCH /api/admin/agents/[id] directly (bypassing middleware) receives 403. Verifies the requireAdmin() defense-in-depth guard functions independently of middleware."
    why_human: "Requires crafting a live HTTP request with a valid-but-non-admin Firebase session cookie to prove the server-side guard rejects it. Cannot test runtime token decoding statically."
  - test: "isAdminRejection type guard correctness under shape evolution (IN-03)"
    expected: "When a future AdminTokenResult shape gains a message field, or a rejection shape gains uid, the guard still correctly classifies success vs rejection. Current shapes are correct; this is a forward-looking concern."
    why_human: "IN-03 was intentionally skipped (out of critical_warning scope per REVIEW-FIX). Needs a human architectural decision about whether to add an explicit kind discriminant before any future shape changes."
---

# Phase 5: Admin Panel + Agent Profiles -- Verification Report

**Phase Goal:** Bernard can manage all agents and view platform health from an admin panel, and every agent has a public profile page with their active listings.
**Verified:** 2026-06-14T00:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bernard can view a paginated list of all registered agents showing their name, email, subscription status, and account status | VERIFIED | `listAgentsPaginated` in `src/lib/admin.ts` SELECTs id/display_name/email/subscription_status/is_suspended with LIMIT/OFFSET and WR-04 null-guard; `src/app/(admin)/admin/agents/page.tsx` renders four columns (Name, Email, Subscription, Account Status) via AgentRow; admin-pages + admin-agents-api test suites pass |
| 2 | Bernard can suspend an agent and that agent's listings immediately disappear from the public browse page; unsuspending restores them | VERIFIED (code) / human_needed (live) | `AGENT_VISIBLE_SQL` composes `AGENT_PUBLISHABLE_SQL AND a.is_suspended = 0` (subscription.ts:135); applied in `getAllListings` (data.ts:110) and `getListingBySlug` (data.ts:173); `setAgentSuspended` returns changed count (WR-02); visibility-gate.test.ts + suspension-enforcement.test.ts pass; live round-trip deferred |
| 3 | Bernard can view a platform stats page showing total agents, active subscriptions, total listings, and total leads | VERIFIED | `getPlatformStats` issues 4 parallel COUNT queries (admin.ts:271-293); `src/app/(admin)/admin/stats/page.tsx` renders four stat cards; admin-stats-api.test.ts passes |
| 4 | Every agent has a public profile page at `/agents/[slug]` displaying their name, photo, brokerage, and all their active listings -- accessible without login | VERIFIED (code) / human_needed (live) | `src/app/agents/[slug]/page.tsx` is force-dynamic with no session gate; `getAgentProfileBySlug` selects display_name/photo_url/brokerage/license_number only (no email/phone); notFound() on null; AGENT_VISIBLE_SQL applied to profile listings query; agent-profile-page.test.ts + agent-profile-query.test.ts pass; live rendering deferred |

**Score:** 9/9 must-haves verified (all plan-level truths from 05-01, 05-02, 05-03; all 4 ROADMAP success criteria satisfied at code level)

### Deferred Items

None -- all code-level must-haves are satisfied. Live behavioral items are in human_verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/subscription.ts` | Exports AGENT_VISIBLE_SQL composing publishable + is_suspended=0 | VERIFIED | `export const AGENT_VISIBLE_SQL = \`(\${AGENT_PUBLISHABLE_SQL}) AND a.is_suspended = 0\`` |
| `src/lib/admin.ts` | requireAdmin (strict), listAgentsPaginated, setAgentSuspended, getPlatformStats | VERIFIED | All four exports present; strict `=== true` (WR-01); changed-count return (WR-02); `results ?? []` (WR-04) |
| `src/app/api/admin/agents/route.ts` | GET paginated list, admin-claim-guarded, MAX_PAGE clamp | VERIFIED | requireAdmin first; MAX_PAGE=1_000_000 clamp (WR-03); returns agents/total/page/pageSize |
| `src/app/api/admin/agents/[id]/route.ts` | PATCH suspend/unsuspend, boolean validation, 404 on 0 rows | VERIFIED | requireAdmin first; typeof suspended !== 'boolean' guard; 404 when changed===0 (WR-02) |
| `src/app/api/admin/stats/route.ts` | GET 4 counts, admin-claim-guarded | VERIFIED | requireAdmin first; delegates to getPlatformStats |
| `src/app/(admin)/layout.tsx` | Server-side requireAdmin choke point (BL-01 fix) | VERIFIED | async RSC; requireAdmin() + isAdminRejection + notFound(); dynamic='force-dynamic'; sidebar links to /admin/agents + /admin/stats |
| `src/app/(admin)/admin/agents/page.tsx` | Paginated RSC with 4 columns, pagination, WR-03 clamp | VERIFIED | force-dynamic; reads ?page; Math.min(rawPage, MAX_PAGE) + Math.min(requestedPage, totalPages) clamping; 4 table columns; Prev/Next; robots noindex |
| `src/app/(admin)/admin/stats/page.tsx` | 4 stat cards, force-dynamic, noindex | VERIFIED | force-dynamic; getPlatformStats; four StatCard renders; robots noindex |
| `src/components/admin/AgentRow.tsx` | 'use client' suspend toggle with isPending | VERIFIED | 'use client'; PATCH /api/admin/agents/[id]; {suspended: !isSuspended}; router.refresh(); isPending disabled state |
| `src/app/agents/[slug]/page.tsx` | force-dynamic public profile, no runtime='edge' | VERIFIED | export const dynamic='force-dynamic'; no runtime='edge'; await params; getAgentProfileBySlug; notFound() on null; ListingCard grid |
| `src/components/AgentProfileHeader.tsx` | PII-free: display_name/photo_url/brokerage/license_number only | VERIFIED | AgentProfileHeaderProps has no email/phone fields |
| `src/lib/data.ts` | getAgentProfileBySlug; AGENT_VISIBLE_SQL in profile listings | VERIFIED | Exports getAgentProfileBySlug; public-safe SELECT only; null on is_suspended===1; AGENT_VISIBLE_SQL in listings query |
| `src/app/api/agent/profile/route.ts` | slugifyName; bounded for-loop (CR-01 fix) | VERIFIED | slugifyName exported; for-loop with MAX_SLUG_COLLISION_ATTEMPTS=50; random-suffix fallback; slug written to agents WHERE id=sessionUid |
| `src/app/api/agent/listings/route.ts` | POST suspension 403 after publishability gate | VERIFIED | SELECT is_suspended; returns 403 "Account suspended -- contact the administrator." after isAgentPublishable check |
| `src/app/api/agent/listings/[id]/route.ts` | PUT/DELETE/PATCH suspension 403 via checkSuspended; GET exempt | VERIFIED | checkSuspended(db, uid) in PUT/DELETE/PATCH; absent from GET block; parameterized SELECT is_suspended |
| `src/app/(dashboard)/layout.tsx` | is_suspended selected; conditional banner with role=alert | VERIFIED | SELECT includes is_suspended; isSuspended derived; banner conditionally rendered with role="alert" |
| `db/migrations/0004_backfill_agent_slugs.sql` | Deferred backfill; UPDATE agents WHERE slug IS NULL | VERIFIED | File present; correct SQL structure; application-deferred comment with wrangler instructions |
| `src/app/api/leads/route.ts` | AGENT_VISIBLE_SQL in listing lookup | VERIFIED | Imports AGENT_VISIBLE_SQL; used in listing-lookup JOIN before lead INSERT |
| `middleware.ts` | Strict admin claim check claims['admin'] !== true | VERIFIED | `claims['admin'] !== true` (strict equality, WR-01 fix) on admin route path |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/data.ts` | `AGENT_VISIBLE_SQL` in subscription.ts | import + WHERE in getAllListings + getListingBySlug | VERIFIED | Line 23 import; L110 and L173 usage |
| `src/app/api/leads/route.ts` | `AGENT_VISIBLE_SQL` in subscription.ts | import + WHERE in listing-lookup JOIN | VERIFIED | Line 26 import; L94 usage |
| `src/app/api/agent/listings/route.ts` | `agents.is_suspended` (session uid) | POST 403 gate after publishability | VERIFIED | Lines 274-289: SELECT is_suspended; === 1 check; 403 response |
| `src/app/api/admin/agents/[id]/route.ts` | `requireAdmin` in admin.ts | first call in PATCH handler | VERIFIED | Lines 61-67: requireAdmin() + isAdminRejection check |
| `src/app/(admin)/layout.tsx` | `requireAdmin` in admin.ts | async layout as single choke point | VERIFIED | Lines 66-70: requireAdmin() + notFound() on rejection |
| `src/app/agents/[slug]/page.tsx` | `getAgentProfileBySlug` in data.ts | await call in RSC body | VERIFIED | Lines 75-80: await + notFound() on null |
| `src/app/agents/[slug]/page.tsx` | `ListingCard` component | map over profile.listings | VERIFIED | Lines 138-140: profile.listings.map |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `admin/agents/page.tsx` | `agents`, `total` | `listAgentsPaginated(db, pageSize, offset)` -> D1 SELECT with LIMIT/OFFSET | Yes -- parameterized D1 SELECT; null-guard applied | FLOWING |
| `admin/stats/page.tsx` | `stats` (4 counts) | `getPlatformStats(db)` -> 4 parallel D1 COUNT queries | Yes -- real COUNT(*) queries | FLOWING |
| `agents/[slug]/page.tsx` | `profile` (agent + listings) | `getAgentProfileBySlug(slug)` -> agent row + listing rows + image rows (D1) | Yes -- parameterized SELECT; null on unknown/suspended | FLOWING |
| `(admin)/layout.tsx` | `adminResult` | `requireAdmin()` -> getTokens -> Firebase session cookie | Yes -- live session token decoding | FLOWING |

### Behavioral Spot-Checks

SKIPPED -- all routes require Cloudflare Worker D1 bindings and live Firebase session cookies; no server running in this context. Behavioral verification deferred to human_verification items above.

### Probe Execution

SKIPPED -- no `scripts/*/tests/probe-*.sh` files exist and no PLAN mentions probes for Phase 5.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 05-03 | Paginated agent list with name, email, subscription status, account status | SATISFIED | `listAgentsPaginated` + agents/page.tsx 4-column table with Prev/Next; admin-pages.test.ts passes |
| ADMIN-02 | 05-01, 05-03 | Suspend agent -> listings hidden; unsuspend -> restored; mutation 403s | SATISFIED (code) | `AGENT_VISIBLE_SQL` gate applied in browse/detail/leads; `setAgentSuspended`; POST/PUT/DELETE/PATCH 403 guards; dashboard banner; tests pass; live: human_verification |
| ADMIN-03 | 05-03 | Platform stats: total agents, active subscriptions, total listings, total leads | SATISFIED | `getPlatformStats` 4 COUNT queries + stats/page.tsx 4 stat cards; tests pass |
| ADMIN-04 | 05-01, 05-02 | Public /agents/[slug] with name/photo/brokerage/active listings; no PII | SATISFIED (code) | `getAgentProfileBySlug` (no email/phone SELECT); force-dynamic page; notFound on suspended/unknown; AgentProfileHeaderProps has no PII fields; tests pass; live: human_verification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `db/migrations/0004_backfill_agent_slugs.sql` | 28-47 | SQLite replace() approximation of slugifyName; no numeric-suffix collision resolution (IN-01) | WARNING | Backfill may produce divergent slugs or UNIQUE-constraint abort for agents with identical display_names. Deferred by design per REVIEW-FIX; agents correct by re-saving profile. |
| `src/lib/admin.ts` | 92-94 | `isAdminRejection` uses structural in-probing, no explicit discriminant (IN-03) | WARNING (skipped per REVIEW-FIX) | Could misclassify in future if shapes evolve. Current two shapes are correct. Architectural decision deferred to human. |
| `src/app/(dashboard)/layout.tsx` | 111 | `isSuspended` defaults to false on D1 read error (IN-02) | INFO | Advisory-only; server-side 403s are real enforcement. No action required per REVIEW-FIX. |

No TBD/FIXME/XXX unreferenced debt markers found in any Phase 5 source file. Typecheck: clean. Test suite: 1133 pass / 0 fail.

### Human Verification Required

#### 1. Slug Backfill Migration Application (IN-01)

**Test:** Apply `db/migrations/0004_backfill_agent_slugs.sql` against local and remote D1 with real agent rows present. `wrangler d1 migrations apply DB --local`, then `SELECT id, display_name, slug FROM agents;`
**Expected:** All agents receive a non-NULL slug. No UNIQUE-constraint abort. Any slug divergence from `slugifyName` (apostrophes/ampersands surviving, or duplicate base slugs for same-named agents) is identified; agents correct by re-saving their profile via the dashboard.
**Why human:** SQLite chained-replace approximation differs from TypeScript `slugifyName`; duplicate-name collision behavior depends on UNIQUE constraint presence and actual D1 data. Cannot validate without real agent rows.

#### 2. Live Suspension Round-Trip (Listings Browse + Detail)

**Test:** In `wrangler dev`, set an agent's `is_suspended=1` in D1. Visit `/listings` and `/listings/[their-listing-slug]`.
**Expected:** Agent's listings disappear from browse; direct slug URL returns 404. Restore `is_suspended=0`; listings reappear.
**Why human:** Requires live D1 bindings, Firebase session cookies, and browser rendering. Static code confirms `AGENT_VISIBLE_SQL` is applied; actual HTTP response and DOM require a live run.

#### 3. Live Suspension Round-Trip (Agent Profile)

**Test:** Set `is_suspended=1` for an agent with a slug; visit `/agents/[slug]`.
**Expected:** 404 response (not an error page or empty profile). Restore `is_suspended=0`; profile shows name, photo, brokerage, license_number, active listings. Confirm no email or phone appears in page source.
**Why human:** Requires live wrangler dev + agent row with slug populated (post-profile-save or post-backfill). Page source inspection needed for PII exclusion confirmation.

#### 4. Lead Submission Refused for Suspended Agent

**Test:** POST `/api/leads` with `listingSlug` pointing to a suspended agent's listing.
**Expected:** `{ success: false, message: 'Listing not found.' }`; no new row in D1 `leads` table.
**Why human:** Requires live D1 with suspended agent + listing row to trigger AGENT_VISIBLE_SQL exclusion in the leads route lookup.

#### 5. Dashboard Suspended Banner

**Test:** Log in as an agent with `is_suspended=1`; navigate to `/dashboard`.
**Expected:** Red "Account suspended -- contact the administrator. Your listings are hidden from public view and listing actions are disabled." banner visible above dashboard content. Create/edit/delete/pause API calls return 403. GET listing list still works.
**Why human:** Requires live Firebase session for a suspended agent + browser rendering of the conditional banner.

#### 6. Admin Agent List and Suspend Toggle -- Live Round-Trip

**Test:** As Bernard (admin claim) in `wrangler dev`, open `/admin/agents`. Click Suspend on an agent. Click Unsuspend. Test Prev/Next pagination with multiple agents.
**Expected:** Table shows four columns. Button is disabled (shows "...") during request. After toggle, row reflects new account status via router.refresh(). Pagination renders correct pages.
**Why human:** Requires live admin session, real agent rows, and browser rendering of AgentRow (client component) + router.refresh() re-fetch.

#### 7. Admin API 403 Defense-in-Depth Verification

**Test:** With a valid non-admin Firebase session cookie, call `GET /api/admin/agents` and `PATCH /api/admin/agents/[id]` directly (bypassing middleware redirect).
**Expected:** Both return HTTP 403 (not redirect) from `requireAdmin()` server-side check.
**Why human:** Requires crafting raw HTTP requests with a non-admin session cookie. Cannot reproduce the middleware-bypass scenario or test runtime Firebase token decoding statically.

#### 8. isAdminRejection Type Guard (IN-03 -- Architectural Decision)

**Test:** Evaluate whether to add `kind: 'ok' | 'reject'` discriminant to `AdminTokenResult` / `AdminTokenRejection` before any future shape changes.
**Expected:** Decision documented; discriminant added if shapes are expected to evolve.
**Why human:** IN-03 was intentionally skipped per REVIEW-FIX (out of critical_warning scope). Requires a human architectural decision. No immediate danger -- current two shapes are classified correctly.

---

_Verified: 2026-06-14T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
