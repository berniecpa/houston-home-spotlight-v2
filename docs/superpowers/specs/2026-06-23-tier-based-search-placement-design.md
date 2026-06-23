# Tier-Based Search Placement — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorm)
**Topic:** Rank public listings by the owning agent's subscription tier so higher-paying agents get more prominent placement, delivering on pricing-page promises already live ("Featured Houston search placement" for Pro, "Top-of-search featured placement" for Team).

## Problem

The pricing tiers (Starter/Pro/Team) advertise search-placement perks, but the public browse page (`/listings`) and homepage order listings strictly by `created_at DESC`. Tier has no effect. This design makes tier influence placement.

## Decisions (locked during brainstorm)

- **Scope:** Browse page **and** homepage. Agent profile pages are out of scope (single-agent view).
- **Ordering rule:** Featured → tier → newest. The admin `featured` flag stays the top override.
- **Visual:** Subtle "Featured" badge on top-tier (Pro/Team) listings, reusing the existing badge.
- **ZIP "spotlight" perk:** Deferred — separate, larger feature.
- **Admin rank:** Bernard's own (`is_admin = 1`) listings rank at Team level (rank 3), interleaving with paying Team agents by recency rather than always sitting on top.
- **Homepage cap:** 6 cards.

## Approach

Compute placement at **read-time in SQL**. Tier already lives on `agents.subscription_tier` / `agents.is_admin`, and the public listing query already JOINs `agents`. Add tier to the `ORDER BY` via a `CASE` expression — **no migration**, no derived data to keep in sync.

Rejected alternatives:
- **Client-side sort:** server is the source of truth and stays pagination-friendly; duplicating sort logic in `ListingsClient` would break under future pagination.
- **Persisted `placement_weight` column:** redundant with `subscription_tier`; adds a webhook-sync bug surface for no benefit.

## Changes

### 1. Ordering — `src/lib/data.ts` / `getAllListings()`

Replace `ORDER BY l.created_at DESC` with:

```sql
ORDER BY l.featured DESC,
  CASE
    WHEN a.is_admin = 1               THEN 3
    WHEN a.subscription_tier = 'team' THEN 3
    WHEN a.subscription_tier = 'pro'  THEN 2
    WHEN a.subscription_tier = 'starter' THEN 1
    ELSE 0
  END DESC,
  l.created_at DESC
```

Add `a.subscription_tier` to the `SELECT` list. `getAgentProfileBySlug` query is **unchanged** (out of scope).

### 2. Data model — `src/types/index.ts` + `rowToListing`

Add one presentational field to `Listing`:

```ts
/** True when the owning agent's tier grants featured search placement (Pro/Team). */
featuredPlacement: boolean;
```

`ListingRow` gains `subscription_tier: string | null` (from the JOIN). `rowToListing` sets:

```ts
featuredPlacement: row.subscription_tier === 'pro' || row.subscription_tier === 'team'
```

This keeps billing-tier strings out of the public type — the card consumes a boolean.

### 3. Badge — `src/components/ListingCard.tsx`

Extend the existing badge render condition (currently `listing.featured`) to:

```tsx
{(listing.featured || listing.featuredPlacement) && ( …existing "Featured" pill… )}
```

Same pill, same "Featured" label (matches pricing copy). Pro and Team get it; Starter does not. Admin listings are badged only when the admin `featured` flag is set (not auto-badged by `is_admin`).

### 4. Homepage — `src/app/page.tsx` / `getFeaturedListings()`

`getFeaturedListings()` delegates to `getAllListings()`, so the featured grid **inherits** the new tier ordering. To deliver "prefers higher tiers when filling slots," cap the homepage grid at **6 cards**:

1. Admin-featured listings first (already tier-ordered by inheritance).
2. Top up with the highest-tier **non-featured** listings until 6 are shown.

Today the homepage renders *all* featured listings with no cap; this introduces the cap and the top-up. The top-up logic lives in the data layer (a `getHomepageListings()` helper) or `page.tsx` — to be finalized in the plan; the cap and ordering behavior are the contract.

## Out of scope / untouched

- No DB migration (`subscription_tier`, `is_admin` already exist on `agents`).
- `src/lib/listings.ts` (unused duplicate loader) left as-is.
- Agent dashboard listing views and `getAgentProfileBySlug` ordering unchanged.
- ZIP "spotlight" targeting (deferred).

## Testing

- Rank ordering: team > pro > starter > none; `featured` overrides tier; recency breaks ties within a group; admin == team rank.
- `featuredPlacement` derivation (true for pro/team, false otherwise).
- Badge render condition (shows for `featured` OR `featuredPlacement`).
- Homepage 6-slot cap and top-up (featured-first, then highest-tier non-featured).
- Update existing tests affected by the new order: `data-d1.test.ts`, `home-page.test.ts`, and any listing-order assertions.
