---
phase: 04-listings-migration-and-leads
fixed_at: 2026-06-14T00:00:00Z
review_path: .planning/phases/04-listings-migration-and-leads/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-06-14
**Source review:** .planning/phases/04-listings-migration-and-leads/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 8 (BL-01, CR-02, WR-03, WR-04, WR-05, WR-06, WR-07, WR-08)
- Fixed: 8
- Skipped: 0
- Info findings (IN-01..IN-04): out of scope (fix_scope = critical_warning)

Final verification: `npm run typecheck` clean; `npm test` = 914 pass / 0 fail (unchanged from baseline).

## Fixed Issues

### BL-01: Unescaped buyer input rendered into lead notification email HTML
**Files modified:** `src/lib/leads.ts`
**Commit:** 6e5b627
**Applied fix:** Added internal `escapeHtml()` (escapes `& < > " '`) and `stripNewlines()` helpers. All buyer-controlled values (`buyerName`, `phonenumber`, `message`) plus the D1-sourced `listingAddress`/`listingSlug` are now escaped before interpolation into the Resend HTML body; the `tel:` href and the listing URL use `encodeURIComponent`. The subject line strips CR/LF from `listingAddress` to prevent email-header injection. `reply_to=buyer` + `cc=adminEmail` behavior preserved.

### CR-02: PUT edit overwrites real data with defaults + breaks public slug (also resolves WR-04)
**Files modified:** `src/lib/listings-db.ts`, `src/app/api/agent/listings/[id]/route.ts`, `src/components/dashboard/ListingForm.tsx`
**Commit:** 0fb322c
**Applied fix:**
- **Data loss:** Added a `GET /api/agent/listings/[id]` handler returning the full listing record (all columns + ordered image URLs), gated by the existing ownership preamble. `ListingForm` now fetches that detail in edit mode via a `useEffect` and seeds every field (`city/state/zip/sqft/description`) plus the photo URLs from real values. Removed the hardcoded `city:'Houston'/state:'TX'/blank` defaults from the old `seedFromListing`; replaced with `seedSummary` (synchronous placeholder while loading) and `seedFromDetail` (real values). A "Loading listing details..." status shows while the form is disabled during the fetch.
- **Slug / URL break (and WR-04):** Removed slug regeneration from the PUT handler. Introduced `ListingUpdateFields = Omit<ListingWriteFields,'slug'>`; `updateListing` no longer writes the `slug` column, so the original public URL is preserved on every edit. Because the slug never changes on edit, the PUT slug-collision UNIQUE violation flagged in WR-04 is no longer reachable.
**Note (logic):** Behavior verified against tests; the edit data-flow seeding is a logic change worth a quick manual confirm in the dashboard UI before release.

### WR-03: Division by zero renders `$Infinity` on public detail page
**Files modified:** `src/app/listings/[slug]/page.tsx`
**Commit:** 67d96b3
**Applied fix:** Guarded the "Price per Sqft" cell with `listing.sqft > 0 ? \`$${formatNumber(Math.round(listing.price / listing.sqft))}\` : 'N/A'`. A NULL/0 sqft now renders `N/A` instead of `$Infinity`/`$NaN`. The `listing.price / listing.sqft` expression is retained inside the guard (keeps the source-grep test green).

### WR-04: PUT slug-collision becomes an unhandled 500
**Files modified:** (resolved transitively by CR-02 — `src/app/api/agent/listings/[id]/route.ts`)
**Commit:** 0fb322c
**Applied fix:** Resolved by CR-02. The slug is no longer recomputed on edit, so a PUT can no longer derive a colliding slug and trip the UNIQUE constraint. No separate 409 guard was needed once slug regeneration was removed.

### WR-05: Lead lookup ignores listing status / subscription gate
**Files modified:** `src/app/api/leads/route.ts`
**Commit:** c304740
**Applied fix:** Extended the slug to listing lookup to `WHERE l.slug = ? AND l.status = 'active' AND ${AGENT_PUBLISHABLE_SQL}`, importing `AGENT_PUBLISHABLE_SQL` from `@/lib/subscription`. A paused or lapsed-agent listing now returns "Listing not found." (400) and records no lead — making the inquiry path consistent with the public read path (`getListingBySlug`).
**Product decision noted:** The review framed this as a product call (record-anyway vs. gate). I applied the *gate* (the reviewer's recommended fix and the least-surprising behavior): a listing the buyer cannot see on the site should not silently accept inquiries, and a direct POST to a paused slug now mirrors what the read path does. If the product preference is instead to capture good-faith inquiries even for paused listings, revert this single query change.

### WR-06: `slugify` can produce an empty/collapsed slug
**Files modified:** `src/app/api/agent/listings/route.ts`
**Commit:** c749bc8
**Applied fix:** `slugify` now falls back to `listing-<8-char-random>` (via `crypto.randomUUID().slice(0,8)`) when the derived base collapses to an empty string (e.g. all-CJK/emoji titles), preventing an empty-slug insert and the confusing downstream 409. Only the CREATE path derives slugs now (edit preserves the original per CR-02).

### WR-07: Seed migration aborts opaquely / no-ops silently when no admin agent exists
**Files modified:** `db/migrations/0003_seed_legacy_listings.sql`
**Commit:** b661e08
**Applied fix:** Converted each of the three listing `INSERT OR IGNORE ... VALUES` statements to `INSERT OR IGNORE ... SELECT ... WHERE EXISTS (SELECT 1 FROM agents WHERE is_admin = 1)`, so a premature apply inserts nothing rather than recording an "applied with broken FK" state — and the migration safely re-applies (slug-keyed IGNORE) once the admin row exists. Added a mandatory post-apply verification runbook comment (`SELECT COUNT(*) ... expected = 3`) so the silent-by-design seed is operationally detectable.

### WR-08: Optimistic delete + immediate refetch can desync the table
**Files modified:** `src/components/dashboard/ListingsManager.tsx`
**Commit:** 01539d9
**Applied fix:** `handleDelete` now relies solely on `refreshListings()` (server refetch) as the single source of truth, removing the optimistic local `setListings(... filter ...)`. A failed DELETE keeps the row (error banner shown); a successful DELETE re-syncs from the server, and a failed refetch surfaces its own error banner instead of leaving the row inconsistently removed.

## Skipped Issues

None.

---

_Fixed: 2026-06-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
