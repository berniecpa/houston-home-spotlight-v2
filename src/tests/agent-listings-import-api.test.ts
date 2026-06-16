/**
 * CSV Import API — source-grep test assertions.
 *
 * Verifies security and structural contracts for the import route by
 * inspecting source text, without invoking the actual D1 runtime (which
 * requires Cloudflare Workers context unavailable in Node.js test environments).
 *
 * Mirrors the style of src/tests/agent-listings-api.test.ts.
 *
 * Coverage:
 *   - import/route.ts: exports POST, no edge runtime, auth gates, correct imports,
 *     no agent_id read from CSV, per-row results contract.
 *
 * @module tests/agent-listings-import-api
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = join(process.cwd(), 'src');

const importRoutePath = join(
  root,
  'app',
  'api',
  'agent',
  'listings',
  'import',
  'route.ts'
);

const importRoute = readFileSync(importRoutePath, 'utf-8');

// ---------------------------------------------------------------------------
// import/route.ts
// ---------------------------------------------------------------------------

describe('/api/agent/listings/import/route.ts — POST', () => {
  it('exports POST handler', () => {
    assert.ok(
      importRoute.includes('export async function POST'),
      'import/route.ts must export POST handler'
    );
  });

  it('does NOT export runtime = edge', () => {
    assert.ok(
      !importRoute.includes("export const runtime = 'edge'"),
      'import/route.ts must NOT export runtime = edge — @opennextjs/cloudflare uses the Node.js runtime'
    );
  });

  it('derives uid via getTokens with authEdgeConfig', () => {
    assert.ok(
      importRoute.includes('getTokens') && importRoute.includes('authEdgeConfig'),
      'import/route.ts must call getTokens(cookieStore, authEdgeConfig) for session derivation'
    );
  });

  it('returns 401 when tokens are absent', () => {
    assert.ok(
      importRoute.includes('401'),
      'import/route.ts must return 401 when no session tokens'
    );
  });

  it('returns 403 when email is not verified', () => {
    assert.ok(
      importRoute.includes('403') && importRoute.includes('email_verified'),
      'import/route.ts must check email_verified and return 403 when unverified'
    );
  });

  it('imports parseCsv and validateListingRow from @/lib/csv-import', () => {
    assert.ok(
      importRoute.includes("from '@/lib/csv-import'"),
      "import/route.ts must import from '@/lib/csv-import'"
    );
    assert.ok(
      importRoute.includes('parseCsv'),
      'import/route.ts must import parseCsv'
    );
    assert.ok(
      importRoute.includes('validateListingRow'),
      'import/route.ts must import validateListingRow'
    );
  });

  it('imports createListing and makeUniqueSlug from @/lib/listings-db', () => {
    assert.ok(
      importRoute.includes("from '@/lib/listings-db'"),
      "import/route.ts must import from '@/lib/listings-db'"
    );
    assert.ok(
      importRoute.includes('createListing'),
      'import/route.ts must import createListing'
    );
    assert.ok(
      importRoute.includes('makeUniqueSlug'),
      'import/route.ts must import makeUniqueSlug'
    );
  });

  it('never reads agent_id from the parsed CSV record (T-IMP-01)', () => {
    // The route must NOT access record['agent_id'] or record.agent_id.
    // Ownership is always the session uid.
    assert.ok(
      !importRoute.includes("record['agent_id']") &&
      !importRoute.includes('record.agent_id') &&
      !importRoute.includes("fields['agent_id']") &&
      !importRoute.includes('fields.agent_id'),
      'import/route.ts must never read agent_id from CSV record (T-IMP-01)'
    );
  });

  it('response includes a per-row results array with row index and reason fields', () => {
    assert.ok(
      importRoute.includes('results'),
      'POST response must include a results array'
    );
    assert.ok(
      importRoute.includes('row:') || importRoute.includes('row,'),
      'Each result entry must include a row index field'
    );
    assert.ok(
      importRoute.includes('reason'),
      'Each failed result must include a reason field'
    );
  });

  it('response includes imported and failed counts', () => {
    assert.ok(
      importRoute.includes('imported') && importRoute.includes('failed'),
      'POST response must include imported and failed count fields'
    );
  });

  it('uid comes from tokens.decodedToken.uid (T-IMP-01)', () => {
    assert.ok(
      importRoute.includes('tokens.decodedToken.uid'),
      'uid must come from decoded token, never from CSV'
    );
  });

  it('uses parameterized SQL for the featured UPDATE (T-IMP-03)', () => {
    assert.ok(
      importRoute.includes("'UPDATE listings SET featured = ? WHERE id = ?'") ||
      importRoute.includes('"UPDATE listings SET featured = ? WHERE id = ?"'),
      'featured UPDATE must use parameterized query (T-IMP-03)'
    );
  });
});
