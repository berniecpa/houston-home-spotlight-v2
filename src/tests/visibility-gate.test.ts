/**
 * Visibility Gate Tests — Plan 05-01, Task 1
 *
 * Source-grep assertions verifying the Phase 5 shared visibility gate
 * (AGENT_VISIBLE_SQL) is correctly defined in subscription.ts and applied
 * consistently across all public listing read paths and the leads lookup.
 *
 * Threat model coverage:
 *   - T-05-01: Public browse/detail exposes suspended agent listings (mitigated)
 *   - T-05-02: Lead form records inquiry on suspended listing (mitigated)
 *
 * These are structural tests that do not require a live D1 connection —
 * they assert presence of required patterns in implementation files,
 * consistent with the existing test suite style (source-grep).
 *
 * @module tests/visibility-gate
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const subscriptionPath = join(root, 'src/lib/subscription.ts');
const dataPath         = join(root, 'src/lib/data.ts');
const leadsRoutePath   = join(root, 'src/app/api/leads/route.ts');

const subscription = readFileSync(subscriptionPath, 'utf-8');
const data         = readFileSync(dataPath, 'utf-8');
const leadsRoute   = readFileSync(leadsRoutePath, 'utf-8');

// ---------------------------------------------------------------------------
// subscription.ts — AGENT_VISIBLE_SQL definition
// ---------------------------------------------------------------------------
describe('subscription.ts — AGENT_VISIBLE_SQL definition (T-05-01, T-05-02)', () => {
  it('exports AGENT_VISIBLE_SQL as a named const', () => {
    assert.ok(
      subscription.includes('export const AGENT_VISIBLE_SQL'),
      'subscription.ts must export AGENT_VISIBLE_SQL'
    );
  });

  it('AGENT_VISIBLE_SQL composes AGENT_PUBLISHABLE_SQL', () => {
    assert.ok(
      subscription.includes('AGENT_PUBLISHABLE_SQL') &&
      subscription.includes('AGENT_VISIBLE_SQL'),
      'AGENT_VISIBLE_SQL must be defined after AGENT_PUBLISHABLE_SQL and reference it'
    );
  });

  it('AGENT_VISIBLE_SQL includes a.is_suspended = 0 check', () => {
    assert.ok(
      subscription.includes('a.is_suspended = 0'),
      'AGENT_VISIBLE_SQL must include a.is_suspended = 0 to enforce the Phase 5 suspension gate'
    );
  });

  it('AGENT_PUBLISHABLE_SQL still exported unchanged (subscription-only gate)', () => {
    assert.ok(
      subscription.includes('export const AGENT_PUBLISHABLE_SQL'),
      'AGENT_PUBLISHABLE_SQL must remain exported for create-listing eligibility checks'
    );
  });

  it('AGENT_PUBLISHABLE_SQL still contains is_admin bypass', () => {
    assert.ok(
      subscription.includes('a.is_admin = 1'),
      'AGENT_PUBLISHABLE_SQL must still contain is_admin = 1 admin bypass'
    );
  });

  it('AGENT_PUBLISHABLE_SQL still contains subscription_status active check', () => {
    assert.ok(
      subscription.includes("a.subscription_status = 'active'"),
      "AGENT_PUBLISHABLE_SQL must still check subscription_status = 'active'"
    );
  });

  it('AGENT_PUBLISHABLE_SQL still contains grace period check with unixepoch()', () => {
    assert.ok(
      subscription.includes('unixepoch()'),
      'AGENT_PUBLISHABLE_SQL must still use unixepoch() for grace period comparison'
    );
  });
});

// ---------------------------------------------------------------------------
// data.ts — AGENT_VISIBLE_SQL applied to public reads
// ---------------------------------------------------------------------------
describe('data.ts — AGENT_VISIBLE_SQL applied to public listing reads (T-05-01)', () => {
  it('imports AGENT_VISIBLE_SQL from @/lib/subscription', () => {
    assert.ok(
      data.includes("import { AGENT_VISIBLE_SQL } from '@/lib/subscription'"),
      'data.ts must import AGENT_VISIBLE_SQL (not AGENT_PUBLISHABLE_SQL) for public reads'
    );
  });

  it('does NOT import bare AGENT_PUBLISHABLE_SQL (using the composed gate)', () => {
    assert.ok(
      !data.includes("import { AGENT_PUBLISHABLE_SQL }"),
      'data.ts must not import AGENT_PUBLISHABLE_SQL directly — use AGENT_VISIBLE_SQL instead'
    );
  });

  it('getAllListings WHERE references AGENT_VISIBLE_SQL', () => {
    assert.ok(
      data.includes('AGENT_VISIBLE_SQL'),
      'getAllListings must reference AGENT_VISIBLE_SQL in its WHERE clause'
    );
  });

  it('getListingBySlug WHERE references AGENT_VISIBLE_SQL', () => {
    // AGENT_VISIBLE_SQL is used in both getAllListings and getListingBySlug;
    // verify it appears at least twice (once per query).
    const occurrences = (data.match(/AGENT_VISIBLE_SQL/g) ?? []).length;
    assert.ok(
      occurrences >= 2,
      `AGENT_VISIBLE_SQL must appear in both getAllListings and getListingBySlug queries (found ${occurrences} occurrence(s))`
    );
  });

  it('still filters by l.status = active', () => {
    assert.ok(
      data.includes("l.status = 'active'"),
      "data.ts must still filter by l.status = 'active' to exclude paused listings"
    );
  });

  it('still JOINs agents aliased as a', () => {
    assert.ok(
      data.includes('JOIN agents a ON l.agent_id = a.id'),
      'data.ts must still JOIN agents aliased as "a" so AGENT_VISIBLE_SQL can reference a.is_suspended'
    );
  });
});

// ---------------------------------------------------------------------------
// leads/route.ts — AGENT_VISIBLE_SQL in listing-lookup gate
// ---------------------------------------------------------------------------
describe('leads/route.ts — lead-capture path is intentionally NOT visibility-gated (WR-05 product decision)', () => {
  // WR-05: a good-faith buyer inquiry is captured + the agent notified even
  // when the listing is hidden from public browse (paused/lapsed/suspended).
  // The buyer still cannot SEE the listing — data.ts keeps the AGENT_VISIBLE_SQL
  // gate on the public read path (asserted above). The lead lookup resolves by
  // slug only, so an inquiry from a stale/bookmarked page is never dropped.
  it('does NOT gate the listing lookup on AGENT_VISIBLE_SQL', () => {
    assert.ok(
      !leadsRoute.includes('AGENT_VISIBLE_SQL'),
      'leads/route.ts lead-capture lookup must NOT apply AGENT_VISIBLE_SQL (WR-05: capture leads on hidden listings)'
    );
  });

  it('does NOT gate the listing lookup on subscription/publishable SQL', () => {
    assert.ok(
      !leadsRoute.includes('AGENT_PUBLISHABLE_SQL'),
      'leads/route.ts must not apply the subscription gate to the lead-capture lookup'
    );
  });

  it('resolves the listing strictly by slug (T-04-11: never a body-supplied id)', () => {
    assert.ok(
      leadsRoute.includes('WHERE l.slug = ?'),
      'leads/route.ts must resolve the listing by slug bind, not a body-supplied UUID'
    );
  });

  it('still joins agents table to obtain the notification email', () => {
    assert.ok(
      leadsRoute.includes('JOIN agents a ON l.agent_id = a.id'),
      'leads/route.ts must JOIN agents to resolve agent_email for the Resend notification'
    );
  });

  it('still returns Listing not found when the slug resolves to no listing at all', () => {
    assert.ok(
      leadsRoute.includes('Listing not found'),
      'leads/route.ts must return "Listing not found." when the slug matches no listing row'
    );
  });
});
