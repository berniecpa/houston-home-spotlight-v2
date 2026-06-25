/**
 * Neighborhoods Tests
 *
 * Behavioral tests for the pure area helpers (areaBySlug, cityInArea) and a
 * data-integrity check that cities are assigned to at most one area.
 *
 * @module tests/neighborhoods.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  areaBySlug,
  cityInArea,
  NEIGHBORHOOD_AREAS,
} from '../lib/neighborhoods.js';

describe('areaBySlug', () => {
  it('resolves a known area by slug', () => {
    const area = areaBySlug('katy-cypress');
    assert.ok(area);
    assert.equal(area?.name, 'Katy & Cypress');
  });

  it('returns null for an unknown slug', () => {
    assert.equal(areaBySlug('does-not-exist'), null);
  });
});

describe('cityInArea', () => {
  it('matches a city case-insensitively and trimmed', () => {
    const area = areaBySlug('conroe-montgomery');
    assert.ok(area);
    assert.equal(cityInArea('  conroe ', area!), true);
    assert.equal(cityInArea('Magnolia', area!), true);
  });

  it('does not match a city from a different area', () => {
    const area = areaBySlug('conroe-montgomery');
    assert.ok(area);
    assert.equal(cityInArea('Katy', area!), false);
  });
});

describe('NEIGHBORHOOD_AREAS integrity', () => {
  it('assigns each city to at most one area (non-overlapping)', () => {
    const seen = new Map<string, string>();
    for (const area of NEIGHBORHOOD_AREAS) {
      for (const c of area.cities) {
        const key = c.toLowerCase();
        assert.ok(
          !seen.has(key),
          `city "${c}" appears in both ${seen.get(key)} and ${area.slug}`
        );
        seen.set(key, area.slug);
      }
    }
  });

  it('every area has a slug, name, and at least one city', () => {
    for (const area of NEIGHBORHOOD_AREAS) {
      assert.ok(area.slug.length > 0);
      assert.ok(area.name.length > 0);
      assert.ok(area.cities.length > 0);
    }
  });
});
