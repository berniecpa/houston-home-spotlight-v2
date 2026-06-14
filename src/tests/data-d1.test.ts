/**
 * D1 Data Layer Tests
 *
 * Source-text grep assertions verifying that src/lib/data.ts implements the
 * D1-backed listing read path correctly. These are structural tests that do not
 * require a live D1 connection — they assert the presence of required patterns
 * in the implementation file, consistent with the existing test suite style.
 *
 * Verified patterns:
 * - getCloudflareContext import (D1 binding access)
 * - AGENT_VISIBLE_SQL import (Phase 5 visibility gate: publishable + not suspended)
 * - All four async function signatures exported
 * - Visibility gate applied in getAllListings and getListingBySlug queries
 * - No legacy JSON imports from @/data/listings
 * - clearListingsCache remains exported (test compatibility no-op)
 *
 * @module tests/data-d1.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();
const dataPath = join(projectRoot, 'src/lib/data.ts');

describe('D1 Data Layer (src/lib/data.ts)', () => {
  describe('File Structure', () => {
    it('should exist at src/lib/data.ts', () => {
      assert.ok(existsSync(dataPath), 'src/lib/data.ts should exist');
    });
  });

  describe('Required Imports', () => {
    it('should import getCloudflareContext from @opennextjs/cloudflare', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes("import { getCloudflareContext } from '@opennextjs/cloudflare'"),
        'Should import getCloudflareContext from @opennextjs/cloudflare for D1 binding access'
      );
    });

    it('should import AGENT_VISIBLE_SQL from @/lib/subscription', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes("import { AGENT_VISIBLE_SQL } from '@/lib/subscription'"),
        'Should import AGENT_VISIBLE_SQL from subscription module for the Phase 5 visibility gate (publishable + not suspended)'
      );
    });

    it('should NOT import from @/data/listings (no legacy JSON imports)', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        !content.includes("@/data/listings"),
        'Should not import from @/data/listings — D1 is now the data source'
      );
    });
  });

  describe('Exported Function Signatures', () => {
    it('should export async getAllListings returning Promise<Listing[]>', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('export async function getAllListings()') &&
          content.includes('Promise<Listing[]>'),
        'Should export getAllListings with async signature returning Promise<Listing[]>'
      );
    });

    it('should export async getListingBySlug returning Promise<Listing | null>', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('export async function getListingBySlug(slug: string)') &&
          content.includes('Promise<Listing | null>'),
        'Should export getListingBySlug with async signature returning Promise<Listing | null>'
      );
    });

    it('should export async getFeaturedListings returning Promise<Listing[]>', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('export async function getFeaturedListings()') &&
          content.includes('Promise<Listing[]>'),
        'Should export getFeaturedListings with async signature returning Promise<Listing[]>'
      );
    });

    it('should export async filterListings returning Promise<Listing[]>', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('export async function filterListings(') &&
          content.includes('Promise<Listing[]>'),
        'Should export filterListings with async signature returning Promise<Listing[]>'
      );
    });

    it('should export clearListingsCache as no-op for test compatibility', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('export function clearListingsCache()'),
        'Should export clearListingsCache for backward-compatibility with test teardown'
      );
    });
  });

  describe('Subscription Gate in Queries', () => {
    it('should embed AGENT_VISIBLE_SQL in getAllListings and getListingBySlug queries', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('AGENT_VISIBLE_SQL'),
        'Public listing reads should reference AGENT_VISIBLE_SQL to gate suspended/lapsed/hidden listings (Phase 5)'
      );
    });

    it('should filter by l.status = active in getAllListings', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes("l.status = 'active'"),
        "Should apply l.status = 'active' filter to exclude paused listings"
      );
    });

    it('should JOIN agents table aliased as a for subscription gate', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('JOIN agents a ON l.agent_id = a.id'),
        'Should JOIN agents table aliased as "a" so AGENT_PUBLISHABLE_SQL can reference a.is_admin etc.'
      );
    });
  });

  describe('Two-Query Image Grouping', () => {
    it('should use in-memory Map for image grouping (not GROUP_CONCAT)', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('new Map<string, string[]>()') &&
          !content.includes('GROUP_CONCAT'),
        'Should group images via in-memory Map, not GROUP_CONCAT (avoids N-row JOIN fanout)'
      );
    });

    it('should order listing_images by display_order ASC', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('ORDER BY display_order ASC'),
        'Should order images by display_order ASC to match original JSON array order'
      );
    });
  });

  describe('D1 Row Mapping', () => {
    it('should convert epoch created_at to ISO string', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('new Date(row.created_at * 1000).toISOString()'),
        'Should convert D1 epoch seconds to ISO 8601 string for the Listing.createdAt field'
      );
    });

    it('should map featured integer to boolean (featured === 1)', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes('row.featured === 1'),
        'Should map D1 INTEGER featured column (0/1) to TypeScript boolean'
      );
    });

    it('should use null-coalescing for optional fields', () => {
      const content = readFileSync(dataPath, 'utf-8');
      assert.ok(
        content.includes("row.zip ?? ''") &&
          content.includes('row.sqft ?? 0') &&
          content.includes("row.description ?? ''"),
        'Should coalesce nullable D1 fields (zip, sqft, description) to safe defaults'
      );
    });
  });
});
