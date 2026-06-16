/**
 * Tests for Listings Page (RSC + ListingsClient architecture)
 *
 * Verifies that:
 * - page.tsx is a force-dynamic RSC that fetches from D1 via getAllListings
 * - ListingsClient.tsx is a 'use client' component that owns filter state and UX
 *
 * @module tests/listings-page.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve project root from this test file's location (src/tests/ -> ../../)
const ROOT_DIR = resolve(fileURLToPath(import.meta.url), '../../..');
const PAGE_FILE = join(ROOT_DIR, 'src/app/listings/page.tsx');
const CLIENT_FILE = join(ROOT_DIR, 'src/app/listings/ListingsClient.tsx');

describe('Listings Page (RSC + ListingsClient)', () => {
  describe('page.tsx — Server Component', () => {
    it('should exist at src/app/listings/page.tsx', () => {
      assert.strictEqual(existsSync(PAGE_FILE), true, 'Listings page file should exist');
    });

    it('should export const dynamic = force-dynamic', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        content.includes("export const dynamic = 'force-dynamic'"),
        "page.tsx must export const dynamic = 'force-dynamic'"
      );
    });

    it('should NOT have use client directive (it is an RSC)', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        !content.includes("'use client'") && !content.includes('"use client"'),
        "page.tsx must NOT have 'use client' — it is a server component"
      );
    });

    it('should import getAllListings from @/lib/data', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        content.includes("getAllListings") && content.includes("from '@/lib/data'"),
        "page.tsx must import getAllListings from @/lib/data"
      );
    });

    it('should import ListingsClient from ./ListingsClient', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        content.includes("ListingsClient") && content.includes("'./ListingsClient'"),
        "page.tsx must import ListingsClient from ./ListingsClient"
      );
    });

    it('should export default async function ListingsPage', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        content.includes('export default async function ListingsPage'),
        'page.tsx must export default async function ListingsPage'
      );
    });

    it('should call getAllListings() and pass result to ListingsClient as initialListings', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        content.includes('getAllListings()') && content.includes('initialListings'),
        'page.tsx must call getAllListings() and pass result as initialListings prop'
      );
    });

    it('should NOT have useState, useEffect, useCallback or useMemo (RSC has no hooks)', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        !content.includes('useState') &&
          !content.includes('useEffect') &&
          !content.includes('useCallback') &&
          !content.includes('useMemo'),
        'page.tsx RSC must not import or use React hooks'
      );
    });

    it('should NOT dynamically import JSON listing files', () => {
      const content = readFileSync(PAGE_FILE, 'utf-8');
      assert.ok(
        !content.includes('@/data/listings/'),
        'page.tsx RSC must not use legacy JSON dynamic imports'
      );
    });
  });

  describe('ListingsClient.tsx — Client Component', () => {
    it('should exist at src/app/listings/ListingsClient.tsx', () => {
      assert.strictEqual(existsSync(CLIENT_FILE), true, 'ListingsClient.tsx should exist');
    });

    it("should have 'use client' directive", () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes("'use client'"),
        "ListingsClient.tsx must have 'use client' directive"
      );
    });

    it('should accept initialListings prop', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('initialListings'),
        'ListingsClient must accept initialListings prop'
      );
    });

    it('should import ListingCard component', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes("import { ListingCard } from '@/components/ListingCard'"),
        'Should import ListingCard component'
      );
    });

    it('should import FilterBar component', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes("import { FilterBar } from '@/components/FilterBar'"),
        'Should import FilterBar component'
      );
    });

    it('should import types from @/types', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes("Listing") && content.includes("FilterOptions") && content.includes("from '@/types'"),
        'Should import Listing and FilterOptions types'
      );
    });

    it('should import React hooks for state management', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('useState') && content.includes('useCallback') && content.includes('useMemo'),
        'ListingsClient must import useState, useCallback, and useMemo hooks'
      );
    });

    it('should have filterListingsClientSide function', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('function filterListingsClientSide'),
        'Should have filterListingsClientSide function'
      );
    });

    it('should filter by minPrice', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('filters.minPrice !== undefined && listing.price < filters.minPrice'),
        'Should filter by minPrice'
      );
    });

    it('should filter by maxPrice', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('filters.maxPrice !== undefined && listing.price > filters.maxPrice'),
        'Should filter by maxPrice'
      );
    });

    it('should filter by minBeds', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('filters.minBeds !== undefined && listing.beds < filters.minBeds'),
        'Should filter by minBeds'
      );
    });

    it('should use useMemo for filtered listings', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('useMemo') && content.includes('filteredListings'),
        'Should use useMemo for filtered listings performance'
      );
    });

    it('should have filters state', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes("useState<FilterOptions>"),
        'Should have filters state via useState<FilterOptions>'
      );
    });

    it('should render FilterBar component', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('<FilterBar'),
        'Should render FilterBar component'
      );
    });

    it('should pass filters prop to FilterBar', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.match(/filters\s*=\s*\{filters\}/),
        'Should pass filters prop to FilterBar'
      );
    });

    it('should pass onFiltersChange handler to FilterBar', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('onFiltersChange={handleFiltersChange}'),
        'Should pass onFiltersChange handler to FilterBar'
      );
    });

    it('should pass resultCount to FilterBar', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('resultCount={filteredCount}'),
        'Should pass resultCount to FilterBar'
      );
    });

    it('should render ListingCard for each listing', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('filteredListings.map') && content.includes('<ListingCard'),
        'Should map filteredListings to ListingCard components'
      );
    });

    it('should use key prop with listing.id', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('key={listing.id}'),
        'Should use listing.id as key prop'
      );
    });

    it('should have responsive grid layout', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('grid-cols-1') &&
          content.includes('md:grid-cols-2') &&
          content.includes('lg:grid-cols-3'),
        'Should have responsive grid: 1 col mobile, 2 col tablet, 3 col desktop'
      );
    });

    it('should have empty state when no listings match filters', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('No listings match your filters') ||
          content.includes('filteredListings.length === 0'),
        'Should have empty state for no filter matches'
      );
    });

    it("should have 'Clear All Filters' button in empty state", () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('Clear All Filters') || content.includes('setFilters({})'),
        'Should have clear filters button in empty state'
      );
    });

    it('should have hero section with gradient-primary class', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('gradient-primary'),
        'Should use gradient-primary class for hero'
      );
    });

    it('should have page title', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('Houston Area Homes'),
        "Should have page title 'Houston Area Homes'"
      );
    });

    it('should have breadcrumb navigation', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('aria-label="Breadcrumb"') || content.includes('breadcrumb'),
        'Should have breadcrumb navigation'
      );
    });

    it('should display results count', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('filteredCount') && content.includes('totalCount'),
        'Should display filtered and total counts'
      );
    });

    it('should use container-custom class', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('container-custom'),
        'Should use container-custom class'
      );
    });

    it('should have responsive padding', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('py-6') || content.includes('py-10') || content.includes('sm:py'),
        'Should have responsive padding classes'
      );
    });

    it('should have responsive text sizes', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('text-2xl') && content.includes('sm:text-3xl'),
        'Should have responsive text sizes'
      );
    });

    it('should have semantic HTML structure', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('<section') && content.includes('<nav'),
        'Should use semantic section and nav elements'
      );
    });

    it('should have aria-label for breadcrumb', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('aria-label="Breadcrumb"'),
        'Should have aria-label for breadcrumb'
      );
    });

    it('should have aria-current for current page', () => {
      const content = readFileSync(CLIENT_FILE, 'utf-8');
      assert.ok(
        content.includes('aria-current="page"'),
        'Should have aria-current for current page'
      );
    });
  });
});
