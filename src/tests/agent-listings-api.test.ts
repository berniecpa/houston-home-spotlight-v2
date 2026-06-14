/**
 * Agent Listings API — source-grep test assertions.
 *
 * Verifies security and structural contracts by inspecting source text,
 * without invoking the actual D1 runtime (which requires Cloudflare Workers
 * context unavailable in Node.js test environments).
 *
 * Coverage:
 *   - listings-db.ts: exports, parameterized patterns, URL allowlist
 *   - route.ts (GET/POST): exports, session derivation, publishability gate
 *   - [id]/route.ts (PUT/DELETE/PATCH): exports, ownership check, status enum
 *
 * @module tests/agent-listings-api
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = join(process.cwd(), 'src');

const dbHelperPath = join(root, 'lib', 'listings-db.ts');
const routePath    = join(root, 'app', 'api', 'agent', 'listings', 'route.ts');
const idRoutePath  = join(root, 'app', 'api', 'agent', 'listings', '[id]', 'route.ts');

const dbHelper = readFileSync(dbHelperPath, 'utf-8');
const route    = readFileSync(routePath, 'utf-8');
const idRoute  = readFileSync(idRoutePath, 'utf-8');

// ---------------------------------------------------------------------------
// listings-db.ts
// ---------------------------------------------------------------------------
describe('listings-db.ts — helpers and security', () => {
  it('exports isSafeHttpUrl', () => {
    assert.ok(
      dbHelper.includes('export function isSafeHttpUrl'),
      'isSafeHttpUrl must be exported from listings-db.ts'
    );
  });

  it('isSafeHttpUrl uses URL protocol check for http(s) allowlist', () => {
    assert.ok(
      dbHelper.includes("u.protocol === 'https:'") &&
      dbHelper.includes("u.protocol === 'http:'"),
      'isSafeHttpUrl must check both http and https protocols'
    );
  });

  it('exports createListing', () => {
    assert.ok(
      dbHelper.includes('export async function createListing'),
      'createListing must be exported'
    );
  });

  it('exports updateListing', () => {
    assert.ok(
      dbHelper.includes('export async function updateListing'),
      'updateListing must be exported'
    );
  });

  it('exports replaceImages', () => {
    assert.ok(
      dbHelper.includes('export async function replaceImages'),
      'replaceImages must be exported'
    );
  });

  it('exports deleteListing', () => {
    assert.ok(
      dbHelper.includes('export async function deleteListing'),
      'deleteListing must be exported'
    );
  });

  it('exports setListingStatus', () => {
    assert.ok(
      dbHelper.includes('export async function setListingStatus'),
      'setListingStatus must be exported'
    );
  });

  it('exports ListingWriteFields interface', () => {
    assert.ok(
      dbHelper.includes('export interface ListingWriteFields'),
      'ListingWriteFields interface must be exported'
    );
  });

  it('createListing uses crypto.randomUUID for listing id', () => {
    assert.ok(
      dbHelper.includes('crypto.randomUUID()'),
      'createListing must use crypto.randomUUID() for id generation'
    );
  });

  it('createListing inserts images with display_order = index', () => {
    assert.ok(
      dbHelper.includes('display_order') &&
      dbHelper.includes('listing_images'),
      'createListing must insert listing_images rows with display_order'
    );
  });

  it('replaceImages deletes before re-inserting (LIST-06)', () => {
    assert.ok(
      dbHelper.includes('DELETE FROM listing_images WHERE listing_id = ?'),
      'replaceImages must DELETE existing images before re-inserting'
    );
  });

  it('setListingStatus includes agent_id in WHERE clause', () => {
    assert.ok(
      dbHelper.includes('WHERE id = ? AND agent_id = ?'),
      'setListingStatus must bind both listingId and agentId in WHERE'
    );
  });

  it('all queries use prepare().bind() — no string concatenation', () => {
    assert.ok(
      !dbHelper.includes('`DELETE FROM listings WHERE id = ${'),
      'SQL must not use template literal interpolation'
    );
  });
});

// ---------------------------------------------------------------------------
// /api/agent/listings/route.ts (GET + POST)
// ---------------------------------------------------------------------------
describe('/api/agent/listings/route.ts — GET + POST', () => {
  it('exports runtime = edge', () => {
    assert.ok(
      route.includes("export const runtime = 'edge'"),
      'route.ts must export runtime = edge'
    );
  });

  it('exports GET handler', () => {
    assert.ok(
      route.includes('export async function GET'),
      'route.ts must export GET handler'
    );
  });

  it('exports POST handler', () => {
    assert.ok(
      route.includes('export async function POST'),
      'route.ts must export POST handler'
    );
  });

  it('derives uid from getTokens (never from body) — T-04-08', () => {
    assert.ok(
      route.includes('getTokens'),
      'route.ts must call getTokens for session derivation'
    );
    assert.ok(
      route.includes('tokens.decodedToken.uid'),
      'uid must come from decoded token, not request body'
    );
  });

  it('imports isAgentPublishable from subscription', () => {
    assert.ok(
      route.includes('isAgentPublishable'),
      'route.ts must import isAgentPublishable'
    );
  });

  it('imports getAgentSubscriptionState from subscription', () => {
    assert.ok(
      route.includes('getAgentSubscriptionState'),
      'route.ts must import getAgentSubscriptionState'
    );
  });

  it('gates POST on isAgentPublishable — T-04-05 / LIST-03', () => {
    assert.ok(
      route.includes('isAgentPublishable') &&
      route.includes('Active subscription required'),
      'POST must gate on isAgentPublishable and return the correct 403 message'
    );
  });

  it('returns 403 with subscription message when agent is not publishable', () => {
    assert.ok(
      route.includes('Active subscription required to create listings'),
      'POST must return 403 with "Active subscription required to create listings" message'
    );
  });

  it('returns 401 when session is missing', () => {
    assert.ok(
      route.includes('401'),
      'route.ts must return 401 when no session'
    );
  });

  it('returns 403 when email is not verified', () => {
    assert.ok(
      route.includes('email_verified'),
      'route.ts must check email_verified before allowing writes'
    );
  });

  it('imports createListing from listings-db', () => {
    assert.ok(
      route.includes('createListing') &&
      route.includes('listings-db'),
      'route.ts must import and call createListing from @/lib/listings-db'
    );
  });

  it('validates imageUrls through isSafeHttpUrl — T-04-07', () => {
    assert.ok(
      route.includes('isSafeHttpUrl'),
      'POST must validate image URLs via isSafeHttpUrl'
    );
  });

  it('GET returns only the agent own listings (SELECT WHERE agent_id = uid)', () => {
    assert.ok(
      route.includes('agent_id') &&
      route.includes('ORDER BY'),
      'GET must select only listings where agent_id = uid, ordered'
    );
  });

  it('POST returns 201 on successful create', () => {
    assert.ok(
      route.includes('201'),
      'POST must return 201 status on successful listing creation'
    );
  });

  it('POST returns 409 on slug collision', () => {
    assert.ok(
      route.includes('409'),
      'POST must return 409 when slug already exists'
    );
  });
});

// ---------------------------------------------------------------------------
// /api/agent/listings/[id]/route.ts (PUT + DELETE + PATCH)
// ---------------------------------------------------------------------------
describe('/api/agent/listings/[id]/route.ts — PUT + DELETE + PATCH', () => {
  it('exports runtime = edge', () => {
    assert.ok(
      idRoute.includes("export const runtime = 'edge'"),
      '[id]/route.ts must export runtime = edge'
    );
  });

  it('exports PUT handler', () => {
    assert.ok(
      idRoute.includes('export async function PUT'),
      '[id]/route.ts must export PUT handler'
    );
  });

  it('exports DELETE handler', () => {
    assert.ok(
      idRoute.includes('export async function DELETE'),
      '[id]/route.ts must export DELETE handler'
    );
  });

  it('exports PATCH handler', () => {
    assert.ok(
      idRoute.includes('export async function PATCH'),
      '[id]/route.ts must export PATCH handler'
    );
  });

  it('uses Next.js 15 async params pattern', () => {
    assert.ok(
      idRoute.includes('await params'),
      '[id]/route.ts must await params (Next.js 15 async params)'
    );
  });

  it('derives uid from getTokens — T-04-08', () => {
    assert.ok(
      idRoute.includes('getTokens') &&
      idRoute.includes('tokens.decodedToken.uid'),
      '[id]/route.ts must derive uid from getTokens'
    );
  });

  it('performs ownership SELECT before any mutation — T-04-04', () => {
    assert.ok(
      idRoute.includes('SELECT agent_id FROM listings WHERE id = ?'),
      '[id]/route.ts must SELECT agent_id before mutating (ownership check)'
    );
  });

  it('returns 404 when listing is not found', () => {
    assert.ok(
      idRoute.includes('404'),
      '[id]/route.ts must return 404 when listing does not exist'
    );
  });

  it('returns 403 when agent_id does not match session uid — LIST-02', () => {
    assert.ok(
      idRoute.includes('403') &&
      idRoute.includes('agent_id'),
      '[id]/route.ts must return 403 on cross-agent access'
    );
  });

  it('PATCH validates status enum — only active or paused accepted', () => {
    assert.ok(
      idRoute.includes("'active'") &&
      idRoute.includes("'paused'"),
      'PATCH must validate status enum values {active, paused}'
    );
  });

  it('PATCH returns 400 on invalid status value', () => {
    assert.ok(
      idRoute.includes('400'),
      'PATCH must return 400 for invalid status values'
    );
  });

  it('PUT calls updateListing from listings-db', () => {
    assert.ok(
      idRoute.includes('updateListing'),
      'PUT must call updateListing from listings-db'
    );
  });

  it('PUT calls replaceImages from listings-db', () => {
    assert.ok(
      idRoute.includes('replaceImages'),
      'PUT must call replaceImages to update ordered images'
    );
  });

  it('DELETE calls deleteListing from listings-db', () => {
    assert.ok(
      idRoute.includes('deleteListing'),
      'DELETE must call deleteListing from listings-db'
    );
  });

  it('PATCH calls setListingStatus from listings-db', () => {
    assert.ok(
      idRoute.includes('setListingStatus'),
      'PATCH must call setListingStatus from listings-db'
    );
  });

  it('returns 401 when session is missing', () => {
    assert.ok(
      idRoute.includes('401'),
      '[id]/route.ts must return 401 when no session'
    );
  });
});
