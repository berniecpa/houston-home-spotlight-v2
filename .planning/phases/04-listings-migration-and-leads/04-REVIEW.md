---
phase: 04-listings-migration-and-leads
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/lib/data.ts
  - src/lib/listings-db.ts
  - src/lib/leads.ts
  - src/app/api/agent/listings/route.ts
  - src/app/api/agent/listings/[id]/route.ts
  - src/app/api/leads/route.ts
  - src/app/listings/page.tsx
  - src/app/listings/ListingsClient.tsx
  - src/app/listings/[slug]/page.tsx
  - src/app/(dashboard)/dashboard/listings/page.tsx
  - src/app/(dashboard)/dashboard/leads/page.tsx
  - src/components/dashboard/ListingsManager.tsx
  - src/components/dashboard/ListingForm.tsx
  - db/migrations/0002_add_featured_column.sql
  - db/migrations/0003_seed_legacy_listings.sql
findings:
  critical: 2
  blocker: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

> Note: `critical` and `blocker` counts above are tier-equivalent (both Critical-tier). The two
> Critical-tier findings below are BL-01 and CR-02; the counts list each under both keys for
> downstream-parser compatibility. Total distinct findings = 12.

## Summary

Reviewed the Phase 4 listings-migration + CRUD + lead-capture implementation across the D1 data layer, write helpers, agent CRUD API routes, the public read-path pages, dashboard pages/components, and the two SQL migrations.

The authorization architecture is solid: ownership is consistently derived from the verified session (`getTokens`), never from the request body; the `[id]` routes share an ownership preamble that returns 404/403 correctly; `setListingStatus` adds defense-in-depth by including `agent_id` in its WHERE; the public read path applies `AGENT_PUBLISHABLE_SQL` in SQL and cannot be bypassed from the client. All D1 queries are parameterized; the `IN (...)` placeholder list is correctly built from `?` markers and bound. The lead flow correctly makes the D1 INSERT the durability gate and wraps Resend/Perfex in `Promise.allSettled` so a delivery failure never changes the buyer's 200 response, and the `/contact` no-slug path never attempts an INSERT (satisfies the NOT NULL constraint).

There is one **BLOCKER** (BL-01): buyer-supplied content is interpolated unescaped into the Resend HTML email body — stored/reflected HTML injection delivered to the agent's and Bernard's inboxes. There is also a **Critical** correctness defect (CR-02): the PUT edit path overwrites city/state/zip/sqft/description with hardcoded defaults because the edit form is seeded with blanks (silent data loss on every edit), and it regenerates the slug, breaking existing public URLs and risking an unhandled UNIQUE violation. Warnings cover a division-by-zero render on the public detail page, the missing slug-collision guard on PUT, the lead lookup skipping the status/subscription gate, and brittle slug derivation.

## Critical Issues

### BL-01: Unescaped buyer input rendered into lead notification email HTML (HTML/XSS injection)

**File:** `src/lib/leads.ts:75-85`
**Issue:** `sendLeadEmail` builds the `html` body by directly string-interpolating buyer-controlled values — `buyerName` (`${firstname} ${lastname}`), `phonenumber`, and `message` — with no HTML escaping. These values arrive from the public inquiry form (`POST /api/leads`) with only non-empty checks on `firstname/lastname/phonenumber` and an email-format check; none are sanitized (`route.ts:50-71,133-145`). A buyer can submit a `message` or name containing `<script>`, `<img onerror=...>`, an `<a href="https://evil">` phishing link, or markup that hijacks the email layout. This HTML is delivered to the agent's inbox and CC'd to Bernard (`ADMIN_NOTIFY_EMAIL`). Many webmail clients strip `<script>`, but anchor/`onerror`/`style`/`<a>`-based phishing and content spoofing routinely render — a stored-injection vector into both the agent and platform-owner mailboxes. `phonenumber` is also injected into a `tel:` href with no format validation. The phase prompt explicitly flags this risk as in scope; it is unmitigated.

**Fix:** HTML-escape every interpolated buyer value before embedding it.
```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const safeName = escapeHtml(buyerName);
const safeMsg = escapeHtml(message || '(no message)');
// for the tel: href, encode; also escape the visible text
html: `
  <p>New inquiry from <strong>${safeName}</strong>
     (<a href="tel:${encodeURIComponent(phonenumber)}">${escapeHtml(phonenumber)}</a>).</p>
  ...
  <p><strong>Message:</strong> ${safeMsg}</p>
`
```
`listingAddress`/`listingSlug` come from D1 (lower risk) but escaping them too is cheap defense-in-depth.

### CR-02: PUT edit overwrites real listing data with defaults (silent data loss) and breaks the public slug

**File:** `src/components/dashboard/ListingForm.tsx:99-115` and `src/app/api/agent/listings/[id]/route.ts:229-256`
**Issue:** `seedFromListing()` hardcodes `city: 'Houston'`, `state: 'TX'`, and blanks `zip`, `sqft`, `description`, because `GET /api/agent/listings` only returns summary columns (`route.ts:92-109`). The PUT handler then performs a **full-column** `updateListing()` with those seeded values (`[id]/route.ts:236-255`). Consequence: every edit silently overwrites the listing's real city/state/zip/sqft/description with defaults/empties — e.g. editing the seeded `sugarland-estate-pool` (Sugar Land, ZIP 77479, 4100 sqft, long description) wipes city back to "Houston", zip and sqft to NULL, and erases the description. That is data loss on a core entity triggered by the most common dashboard action.

Additionally, PUT re-derives `slug` from title+address (`[id]/route.ts:229-234`). Any edit can produce a new slug, **changing the public URL** and breaking inbound links / SEO — directly contradicting the "exact slugs preserved / public UX must not regress" constraint.

**Fix:** Either (a) load the listing's full record into the edit form (extend the GET response or add a GET-by-id) and pre-fill all fields, or (b) make PUT a partial update that writes only provided fields and does NOT recompute the slug on edit. Option (b) is safest: drop `slug` from the edit `updateListing` call and keep the original slug.

## Warnings

### WR-03: Division by zero renders `$Infinity` on the public listing detail page

**File:** `src/app/listings/[slug]/page.tsx:373`
**Issue:** `Math.round(listing.price / listing.sqft)` powers the "Price per Sqft" cell. `rowToListing` maps a NULL `sqft` to `0` (`data.ts:76`). A listing created via the API without sqft (sqft is optional, stored NULL) yields `price / 0 = Infinity`, rendering `$Infinity`; `price` 0 would render `NaN`. Visible defect on a public, SEO-indexed page.

**Fix:**
```tsx
{listing.sqft > 0
  ? `$${formatNumber(Math.round(listing.price / listing.sqft))}`
  : '—'}
```
Consider hiding the sqft row entirely when sqft is 0.

### WR-04: PUT has no slug-collision guard — unhandled UNIQUE constraint becomes a 500

**File:** `src/app/api/agent/listings/[id]/route.ts:229-255`
**Issue:** POST checks for an existing slug and returns 409 (`route.ts:262-277`), but PUT does not. If an edit regenerates a slug that collides with another listing's `slug` (UNIQUE in `0001_initial_schema.sql`), `updateListing` throws, is caught by the generic catch, and returns an opaque 500. Combined with CR-02 (slug regenerated on every edit) this is reachable in normal use.

**Fix:** After deriving the slug in PUT, run `SELECT id FROM listings WHERE slug = ? AND id != ?` and return 409 on conflict — or per CR-02, stop regenerating the slug on edit.

### WR-05: Lead lookup ignores listing status / subscription gate

**File:** `src/app/api/leads/route.ts:81-95`
**Issue:** The slug→listing lookup selects on `WHERE l.slug = ?` only — it does NOT apply `AGENT_PUBLISHABLE_SQL` or `l.status = 'active'`. A lead can therefore be inserted (and the agent/Bernard emailed) for a paused listing or a lapsed/non-publishable agent's listing, even though that listing returns 404 on the public read path (`getListingBySlug`). A client can POST the slug directly. Not a privilege breach (the agent owns the listing), but inconsistent with the read-path gate and lets leads land for listings the agent deliberately paused.

**Fix:**
```sql
WHERE l.slug = ? AND l.status = 'active' AND ${AGENT_PUBLISHABLE_SQL}
```
so a paused/lapsed listing returns "Listing not found." and records no lead.

### WR-06: `slugify` can produce an empty or collapsed slug

**File:** `src/app/api/agent/listings/route.ts:48-56` (and the inline duplicate at `[id]/route.ts:229-234`)
**Issue:** `slugify` strips all characters outside `[a-z0-9\s-]`. A title+address consisting only of non-ASCII characters (CJK, emoji, Cyrillic) reduces to an empty string after replace/trim, producing `slug = ''`. The first such listing inserts an empty slug; the next collides and returns a confusing 409. There is no minimum-length check or fallback, and the transform is duplicated verbatim across the two route files.

**Fix:** Extract a single `slugify` into `lib/listings-db.ts`; fall back when empty, e.g. `const base = derived || 'listing'; const slug = \`${base}-${listingId.slice(0, 8)}\`;` — or reject empty with a clear 400.

### WR-07: Seed migration aborts opaquely (or no-ops silently) when no admin agent exists

**File:** `db/migrations/0003_seed_legacy_listings.sql:34,54,74`
**Issue:** `agent_id` is `(SELECT id FROM agents WHERE is_admin = 1 LIMIT 1)`. If prerequisites (Bernard logged in + admin claim set) are not done before `migrations apply`, the subquery is NULL. With `listings.agent_id NOT NULL REFERENCES agents(id)`, a NULL would violate the constraint — but the statement is `INSERT OR IGNORE`, which **silently skips** constraint violations. So a premature apply records the migration as "applied" with zero listings inserted, and re-running is a no-op (slug-keyed IGNORE) — the seed never lands and the failure is invisible. The follow-on `listing_images` INSERTs then reference non-existent `seed-listing-*` parents and are also IGNORE'd. The prose warns operators, but nothing in SQL surfaces the empty-seed condition.

**Fix:** Guard each listing INSERT with `WHERE EXISTS (SELECT 1 FROM agents WHERE is_admin = 1)` and document that the seed must be re-applied after prerequisites — or add a verification query/assert step in the apply runbook that the three slugs exist post-migration. At minimum, drop `OR IGNORE` on the first run so a NULL FK fails loudly rather than silently skipping.

### WR-08: Optimistic delete + immediate refetch can desync the table or mask failures

**File:** `src/components/dashboard/ListingsManager.tsx:153-155`
**Issue:** `handleDelete` removes the row optimistically, then `await refreshListings()`. If DELETE succeeded but the refetch fails (network blip), the row stays removed locally while the generic error banner shows; if the refetch returns stale data, the deleted row reappears. The optimistic-update + immediate-refetch is redundant and can flicker.

**Fix:** Pick one source of truth — either trust the optimistic update (no refetch on delete) or rely solely on the refetch (no optimistic removal) — while keeping error handling so a failed DELETE does not leave the row removed.

## Info

### IN-01: Slug-derivation logic duplicated across two route files

**File:** `src/app/api/agent/listings/route.ts:48-56` vs `src/app/api/agent/listings/[id]/route.ts:229-234`
**Issue:** The slugify transform is copy-pasted (named function in one, inline in the other), creating divergence risk. **Fix:** Export a single `slugify` from `lib/listings-db.ts` and import in both routes (see WR-06).

### IN-02: `isSafeHttpUrl` duplicated in three places

**File:** `src/lib/listings-db.ts:27-34`, `src/components/dashboard/ListingForm.tsx:88-95`, and (per its JSDoc) `src/app/api/agent/profile/route.ts`
**Issue:** The same URL-allowlist helper exists in client, server-lib, and the profile route. The client copy is fine for UX/bundle isolation, but the server-side profile copy should import the lib version to avoid drift. **Fix:** Have server callers import the lib helper; keep the client copy local with a comment noting lib is authoritative.

### IN-03: `clearListingsCache` is a dead no-op retained for compatibility

**File:** `src/lib/data.ts:234-236`
**Issue:** Exported function does nothing; exists only for old tests. Harmless dead code. **Fix:** Remove once referencing tests are updated, or keep with the existing explanatory comment.

### IN-04: General-contact path returns a fabricated `leadId` that is never persisted

**File:** `src/app/api/leads/route.ts:181`
**Issue:** The no-slug path returns `leadId: \`contact_${Date.now()}\``, implying persistence, but nothing is stored in D1 (by design — `leads.listing_id` is NOT NULL). The fake id could mislead a client expecting a durable reference. The `/contact` no-crash requirement is correctly met (no INSERT attempted). **Fix:** Omit `leadId` on the contact path or document it as a non-persistent correlation token only.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
