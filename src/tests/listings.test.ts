/**
 * Tests for listing data and data loading functionality
 * 
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listingsDir = path.join(__dirname, '..', 'data', 'listings');

describe('Listing Data Tests', () => {
  describe('Directory Structure', () => {
    it('should have src/data/listings directory', () => {
      const exists = fs.existsSync(listingsDir);
      assert.strictEqual(exists, true, 'listings directory should exist');
    });

    it('should have 3 JSON files in listings directory', () => {
      const files = fs.readdirSync(listingsDir).filter(f => f.endsWith('.json'));
      assert.strictEqual(files.length, 3, 'should have exactly 3 JSON files');
    });
  });

  describe('JSON File Validation', () => {
    const files = fs.readdirSync(listingsDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(listingsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      let listing: unknown;

      try {
        listing = JSON.parse(content);
      } catch {
        listing = null;
      }

      describe(`File: ${file}`, () => {
        it('should be valid JSON', () => {
          assert.notStrictEqual(listing, null, `${file} should be valid JSON`);
        });

        it('should have required fields', () => {
          const l = listing as Record<string, unknown>;
          assert.strictEqual(typeof l.id, 'string', `${file}: id should be a string`);
          assert.strictEqual(typeof l.slug, 'string', `${file}: slug should be a string`);
          assert.strictEqual(typeof l.address, 'string', `${file}: address should be a string`);
          assert.strictEqual(typeof l.city, 'string', `${file}: city should be a string`);
          assert.strictEqual(typeof l.state, 'string', `${file}: state should be a string`);
          assert.strictEqual(typeof l.zip, 'string', `${file}: zip should be a string`);
          assert.strictEqual(typeof l.price, 'number', `${file}: price should be a number`);
          assert.strictEqual(typeof l.beds, 'number', `${file}: beds should be a number`);
          assert.strictEqual(typeof l.baths, 'number', `${file}: baths should be a number`);
          assert.strictEqual(typeof l.sqft, 'number', `${file}: sqft should be a number`);
          assert.strictEqual(typeof l.description, 'string', `${file}: description should be a string`);
          assert.strictEqual(typeof l.featured, 'boolean', `${file}: featured should be a boolean`);
          assert.strictEqual(typeof l.createdAt, 'string', `${file}: createdAt should be a string`);
        });

        it('should have images array with 3-5 images', () => {
          const l = listing as Record<string, unknown>;
          assert.ok(Array.isArray(l.images), `${file}: images should be an array`);
          const images = l.images as string[];
          assert.ok(images.length >= 3, `${file}: should have at least 3 images`);
          assert.ok(images.length <= 5, `${file}: should have at most 5 images`);
          
          for (const img of images) {
            assert.strictEqual(typeof img, 'string', `${file}: each image should be a string URL`);
            assert.ok(img.length > 0, `${file}: image URL should not be empty`);
          }
        });

        it('should have valid Houston-area location data', () => {
          const l = listing as Record<string, unknown>;
          assert.strictEqual(l.state, 'TX', `${file}: state should be TX`);
          assert.ok(l.city === 'Houston' || l.city === 'Sugar Land', `${file}: city should be Houston or Sugar Land`);
          assert.ok((l.zip as string).startsWith('77'), `${file}: ZIP should start with 77 (Houston area)`);
        });

        it('should have reasonable property values', () => {
          const l = listing as Record<string, unknown>;
          assert.ok((l.price as number) > 0, `${file}: price should be positive`);
          assert.ok((l.beds as number) > 0, `${file}: beds should be positive`);
          assert.ok((l.baths as number) > 0, `${file}: baths should be positive`);
          assert.ok((l.sqft as number) > 0, `${file}: sqft should be positive`);
        });
      });
    }
  });

  describe('Featured Listings', () => {
    it('should have at least one featured listing', () => {
      const files = fs.readdirSync(listingsDir).filter(f => f.endsWith('.json'));
      let featuredCount = 0;
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(listingsDir, file), 'utf-8');
        const listing = JSON.parse(content);
        if (listing.featured === true) {
          featuredCount++;
        }
      }
      
      assert.ok(featuredCount >= 1, 'should have at least one featured listing');
    });

    it('should have exactly one featured listing', () => {
      const files = fs.readdirSync(listingsDir).filter(f => f.endsWith('.json'));
      let featuredCount = 0;
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(listingsDir, file), 'utf-8');
        const listing = JSON.parse(content);
        if (listing.featured === true) {
          featuredCount++;
        }
      }
      
      assert.strictEqual(featuredCount, 1, 'should have exactly one featured listing');
    });
  });

  describe('Slug Uniqueness', () => {
    it('should have unique slugs across all listings', () => {
      const files = fs.readdirSync(listingsDir).filter(f => f.endsWith('.json'));
      const slugs = new Set<string>();
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(listingsDir, file), 'utf-8');
        const listing = JSON.parse(content);
        assert.ok(!slugs.has(listing.slug), `duplicate slug found: ${listing.slug}`);
        slugs.add(listing.slug);
      }
      
      assert.strictEqual(slugs.size, files.length, 'all slugs should be unique');
    });
  });

  describe('Data Loader Module', () => {
    it('should have listings.ts utility file', () => {
      const utilsDir = path.join(__dirname, '..', 'lib');
      const exists = fs.existsSync(path.join(utilsDir, 'listings.ts'));
      assert.strictEqual(exists, true, 'listings.ts should exist');
    });

    it('should contain required function exports in listings.ts', () => {
      // Check the file content for expected exports (path aliases don't resolve in test runner)
      const utilsDir = path.join(__dirname, '..', 'lib');
      const content = fs.readFileSync(path.join(utilsDir, 'listings.ts'), 'utf-8');
      
      assert.ok(content.includes('export async function loadListings'), 'should export loadListings');
      assert.ok(content.includes('export async function getListingBySlug'), 'should export getListingBySlug');
      assert.ok(content.includes('export async function getFeaturedListings'), 'should export getFeaturedListings');
      assert.ok(content.includes('export async function filterListings'), 'should export filterListings');
      assert.ok(content.includes('export function clearListingsCache'), 'should export clearListingsCache');
    });
  });
});
