/**
 * Tier-Based Search Placement Tests
 *
 * Behavioral tests for the pure placement helpers (tierGrantsFeaturedPlacement,
 * selectHomepageListings) plus structural assertions verifying the tier-rank
 * ORDER BY in getAllListings, the new Listing.featuredPlacement field, and the
 * extended ListingCard badge condition.
 *
 * Design: docs/superpowers/specs/2026-06-23-tier-based-search-placement-design.md
 *
 * @module tests/tier-placement.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  tierGrantsFeaturedPlacement,
  selectHomepageListings,
} from '../lib/data.js';
import type { Listing } from '../types/index.js';

const projectRoot = process.cwd();

/** Build a minimal Listing for ordering tests. */
function makeListing(id: string, featured: boolean): Listing {
  return {
    id,
    slug: id,
    address: id,
    city: 'Houston',
    state: 'TX',
    zip: '77002',
    price: 100000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    description: '',
    images: [],
    featured,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('tierGrantsFeaturedPlacement', () => {
  it('returns true for pro tier', () => {
    assert.equal(tierGrantsFeaturedPlacement('pro'), true);
  });

  it('returns true for team tier', () => {
    assert.equal(tierGrantsFeaturedPlacement('team'), true);
  });

  it('returns false for starter tier', () => {
    assert.equal(tierGrantsFeaturedPlacement('starter'), false);
  });

  it('returns false for null, undefined, or none', () => {
    assert.equal(tierGrantsFeaturedPlacement(null), false);
    assert.equal(tierGrantsFeaturedPlacement(undefined), false);
    assert.equal(tierGrantsFeaturedPlacement('none'), false);
  });
});

describe('selectHomepageListings', () => {
  it('orders admin-featured listings before non-featured ones', () => {
    // Arrange
    const input = [
      makeListing('a', false),
      makeListing('b', true),
      makeListing('c', false),
    ];
    // Act
    const result = selectHomepageListings(input);
    // Assert
    assert.deepEqual(
      result.map((l) => l.id),
      ['b', 'a', 'c']
    );
  });

  it('caps the result at 6 cards', () => {
    // Arrange — 8 non-featured listings
    const input = Array.from({ length: 8 }, (_, i) =>
      makeListing(`n${i}`, false)
    );
    // Act
    const result = selectHomepageListings(input);
    // Assert
    assert.equal(result.length, 6);
  });

  it('tops up with non-featured listings when fewer than 6 are featured', () => {
    // Arrange — 2 featured, 5 non-featured
    const featured = [makeListing('f0', true), makeListing('f1', true)];
    const rest = Array.from({ length: 5 }, (_, i) =>
      makeListing(`n${i}`, false)
    );
    // Act
    const result = selectHomepageListings([...rest, ...featured]);
    // Assert — featured first, then top up to 6 with non-featured
    assert.equal(result.length, 6);
    assert.deepEqual(
      result.slice(0, 2).map((l) => l.id),
      ['f0', 'f1']
    );
    assert.equal(result[0].featured, true);
    assert.equal(result[5].featured, false);
  });

  it('preserves input order within the featured and non-featured groups', () => {
    // Arrange
    const input = [
      makeListing('f1', true),
      makeListing('f2', true),
      makeListing('n1', false),
      makeListing('n2', false),
    ];
    // Act
    const result = selectHomepageListings(input);
    // Assert
    assert.deepEqual(
      result.map((l) => l.id),
      ['f1', 'f2', 'n1', 'n2']
    );
  });

  it('returns all listings when fewer than the cap and none featured', () => {
    // Arrange
    const input = [makeListing('a', false), makeListing('b', false)];
    // Act
    const result = selectHomepageListings(input);
    // Assert
    assert.deepEqual(
      result.map((l) => l.id),
      ['a', 'b']
    );
  });

  it('respects an explicit cap argument', () => {
    const input = Array.from({ length: 5 }, (_, i) =>
      makeListing(`n${i}`, false)
    );
    assert.equal(selectHomepageListings(input, 3).length, 3);
  });
});

describe('getAllListings tier-rank ORDER BY (src/lib/data.ts)', () => {
  const content = readFileSync(join(projectRoot, 'src/lib/data.ts'), 'utf-8');

  it('orders admin-featured listings first (l.featured DESC)', () => {
    assert.ok(
      content.includes('ORDER BY l.featured DESC'),
      'getAllListings should order by l.featured DESC first'
    );
  });

  it('ranks tiers via a CASE expression (team/pro/starter, admin)', () => {
    assert.ok(content.includes('a.is_admin = 1'), 'admin should be ranked');
    assert.ok(
      content.includes("a.subscription_tier = 'team'"),
      'team should be ranked'
    );
    assert.ok(
      content.includes("a.subscription_tier = 'pro'"),
      'pro should be ranked'
    );
    assert.ok(
      content.includes("a.subscription_tier = 'starter'"),
      'starter should be ranked'
    );
  });

  it('selects a.subscription_tier so the rank/badge can be derived', () => {
    assert.ok(
      content.includes('a.subscription_tier'),
      'query should select a.subscription_tier'
    );
  });

  it('still breaks ties by recency (created_at DESC)', () => {
    assert.ok(
      content.includes('l.created_at DESC'),
      'ordering should fall back to created_at DESC'
    );
  });

  it('derives featuredPlacement from the owning agent tier', () => {
    assert.ok(
      content.includes('tierGrantsFeaturedPlacement(row.subscription_tier)'),
      'rowToListing should set featuredPlacement via tierGrantsFeaturedPlacement'
    );
  });
});

describe('Listing.featuredPlacement field (src/types/index.ts)', () => {
  it('declares featuredPlacement on the Listing interface', () => {
    const content = readFileSync(
      join(projectRoot, 'src/types/index.ts'),
      'utf-8'
    );
    assert.ok(
      /featuredPlacement\??:\s*boolean/.test(content),
      'Listing should declare a featuredPlacement boolean field'
    );
  });
});

describe('ListingCard tier badge (src/components/ListingCard.tsx)', () => {
  it('shows the badge for featuredPlacement as well as featured', () => {
    const content = readFileSync(
      join(projectRoot, 'src/components/ListingCard.tsx'),
      'utf-8'
    );
    assert.ok(
      content.includes('listing.featuredPlacement'),
      'badge condition should include listing.featuredPlacement'
    );
  });
});
