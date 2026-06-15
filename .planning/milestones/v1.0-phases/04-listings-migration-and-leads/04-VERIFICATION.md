---
phase: 04-listings-migration-and-leads
verified: 2026-06-14T14:00:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Apply migrations 0002 + 0003 and confirm 3 legacy slugs resolve"
    expected: "wrangler d1 execute shows seeded=3; /listings/heights-bungalow-historic, /listings/riverside-terrace-modern-craftsman, /listings/sugarland-estate-pool all return 200 with correct data"
    why_human: "Seed requires Bernard's admin agents row (is_admin=1) to exist in D1 before applying 0003; cannot be confirmed statically — only post-apply query can verify"
  - test: "Live D1 listing CRUD round-trip via wrangler dev"
    expected: "POST creates listing + images (201); GET returns it; PUT updates fields + preserves original slug; PATCH toggles status; DELETE removes listing and cascades images; listing appears/disappears on public /listings accordingly"
    why_human: "Requires wrangler dev with applied migrations and a live D1 binding"
  - test: "Subscription gate on listing create: lapsed agent receives 403"
    expected: "POST /api/agent/listings with lapsed agent session returns 403 Active subscription required to create listings"
    why_human: "Requires a live session with subscription_status=lapsed in D1 to exercise the isAgentPublishable path"
  - test: "Cross-agent 403 enforcement on PUT/DELETE/PATCH"
    expected: "Direct API call to PUT/DELETE/PATCH /api/agent/listings/[id] with a session belonging to a different agent than the listing owner returns 403 Forbidden"
    why_human: "The dashboard UI only surfaces the signed-in agent's own listings so this gate must be tested via a direct API call"
  - test: "Resend email delivery — listing agent receives email; Bernard receives CC"
    expected: "After submitting inquiry on a live listing detail page, the listing agent receives an email with reply_to=buyer address; Bernard (ADMIN_NOTIFY_EMAIL) receives CC; buyer sees 200 success"
    why_human: "Requires RESEND_API_KEY, LEAD_FROM_EMAIL (verified Resend domain), and ADMIN_NOTIFY_EMAIL in .dev.vars; live email delivery cannot be confirmed statically"
  - test: "Best-effort lead behavior — Resend failure does not block buyer success"
    expected: "Setting an invalid RESEND_API_KEY and submitting an inquiry still returns 200 success to the buyer; D1 leads row is still written; console.error logged"
    why_human: "Requires wrangler dev with a deliberately broken RESEND_API_KEY to prove the Promise.allSettled path end-to-end"
  - test: "Dashboard lead inbox shows agent own leads only (LEAD-05)"
    expected: "Agent at /dashboard/leads sees submitted inquiries with name/email/phone/message/date columns; a second agent logged in separately sees only their own leads"
    why_human: "Requires two live agent sessions in wrangler dev with lead rows in D1; cross-agent isolation cannot be confirmed by static grep"
  - test: "CR-02 edit data-flow: edit form pre-fills all fields from real listing data"
    expected: "Opening edit modal for a listing shows Loading listing details spinner then pre-fills city/state/zip/sqft/description from the actual D1 record; saving does not overwrite those fields with defaults"
    why_human: "The useEffect fetch and seedFromDetail logic is code-correct but the actual UX flow requires a manual dashboard click-through against live D1"
  - test: "WR-05 product decision: leads GATED on active/publishable listing"
    expected: "Bernard should confirm whether pausing a listing should block new buyer inquiries (current: 400 Listing not found, no lead recorded) vs capturing good-faith inquiries even for paused listings"
    why_human: "Product decision — two valid behaviors; Bernard must choose; revert is one query change in /api/leads/route.ts"
  - test: "Public listing pages — no visual regression from JSON-to-D1 switch"
    expected: "/listings browse page shows hero, filter bar, results count, and responsive card grid identical to previous static rendering; /listings/[slug] shows gallery, stats, description, JSON-LD, and inquiry form unchanged"
    why_human: "Visual regression requires human inspection in a browser after migrations applied"
---

# Phase 4: Listings, Migration, and Leads Verification Report

**Phase Goal:** Agents with active subscriptions can create, edit, and delete listings stored in D1; the three existing static JSON listings are migrated and all public URLs preserved; buyers can submit inquiries that route to both the listing agent and Bernard via email.
**Verified:** 2026-06-14T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getAllListings/getListingBySlug read from D1 and apply the subscription gate | VERIFIED | `src/lib/data.ts:96-143,158-192` — both functions call `getCloudflareContext`, JOIN agents, embed `AGENT_PUBLISHABLE_SQL` + `l.status = 'active'` in WHERE |
| 2 | Hidden/lapsed/paused listings excluded from public D1 reads | VERIFIED | `data.ts:108-110,171-173` — gate in both SELECT queries; getListingBySlug returns null → notFound() |
| 3 | The featured column exists on listings before any seed runs | VERIFIED | `0002_add_featured_column.sql:10` — ALTER TABLE ADD COLUMN featured INTEGER NOT NULL DEFAULT 0; numbered 0002 before 0003 |
| 4 | Re-runnable seed inserts 3 legacy listings with exact slugs preserved | VERIFIED | `0003_seed_legacy_listings.sql:54,75,96` — exact slugs; all INSERT OR IGNORE + WHERE EXISTS guard; application deferred (human step) |
| 5 | A publishable agent can create a listing with multiple photo URLs | VERIFIED | `route.ts POST:238-251` validates imageUrls array with isSafeHttpUrl; `listings-db.ts:117-126` inserts each with display_order=index |
| 6 | Agent can edit and delete only their own listings; cross-agent returns 403 | VERIFIED | `[id]/route.ts:75-122` resolveOwnership SELECTs agent_id, returns 403 when agent_id !== uid; all PUT/DELETE/PATCH go through this preamble |
| 7 | A lapsed agent is blocked from creating listings (403) | VERIFIED | `route.ts POST:255-265` — isAgentPublishable gate; returns 403 "Active subscription required to create listings" |
| 8 | The /listings browse page renders D1 listings server-side with subscription gate | VERIFIED | `listings/page.tsx:11,25-26` — force-dynamic; await getAllListings(); renders ListingsClient with initialListings |
| 9 | The /listings/[slug] detail page is force-dynamic and 404s on hidden/missing slugs | VERIFIED | `[slug]/page.tsx:12,18` — force-dynamic; imports only getListingBySlug; no generateStaticParams; notFound() when null |
| 10 | A buyer inquiry is saved to D1 leads as source of truth | VERIFIED | `leads/route.ts:107-134` — INSERT INTO leads before allSettled; inner try/catch can return 500; only this can fail the buyer |
| 11 | Resend + Perfex are best-effort and never block buyer success | VERIFIED | `leads/route.ts:140-164` — Promise.allSettled; both helpers non-throwing; 200 returned unconditionally after allSettled |
| 12 | The listing agent receives email (reply_to buyer) with Bernard CC'd | VERIFIED | `leads.ts:108-126` — to:[agentEmail], cc:[adminEmail], reply_to:buyerEmail; buyer values HTML-escaped (BL-01 fix commit 6e5b627); live delivery deferred |
| 13 | An agent sees their own inquiries in the dashboard lead inbox | VERIFIED | `dashboard/leads/page.tsx:89-98` — force-dynamic RSC; SELECT FROM leads WHERE agent_id = uid; 5-column table |

**Score:** 13/13 truths verified

### Deferred Items

None — all must-haves pass at code level. Human verification items are blocked on live infrastructure (D1 migrations applied, live Resend credentials), not on missing code.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/migrations/0002_add_featured_column.sql` | featured INTEGER column | VERIFIED | Line 10: ALTER TABLE listings ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 |
| `db/migrations/0003_seed_legacy_listings.sql` | idempotent 3-listing seed | VERIFIED | 3x INSERT OR IGNORE...SELECT...WHERE EXISTS; images with display_order; exact slugs present |
| `src/lib/data.ts` | D1-backed read functions with gate | VERIFIED | 237 lines; imports getCloudflareContext + AGENT_PUBLISHABLE_SQL; 4 exported async functions; no JSON imports |
| `src/lib/listings-db.ts` | D1 write helpers | VERIFIED | 276 lines; create/update/delete/replaceImages/setListingStatus all exported; ListingUpdateFields = Omit<ListingWriteFields,'slug'> confirms CR-02 fix |
| `src/lib/leads.ts` | sendLeadEmail + sendToPerfex best-effort | VERIFIED | escapeHtml/stripNewlines at lines 48-68; both helpers return Promise<void> with no throw paths |
| `src/app/api/agent/listings/route.ts` | GET (list own) + POST (create) | VERIFIED | Both handlers exported; runtime='edge'; POST gated on isAgentPublishable; 409 slug collision guard |
| `src/app/api/agent/listings/[id]/route.ts` | GET (detail) + PUT + DELETE + PATCH | VERIFIED | 4 handlers exported; resolveOwnership shared preamble; GET added by CR-02; slug NOT regenerated on PUT |
| `src/app/api/leads/route.ts` | D1 insert + best-effort side effects | VERIFIED | INSERT INTO leads + Promise.allSettled + AGENT_PUBLISHABLE_SQL gate (WR-05 fix) |
| `src/app/listings/page.tsx` | force-dynamic RSC | VERIFIED | force-dynamic; no use client; await getAllListings() → ListingsClient |
| `src/app/listings/ListingsClient.tsx` | client filter shell | VERIFIED | use client; receives initialListings:Listing[]; FilterBar + grid |
| `src/app/listings/[slug]/page.tsx` | force-dynamic detail, no generateStaticParams | VERIFIED | force-dynamic; no generateStaticParams; sqft > 0 guard (WR-03 fix) at line 373 |
| `src/app/(dashboard)/dashboard/listings/page.tsx` | RSC shell scoped by agent_id | VERIFIED | force-dynamic; SELECT WHERE agent_id = uid; passes initialListings to ListingsManager |
| `src/components/dashboard/ListingsManager.tsx` | client table with CRUD actions | VERIFIED | use client; fetches /api/agent/listings; PATCH/DELETE handlers; server-refetch after delete (WR-08 fix) |
| `src/components/dashboard/ListingForm.tsx` | create/edit form with multi-photo URLs | VERIFIED | use client; method:'POST' and method:'PUT' explicit literals; useEffect fetches GET /api/agent/listings/[id] in edit mode (CR-02 fix) |
| `src/app/(dashboard)/dashboard/leads/page.tsx` | agent lead inbox | VERIFIED | force-dynamic RSC; SELECT FROM leads WHERE agent_id = uid; 5-column table; empty state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/lib/data.ts` | `src/lib/subscription.ts` | AGENT_PUBLISHABLE_SQL import + WHERE embed | VERIFIED | Line 22 import; used in both getAllListings (line 109) and getListingBySlug (line 172) |
| `src/lib/data.ts` | `@opennextjs/cloudflare` | getCloudflareContext({ async: true }) | VERIFIED | Line 21 import; called in every exported function |
| `src/app/api/agent/listings/route.ts` | `src/lib/subscription.ts` | isAgentPublishable gate on POST | VERIFIED | Lines 32-33 imports; POST line 257 applies gate |
| `src/app/api/agent/listings/[id]/route.ts` | listings.agent_id | ownership SELECT before mutate | VERIFIED | resolveOwnership line 104: SELECT agent_id FROM listings WHERE id=?; 403 on mismatch |
| `src/app/api/leads/route.ts` | leads (D1) | INSERT INTO leads as source of truth | VERIFIED | Lines 110-124: parameterized INSERT with all fields |
| `src/app/api/leads/route.ts` | `src/lib/leads.ts` | Promise.allSettled([sendLeadEmail, sendToPerfex]) | VERIFIED | Lines 140-157: allSettled pattern; both helpers imported from @/lib/leads |
| `src/app/(dashboard)/dashboard/leads/page.tsx` | leads (D1) | SELECT FROM leads WHERE agent_id = uid | VERIFIED | Lines 89-98: parameterized query scoped to session uid |
| `src/app/listings/page.tsx` | `src/lib/data.ts` | await getAllListings() then ListingsClient | VERIFIED | Lines 13,25: import + await |
| `src/app/listings/[slug]/page.tsx` | `src/lib/data.ts` | getListingBySlug(slug) then notFound() | VERIFIED | Lines 18,29: import + parameterized call |
| `src/components/dashboard/ListingForm.tsx` | `/api/agent/listings/[id]` | GET detail fetch in edit mode (CR-02) | VERIFIED | Lines 193-194: fetch in useEffect on edit mode |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `src/app/listings/page.tsx` | listings | getAllListings() → D1 SELECT with JOIN agents gate | Yes | FLOWING |
| `src/app/listings/[slug]/page.tsx` | listing | getListingBySlug(slug) → D1 SELECT bound to slug | Yes | FLOWING |
| `src/app/(dashboard)/dashboard/leads/page.tsx` | leads | SELECT FROM leads WHERE agent_id = uid | Yes | FLOWING |
| `src/app/(dashboard)/dashboard/listings/page.tsx` | listings | SELECT FROM listings WHERE agent_id = uid | Yes | FLOWING |
| `src/components/dashboard/ListingsManager.tsx` | listings | initialListings (server) + GET refresh after mutation | Yes | FLOWING |
| `src/components/dashboard/ListingForm.tsx (edit)` | fields | GET /api/agent/listings/[id] full detail (CR-02 fix) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite 914 pass / 0 fail | npm test | tests 914 / pass 914 / fail 0 | PASS |
| TypeScript clean | npm run typecheck | Exit 0, no errors | PASS |
| Seed SQL targets exact slugs | grep slugs in 0003_seed_legacy_listings.sql | 9 matches — all 3 slugs in both comments and INSERT values | PASS |
| WR-05 subscription gate in leads lookup | grep AGENT_PUBLISHABLE_SQL leads/route.ts | Line 26 import; lines 91-92 WHERE clause | PASS |
| WR-03 division-by-zero guard | grep "sqft > 0" [slug]/page.tsx | Line 373: guard present, returns N/A | PASS |
| BL-01 HTML escaping | grep escapeHtml leads.ts | escapeHtml defined line 48; applied to all buyer values lines 102-106 | PASS |
| CR-02 slug preserved on PUT | grep ListingUpdateFields listings-db.ts | Line 138: export type ListingUpdateFields = Omit<ListingWriteFields,'slug'> | PASS |
| DashboardSidebar Listings link is real | grep href DashboardSidebar.tsx | Line 168: href="/dashboard/listings" as real Link; not a span | PASS |

### Probe Execution

Step 7c: SKIPPED — no probe-*.sh files declared or present for this phase. Behavioral spot-checks above cover the verifiable behaviors statically.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| LIST-01 | 04-02, 04-05 | Create listing with multiple photo URLs | SATISFIED | POST validates imageUrls array; createListing inserts with display_order; ListingForm dynamic photo inputs |
| LIST-02 | 04-02, 04-05 | Edit/delete own listings only | SATISFIED | resolveOwnership preamble; 403 on agent_id mismatch; ListingForm PUT with full field load (CR-02) |
| LIST-03 | 04-02 | Lapsed agent blocked from create | SATISFIED | isAgentPublishable gate on POST; 403 "Active subscription required" |
| LIST-04 | 04-01, 04-03 | Hidden/lapsed/paused excluded from public reads | SATISFIED | AGENT_PUBLISHABLE_SQL + status='active' in all public SELECTs |
| LIST-05 | 04-02, 04-05 | Agent can toggle listing active/paused | SATISFIED | PATCH validates status enum; setListingStatus with agent_id defense-in-depth |
| LIST-06 | 04-01, 04-02 | Photo display order preserved | SATISFIED | createListing inserts with display_order=index; replaceImages DELETE then re-INSERT with index |
| LIST-07 | 04-01, 04-03 | 3 legacy slugs preserved | SATISFIED (code) | SQL targets exact slugs; force-dynamic detail serves from D1; live confirmation in human verification item 1 |
| LIST-08 | 04-02, 04-05 | Agent views own listings in dashboard | SATISFIED | GET /api/agent/listings scoped by agent_id; dashboard RSC and ListingsManager wired |
| LEAD-01 | 04-04 | Inquiry saved to D1 as source of truth | SATISFIED | INSERT INTO leads before allSettled; only INSERT failure returns 500 |
| LEAD-02 | 04-04 | Agent receives email via Resend | SATISFIED (code) | sendLeadEmail with agentEmail as to; raw fetch; live delivery in human item 5 |
| LEAD-03 | 04-04 | Bernard CC'd on every inquiry | SATISFIED (code) | cc:[adminEmail] in sendLeadEmail; live delivery in human item 5 |
| LEAD-04 | 04-04 | Side effects never block buyer success | SATISFIED | Promise.allSettled; per-branch error logging; 200 returned unconditionally |
| LEAD-05 | 04-04 | Agent sees own leads in dashboard | SATISFIED | leads/page.tsx SELECT scoped WHERE agent_id = uid; 5-column table |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `DashboardSidebar.tsx` | 8-9 | JSDoc module comment says "Coming soon" but JSX is functional Links | Info | Stale comment only; actual JSX at lines 163-219 shows real Link elements for both /dashboard/listings and /dashboard/leads — not a stub |
| `leads/route.ts` | 181 | `contact_${Date.now()}` returned as leadId for general contact path | Info | Documented in review as IN-04; by design (leads.listing_id is NOT NULL so no D1 insert on general contact); correlation token only; not persisted |

No TBD, FIXME, or XXX debt markers found in any Phase 4 source files.
No empty return stubs, placeholder return values, or disconnected state variables found in Phase 4 files.

### Human Verification Required

#### 1. Seed Migration Application and Legacy Slug Confirmation

**Test:** Complete prerequisites (Bernard admin login + set-admin-claim), then apply 0002 + 0003 in order. Run `wrangler d1 execute DB --command "SELECT COUNT(*) AS seeded FROM listings WHERE id IN ('seed-listing-1','seed-listing-2','seed-listing-3');"`. Then visit all three original slug URLs in wrangler dev.
**Expected:** seeded=3; all three /listings/[slug] pages render with gallery, stats, description, and inquiry form intact.
**Why human:** Seed requires Bernard's admin agents row to exist in D1 at apply time. Static SQL confirms the correct slugs are targeted, but the row-count verification can only happen post-apply.

#### 2. Live D1 Listing CRUD Round-Trip

**Test:** In wrangler dev: (a) create listing with 3 photo URLs via /dashboard/listings; (b) edit changing price + add 4th photo; (c) pause — confirm disappears from /listings; (d) activate — confirm returns; (e) delete — confirm 404 publicly.
**Expected:** Each operation reflects on the public read path; images update in order.
**Why human:** Live D1 CRUD requires wrangler dev with applied migrations.

#### 3. Subscription Gate on Create — Lapsed Agent

**Test:** Sign in as an agent with subscription_status='lapsed' in D1 and submit the ListingForm create form.
**Expected:** 403 error banner "Active subscription required to create listings" appears in the form.
**Why human:** Requires a live lapsed agent session.

#### 4. Cross-Agent Ownership Enforcement (Direct API Call)

**Test:** As Agent B, call PUT /api/agent/listings/{Agent_A_listing_id} with Agent B's session cookie.
**Expected:** 403 Forbidden response.
**Why human:** The dashboard UI only lists each agent's own listings, so this must be tested via direct API call.

#### 5. Resend Email Delivery — Agent Email and Bernard CC

**Test:** Set RESEND_API_KEY (valid), LEAD_FROM_EMAIL (verified domain), ADMIN_NOTIFY_EMAIL in .dev.vars. Submit inquiry on live listing.
**Expected:** Buyer sees 200 success; listing agent receives email with reply_to=buyer; Bernard (ADMIN_NOTIFY_EMAIL) receives CC. HTML body should contain no raw markup from buyer input.
**Why human:** Requires Resend account and verified sending domain.

#### 6. Best-Effort Guarantee — Email Failure Does Not Block Buyer

**Test:** Set RESEND_API_KEY=invalid in .dev.vars. Submit an inquiry on a live listing.
**Expected:** Buyer still sees 200 success; D1 leads row is written; console.error shows Resend failure.
**Why human:** Requires wrangler dev with a deliberately broken Resend key.

#### 7. Dashboard Lead Inbox — Cross-Agent Isolation

**Test:** Submit inquiry on listing owned by Agent A. Log in as Agent B and visit /dashboard/leads.
**Expected:** Agent B sees no leads from Agent A.
**Why human:** Requires two live agent sessions with lead rows in D1.

#### 8. CR-02 Edit Form Data-Flow Verification

**Test:** In /dashboard/listings, click Edit on a listing with non-default city/state/zip/sqft/description. Observe the form load sequence and save behavior.
**Expected:** "Loading listing details..." spinner appears; all fields pre-fill from real D1 values (not "Houston"/"TX"/blanks); saving persists the correct values.
**Why human:** The useEffect + seedFromDetail flow is code-correct but requires a manual click-through to confirm the UX works end-to-end with live D1.

#### 9. WR-05 Product Decision: Leads GATED on Active/Publishable Listing

**Test:** Pause a listing in D1. Attempt to POST to /api/leads with that listing's slug directly.
**Expected:** Returns 400 "Listing not found." — no lead recorded. Bernard should confirm: is this the desired behavior (gate matches public read path), or should good-faith direct inquiries be captured even for paused listings?
**Why human:** Product decision — the code correctly implements the gate, but Bernard should explicitly choose between gated vs. record-always behavior. Reverting to record-always is one WHERE clause change in /api/leads/route.ts.

#### 10. Public Page Visual Regression Check

**Test:** After migrations applied, view /listings and /listings/[slug] in a browser.
**Expected:** Hero, filter bar, results count, card grid, photo gallery, property stats, description, inquiry form, and JSON-LD all visually match the previous static JSON-served version.
**Why human:** Visual regression requires browser inspection.

### Gaps Summary

No code-level gaps. All 13 observable truths are verified from direct source reads. All 13 phase requirements (LIST-01 through LIST-08, LEAD-01 through LEAD-05) have correct code implementations. All 8 code-review findings were fixed and confirmed via commit history and source inspection (commits 6e5b627, 0fb322c, 67d96b3, c304740, c749bc8, b661e08, 01539d9, plus the sidebar nav activation at b70a263). The test suite is 914 pass / 0 fail; TypeScript is clean.

The human_needed status reflects 10 items requiring live D1, live email delivery, or browser inspection — all expected and pre-authorized by the AUTHORIZED AUTONOMOUS run directive.

---

_Verified: 2026-06-14T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
