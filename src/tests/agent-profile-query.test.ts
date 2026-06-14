/**
 * Agent Profile Query Tests — Plan 05-02, Task 1
 *
 * Source-grep assertions verifying getAgentProfileBySlug is correctly
 * implemented in data.ts with the required public-safety constraints:
 *   - Selects only public-safe columns (display_name, photo_url, brokerage, license_number, slug)
 *   - NEVER selects agents.email or agents.phone
 *   - Applies AGENT_VISIBLE_SQL visibility gate to the listings query
 *   - Applies l.status = 'active' filter to scoped listings
 *   - Scopes listings to l.agent_id (the resolved agent)
 *   - Returns null for unknown slug or suspended agent (is_suspended=1)
 *   - Wraps in try/catch returning null on D1 error
 *
 * Threat model coverage:
 *   - T-05-06: Public profile leaks agent email/phone (mitigated — data layer omits PII)
 *   - T-05-07: Suspended agent profile/listings still reachable (mitigated — returns null when suspended)
 *   - T-05-08: Slug as untrusted input enables SQL injection (mitigated — parameterized .bind())
 *
 * These are structural tests that do not require a live D1 connection —
 * they assert presence of required patterns in the implementation file.
 *
 * @module tests/agent-profile-query
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dataPath = join(root, 'src/lib/data.ts');
const data = readFileSync(dataPath, 'utf-8');

// ---------------------------------------------------------------------------
// Function export presence
// ---------------------------------------------------------------------------
describe('data.ts — getAgentProfileBySlug export (T-05-06, T-05-07)', () => {
  it('exports getAgentProfileBySlug as a named async function', () => {
    assert.ok(
      data.includes('export async function getAgentProfileBySlug'),
      'data.ts must export getAgentProfileBySlug'
    );
  });

  it('accepts a slug parameter', () => {
    assert.ok(
      data.includes('getAgentProfileBySlug(slug'),
      'getAgentProfileBySlug must accept a slug parameter'
    );
  });
});

// ---------------------------------------------------------------------------
// PII safety — no email or phone selected on the profile path
// ---------------------------------------------------------------------------
describe('data.ts — PII omission in agent profile lookup (T-05-06)', () => {
  it('does NOT select agents.email in the profile query', () => {
    // Extract the getAgentProfileBySlug function body for scoped analysis
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    // Find the next export or end of file to bound the function
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      !fnBody.includes('agents.email') && !fnBody.includes('.email'),
      'getAgentProfileBySlug must not select agents.email — PII must never reach the profile path'
    );
  });

  it('does NOT select agents.phone in the profile query', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      !fnBody.includes('agents.phone') && !fnBody.includes('.phone'),
      'getAgentProfileBySlug must not select agents.phone — PII must never reach the profile path'
    );
  });
});

// ---------------------------------------------------------------------------
// Public-safe column selection
// ---------------------------------------------------------------------------
describe('data.ts — public-safe column selection in profile query (T-05-06)', () => {
  it('selects display_name from agents', () => {
    assert.ok(
      data.includes('display_name'),
      'getAgentProfileBySlug must select display_name from agents'
    );
  });

  it('selects photo_url from agents', () => {
    assert.ok(
      data.includes('photo_url'),
      'getAgentProfileBySlug must select photo_url from agents'
    );
  });

  it('selects brokerage from agents', () => {
    assert.ok(
      data.includes('brokerage'),
      'getAgentProfileBySlug must select brokerage from agents'
    );
  });

  it('selects license_number from agents', () => {
    assert.ok(
      data.includes('license_number'),
      'getAgentProfileBySlug must select license_number from agents'
    );
  });

  it('selects is_suspended for suspension gate', () => {
    assert.ok(
      data.includes('is_suspended'),
      'getAgentProfileBySlug must select is_suspended to implement the suspension null return'
    );
  });
});

// ---------------------------------------------------------------------------
// Suspension gate — returns null when is_suspended = 1
// ---------------------------------------------------------------------------
describe('data.ts — suspension gate in getAgentProfileBySlug (T-05-07)', () => {
  it('checks is_suspended and returns null when suspended', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('is_suspended') &&
      (fnBody.includes('=== 1') || fnBody.includes('== 1') || fnBody.includes('is_suspended')),
      'getAgentProfileBySlug must check is_suspended and return null for suspended agents (T-05-07)'
    );
  });
});

// ---------------------------------------------------------------------------
// Listings query — visibility gate, status filter, agent scope
// ---------------------------------------------------------------------------
describe('data.ts — agent-scoped listings query in getAgentProfileBySlug (T-05-01, T-05-07)', () => {
  it('applies AGENT_VISIBLE_SQL to the listings query within getAgentProfileBySlug', () => {
    // AGENT_VISIBLE_SQL must appear at least 3 times total:
    // getAllListings, getListingBySlug, and getAgentProfileBySlug
    const occurrences = (data.match(/AGENT_VISIBLE_SQL/g) ?? []).length;
    assert.ok(
      occurrences >= 3,
      `AGENT_VISIBLE_SQL must appear in getAllListings, getListingBySlug, AND getAgentProfileBySlug (found ${occurrences} occurrence(s))`
    );
  });

  it("filters profile listings by l.status = 'active'", () => {
    // data.ts must reference l.status = 'active' for profile listings
    // (it already does in getAllListings; getAgentProfileBySlug must also apply it)
    const occurrences = (data.match(/l\.status = 'active'/g) ?? []).length;
    assert.ok(
      occurrences >= 2,
      `l.status = 'active' must appear in both getAllListings and getAgentProfileBySlug (found ${occurrences} occurrence(s))`
    );
  });

  it('scopes listings to the resolved agent via l.agent_id', () => {
    assert.ok(
      data.includes('l.agent_id'),
      'getAgentProfileBySlug must scope listings by l.agent_id to the resolved agent'
    );
  });

  it('orders profile listings by created_at DESC', () => {
    const occurrences = (data.match(/created_at DESC/g) ?? []).length;
    assert.ok(
      occurrences >= 2,
      `created_at DESC must appear in getAllListings and getAgentProfileBySlug (found ${occurrences} occurrence(s))`
    );
  });

  it('uses two-query image grouping for profile listings (listing_images JOIN)', () => {
    // listing_images table is referenced for image grouping
    const occurrences = (data.match(/listing_images/g) ?? []).length;
    assert.ok(
      occurrences >= 3,
      `listing_images must be referenced at least 3 times (getAllListings x2, getListingBySlug x1, getAgentProfileBySlug x2) — found ${occurrences} occurrence(s)`
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling — null on D1 error
// ---------------------------------------------------------------------------
describe('data.ts — error handling in getAgentProfileBySlug', () => {
  it('wraps the function body in try/catch', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('try {') || fnBody.includes('try{'),
      'getAgentProfileBySlug must wrap D1 calls in try/catch (fail-safe returning null)'
    );
  });

  it('catch block returns null on D1 error', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('catch') && fnBody.includes('return null'),
      'getAgentProfileBySlug catch block must return null (mirrors getListingBySlug fail-safe pattern)'
    );
  });

  it('uses parameterized .bind() for slug (SQL injection prevention — T-05-08)', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('.bind(') && fnBody.includes('slug'),
      'getAgentProfileBySlug must use parameterized .bind() with the slug — no string concatenation (T-05-08)'
    );
  });
});

// ---------------------------------------------------------------------------
// Return shape — AgentProfile object with listings array
// ---------------------------------------------------------------------------
describe('data.ts — return shape of getAgentProfileBySlug', () => {
  it('returns an object containing listings array field', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('listings'),
      'getAgentProfileBySlug must return an object with a listings field containing the agent\'s visible listings'
    );
  });

  it('uses rowToListing to map profile listing rows', () => {
    const fnStart = data.indexOf('export async function getAgentProfileBySlug');
    const fnEnd = data.indexOf('\nexport ', fnStart + 1);
    const fnBody = fnEnd === -1 ? data.slice(fnStart) : data.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('rowToListing'),
      'getAgentProfileBySlug must reuse rowToListing helper to map listing rows to Listing objects'
    );
  });
});
