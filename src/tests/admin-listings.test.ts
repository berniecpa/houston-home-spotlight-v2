/**
 * Admin Listings Tests
 *
 * Structural assertions that the admin all-listings view + remove endpoint are
 * admin-gated and parameterized, consistent with the existing admin route tests.
 *
 * @module tests/admin-listings.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf-8');

describe('lib/admin listings helpers', () => {
  const src = read('src/lib/admin.ts');

  it('exports listAllListingsPaginated and deleteListingAsAdmin', () => {
    assert.ok(src.includes('export async function listAllListingsPaginated'));
    assert.ok(src.includes('export async function deleteListingAsAdmin'));
  });

  it('lists every listing (no subscription/expiry gate) joined with agents', () => {
    assert.ok(src.includes('FROM listings l') && src.includes('JOIN agents a'));
    assert.ok(!src.includes('AGENT_VISIBLE_SQL'), 'admin list must not apply the public gate');
  });

  it('deleteListingAsAdmin uses a parameterized DELETE and reports rows changed', () => {
    assert.ok(src.includes('DELETE FROM listings WHERE id = ?'));
    assert.ok(src.includes('result.meta?.changes'));
  });
});

describe('DELETE /api/admin/listings/[id]', () => {
  const route = read('src/app/api/admin/listings/[id]/route.ts');

  it('re-verifies the admin claim before deleting', () => {
    assert.ok(route.includes('requireAdmin') && route.includes('isAdminRejection'));
  });

  it('takes the listing id from the route segment, not the body', () => {
    assert.ok(route.includes('const { id: listingId } = await params'));
    assert.ok(!route.includes('request.json()'), 'admin delete must not read an id from the body');
  });

  it('returns 404 when no listing matched', () => {
    assert.ok(route.includes('changed === 0') && route.includes('404'));
  });
});
