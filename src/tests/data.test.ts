/**
 * Tests for data loading utilities
 * Tests src/lib/data.ts functions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libDir = path.join(__dirname, '..', 'lib');
const dataFilePath = path.join(libDir, 'data.ts');

describe('Data Loading Utilities - US-005', () => {
  describe('File Structure', () => {
    it('should have src/lib/data.ts file', () => {
      const exists = fs.existsSync(dataFilePath);
      assert.strictEqual(exists, true, 'data.ts should exist in src/lib/');
    });

    it('should import types from @/types', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes("from '@/types'"), 'should import from @/types');
      assert.ok(content.includes('Listing'), 'should import Listing type');
      assert.ok(content.includes('FilterOptions'), 'should import FilterOptions type');
    });
  });

  describe('Function Exports', () => {
    it('should export getAllListings function', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('export async function getAllListings'), 
        'should export getAllListings function');
      assert.ok(content.includes('Promise<Listing[]>'), 
        'should return Promise<Listing[]>');
    });

    it('should export getListingBySlug function', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('export async function getListingBySlug'), 
        'should export getListingBySlug function');
      assert.ok(content.includes('slug: string'), 
        'should accept slug parameter');
      assert.ok(content.includes('Promise<Listing | null>'), 
        'should return Promise<Listing | null>');
    });

    it('should export getFeaturedListings function', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('export async function getFeaturedListings'), 
        'should export getFeaturedListings function');
      assert.ok(content.includes('Promise<Listing[]>'), 
        'should return Promise<Listing[]>');
    });

    it('should export filterListings function', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('export async function filterListings'), 
        'should export filterListings function');
      assert.ok(content.includes('filters: FilterOptions'), 
        'should accept FilterOptions parameter');
      assert.ok(content.includes('Promise<Listing[]>'), 
        'should return Promise<Listing[]>');
    });

    it('should export clearListingsCache function', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('export function clearListingsCache'), 
        'should export clearListingsCache function');
    });
  });

  describe('Caching Implementation', () => {
    it('should have a cache variable for listings', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('listingsCache'), 'should have listingsCache variable');
      assert.ok(content.includes('Listing[] | null'), 'cache should be typed as Listing[] | null');
    });

    it('should check cache in getAllListings before loading', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      // Check for if (listingsCache) pattern
      assert.ok(/if\s*\(\s*listingsCache\s*\)/.test(content), 
        'should check if listingsCache exists');
    });

    it('should clear cache when clearListingsCache is called', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('listingsCache = null'), 
        'should set listingsCache to null');
    });
  });

  describe('Error Handling', () => {
    it('should have try-catch blocks in async functions', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      // Count try blocks - should have at least 4 (one per async function)
      const tryMatches = content.match(/try\s*\{/g);
      assert.ok(tryMatches && tryMatches.length >= 4, 
        `should have try blocks in async functions (found ${tryMatches?.length || 0})`);
    });

    it('should return empty array on error for array-returning functions', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      // Check for return [] in catch blocks
      assert.ok(content.includes('return []'), 
        'should return empty array on error');
    });

    it('should return null on error for single listing lookup', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      // Check getListingBySlug returns null on error
      assert.ok(content.includes('return null'), 
        'should return null for not found/error cases');
    });
  });

  describe('Data Loading Logic', () => {
    it('should import all 3 listing JSON files', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('riverside-terrace-modern-craftsman.json'), 
        'should import riverside listing');
      assert.ok(content.includes('heights-bungalow-historic.json'), 
        'should import heights listing');
      assert.ok(content.includes('sugarland-estate-pool.json'), 
        'should import sugarland listing');
    });

    it('should use dynamic import for JSON files', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('import('), 'should use dynamic import');
      assert.ok(content.includes('@/data/listings/'), 'should use @/data/listings/ path');
    });

    it('should use Promise.all for parallel loading', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('Promise.all'), 'should use Promise.all for parallel loading');
    });
  });

  describe('Filter Logic', () => {
    it('should filter by minPrice', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('minPrice'), 'should reference minPrice');
      assert.ok(content.includes('listing.price < filters.minPrice'), 
        'should compare listing.price with minPrice');
    });

    it('should filter by maxPrice', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('maxPrice'), 'should reference maxPrice');
      assert.ok(content.includes('listing.price > filters.maxPrice'), 
        'should compare listing.price with maxPrice');
    });

    it('should filter by minBeds', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('minBeds'), 'should reference minBeds');
      assert.ok(content.includes('listing.beds < filters.minBeds'), 
        'should compare listing.beds with minBeds');
    });

    it('should check for undefined before applying filters', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(content.includes('!== undefined'), 
        'should check for undefined filter values');
    });
  });

  describe('JSDoc Documentation', () => {
    it('should have JSDoc comments for getAllListings', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(/\/\*\*[\s\S]*?getAllListings[\s\S]*?\*\//.test(content), 
        'should have JSDoc for getAllListings');
    });

    it('should have JSDoc comments for getListingBySlug', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(/\/\*\*[\s\S]*?getListingBySlug[\s\S]*?\*\//.test(content), 
        'should have JSDoc for getListingBySlug');
    });

    it('should have JSDoc comments for getFeaturedListings', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(/\/\*\*[\s\S]*?getFeaturedListings[\s\S]*?\*\//.test(content), 
        'should have JSDoc for getFeaturedListings');
    });

    it('should have JSDoc comments for filterListings', () => {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      assert.ok(/\/\*\*[\s\S]*?filterListings[\s\S]*?\*\//.test(content), 
        'should have JSDoc for filterListings');
    });
  });
});
