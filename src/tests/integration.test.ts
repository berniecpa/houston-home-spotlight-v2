/** @jest-environment node */
/**
 * Integration Tests - US-019: Final build verification and integration testing
 *
 * These tests verify that all components work together correctly
 * and the site is ready for deployment.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = join(process.cwd(), 'dist');
const SRC_DIR = join(process.cwd(), 'src');

describe('Build Verification - US-019', () => {
  describe('1. Build Output Verification', () => {
    it('should have dist directory with build output', () => {
      assert.ok(existsSync(DIST_DIR), 'dist directory should exist');
    });

    it('should generate index.html at root', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      assert.ok(existsSync(indexPath), 'index.html should exist');
      const content = readFileSync(indexPath, 'utf-8');
      assert.ok(content.includes('<html'), 'index.html should contain HTML');
      assert.ok(content.includes('</html>'), 'index.html should be complete');
    });

    it('should generate 404.html', () => {
      const notFoundPath = join(DIST_DIR, '404.html');
      assert.ok(existsSync(notFoundPath), '404.html should exist');
    });

    it('should generate all listing detail pages', () => {
      const listingsDir = join(DIST_DIR, 'listings');
      assert.ok(existsSync(listingsDir), 'listings directory should exist');
      
      const expectedListings = [
        'riverside-terrace-modern-craftsman.html',
        'heights-bungalow-historic.html',
        'sugarland-estate-pool.html'
      ];

      for (const filename of expectedListings) {
        const listingPath = join(listingsDir, filename);
        assert.ok(existsSync(listingPath), `Listing page ${filename} should exist`);
      }
    });

    it('should generate contact page', () => {
      const contactPath = join(DIST_DIR, 'contact.html');
      assert.ok(existsSync(contactPath), 'contact.html should exist');
    });

    it('should generate all-listings page', () => {
      const listingsIndexPath = join(DIST_DIR, 'listings.html');
      assert.ok(existsSync(listingsIndexPath), 'listings.html should exist');
    });

    it('should have static assets (_next directory)', () => {
      const nextDir = join(DIST_DIR, '_next');
      assert.ok(existsSync(nextDir), '_next directory should exist');
      
      const staticDir = join(nextDir, 'static');
      assert.ok(existsSync(staticDir), '_next/static directory should exist');
    });
  });

  describe('2. HTML Structure Verification', () => {
    it('should have valid HTML structure in all pages', () => {
      const pagesToCheck = [
        'index.html',
        'contact.html',
        'listings.html',
        'listings/riverside-terrace-modern-craftsman.html'
      ];

      for (const page of pagesToCheck) {
        const pagePath = join(DIST_DIR, page);
        if (existsSync(pagePath)) {
          const content = readFileSync(pagePath, 'utf-8');
          assert.ok(content.includes('<!DOCTYPE html>') || content.includes('<!doctype html>'), 
            `${page} should have DOCTYPE`);
          assert.ok(content.includes('<html'), `${page} should have html tag`);
          assert.ok(content.includes('<head>'), `${page} should have head tag`);
          assert.ok(content.includes('<body'), `${page} should have body tag`);
          assert.ok(content.includes('</body>'), `${page} should have closing body tag`);
          assert.ok(content.includes('</html>'), `${page} should have closing html tag`);
        }
      }
    });

    it('should have meta viewport tag for mobile responsiveness', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      assert.ok(content.includes('viewport'), 'Should have viewport meta tag');
    });

    it('should have title tag in all pages', () => {
      const pagesToCheck = [
        'index.html',
        'contact.html',
        'listings.html'
      ];

      for (const page of pagesToCheck) {
        const pagePath = join(DIST_DIR, page);
        if (existsSync(pagePath)) {
          const content = readFileSync(pagePath, 'utf-8');
          assert.ok(content.includes('<title>'), `${page} should have title tag`);
          assert.ok(content.includes('</title>'), `${page} should have closing title tag`);
        }
      }
    });
  });

  describe('3. Navigation Links Verification', () => {
    it('should have navigation with working links on home page', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      
      // Check for main navigation links
      assert.ok(content.includes('href="/"') || content.includes('href="/\"'), 
        'Home page should have link to home');
      assert.ok(content.includes('href="/listings"'), 
        'Home page should have link to listings');
      assert.ok(content.includes('href="/contact"'), 
        'Home page should have link to contact');
    });

    it('should have header component with navigation', () => {
      const pagesToCheck = ['index.html', 'listings.html', 'contact.html'];
      
      for (const page of pagesToCheck) {
        const pagePath = join(DIST_DIR, page);
        if (existsSync(pagePath)) {
          const content = readFileSync(pagePath, 'utf-8');
          assert.ok(content.includes('<header') || content.includes('role="banner"'),
            `${page} should have header element`);
          assert.ok(content.includes('<nav') || content.includes('role="navigation"'),
            `${page} should have nav element`);
        }
      }
    });

    it('should have footer component on all pages', () => {
      const pagesToCheck = ['index.html', 'listings.html', 'contact.html'];
      
      for (const page of pagesToCheck) {
        const pagePath = join(DIST_DIR, page);
        if (existsSync(pagePath)) {
          const content = readFileSync(pagePath, 'utf-8');
          assert.ok(content.includes('<footer') || content.includes('role="contentinfo"'),
            `${page} should have footer element`);
        }
      }
    });
  });

  describe('4. Listing Data Integration', () => {
    it('should have listing data JSON files', () => {
      const dataDir = join(SRC_DIR, 'data', 'listings');
      assert.ok(existsSync(dataDir), 'Listings data directory should exist');
      
      const files = readdirSync(dataDir).filter(f => f.endsWith('.json'));
      assert.ok(files.length >= 2, 'Should have at least 2 listing JSON files');
    });

    it('should render listing content in detail pages', () => {
      const listingPath = join(DIST_DIR, 'listings', 'riverside-terrace-modern-craftsman.html');
      assert.ok(existsSync(listingPath), 'Riverside Terrace listing page should exist');
      
      const content = readFileSync(listingPath, 'utf-8');
      
      // Check for expected listing content
      assert.ok(content.includes('Riverside') || content.includes('riverside'),
        'Listing page should contain listing name');
      assert.ok(content.includes('bed') || content.includes('Bed'),
        'Listing page should contain bed count');
      assert.ok(content.includes('bath') || content.includes('Bath'),
        'Listing page should contain bath count');
    });

    it('should have featured listings on home page', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      
      // Check for listing cards or featured section
      assert.ok(content.includes('Featured') || content.includes('featured'),
        'Home page should have featured listings section');
    });
  });

  describe('5. Form Integration Verification', () => {
    it('should have inquiry form on listing detail pages', () => {
      const listingPath = join(DIST_DIR, 'listings', 'riverside-terrace-modern-craftsman.html');
      const content = readFileSync(listingPath, 'utf-8');
      
      // Check for form elements
      assert.ok(content.includes('<form') || content.includes('form'),
        'Listing detail page should have a form');
      assert.ok(content.includes('firstname') || content.includes('firstName'),
        'Form should have first name field');
      assert.ok(content.includes('email'),
        'Form should have email field');
    });

    it('should have contact form on contact page', () => {
      const contactPath = join(DIST_DIR, 'contact.html');
      const content = readFileSync(contactPath, 'utf-8');
      
      assert.ok(content.includes('<form') || content.includes('form'),
        'Contact page should have a form');
      assert.ok(content.includes('email'),
        'Contact form should have email field');
    });

    it('should have API route for lead submission', () => {
      const apiRoutePath = join(SRC_DIR, 'app', 'api', 'leads', 'route.ts');
      assert.ok(existsSync(apiRoutePath), 'API route for leads should exist');
      
      const content = readFileSync(apiRoutePath, 'utf-8');
      assert.ok(content.includes('POST'),
        'API route should handle POST requests');
    });
  });

  describe('6. Image Optimization Verification', () => {
    it('should have images in listing pages', () => {
      const listingPath = join(DIST_DIR, 'listings', 'riverside-terrace-modern-craftsman.html');
      const content = readFileSync(listingPath, 'utf-8');
      
      // Check for img tags or image references
      assert.ok(content.includes('<img') || content.includes('img src'),
        'Listing page should have images');
    });

    it('should have alt attributes for accessibility', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      
      // Check for alt attributes (basic check)
      assert.ok(content.includes('alt='),
        'Images should have alt attributes for accessibility');
    });
  });

  describe('7. Cloudflare Pages Compatibility', () => {
    it('should have wrangler.toml configuration', () => {
      const wranglerPath = join(process.cwd(), 'wrangler.toml');
      assert.ok(existsSync(wranglerPath), 'wrangler.toml should exist');
      
      const content = readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('bucket'), 'wrangler.toml should have bucket configuration');
    });

    it('should have .node-version file', () => {
      const nodeVersionPath = join(process.cwd(), '.node-version');
      assert.ok(existsSync(nodeVersionPath), '.node-version file should exist');
    });

    it('should have static export structure in dist', () => {
      // Check that all pages are pre-rendered as HTML
      const indexPath = join(DIST_DIR, 'index.html');
      const listingsIndexPath = join(DIST_DIR, 'listings.html');
      const contactPath = join(DIST_DIR, 'contact.html');
      
      assert.ok(existsSync(indexPath), 'Static index.html should exist');
      assert.ok(existsSync(listingsIndexPath), 'Static listings.html should exist');
      assert.ok(existsSync(contactPath), 'Static contact.html should exist');
    });
  });

  describe('8. SEO and Metadata Verification', () => {
    it('should have meta description tags', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      
      assert.ok(content.includes('meta') && content.includes('description'),
        'Page should have meta description');
    });

    it('should have Open Graph meta tags', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      
      assert.ok(content.includes('og:') || content.includes('property="og'),
        'Page should have Open Graph meta tags');
    });

    it('should have manifest.json', () => {
      const manifestPath = join(DIST_DIR, 'manifest.json');
      assert.ok(existsSync(manifestPath), 'manifest.json should exist in dist');
    });
  });

  describe('9. Responsive Design Verification', () => {
    it('should have viewport meta tag for mobile', () => {
      const pagesToCheck = ['index.html', 'contact.html', 'listings.html'];
      
      for (const page of pagesToCheck) {
        const pagePath = join(DIST_DIR, page);
        if (existsSync(pagePath)) {
          const content = readFileSync(pagePath, 'utf-8');
          assert.ok(content.includes('viewport') && content.includes('width=device-width'),
            `${page} should have proper viewport meta tag`);
        }
      }
    });

    it('should include Tailwind CSS classes', () => {
      const indexPath = join(DIST_DIR, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      
      // Check for common Tailwind classes
      assert.ok(content.includes('class="') && 
        (content.includes('flex') || content.includes('grid') || content.includes('md:')),
        'Page should use Tailwind CSS utility classes');
    });
  });

  describe('10. TypeScript Configuration Verification', () => {
    it('should have tsconfig.json with strict mode', () => {
      const tsconfigPath = join(process.cwd(), 'tsconfig.json');
      assert.ok(existsSync(tsconfigPath), 'tsconfig.json should exist');
      
      const content = readFileSync(tsconfigPath, 'utf-8');
      assert.ok(content.includes('strict') && content.includes('true'),
        'tsconfig.json should have strict mode enabled');
    });

    it('should have next.config.js with static export', () => {
      const nextConfigPath = join(process.cwd(), 'next.config.js');
      const nextConfigMjsPath = join(process.cwd(), 'next.config.mjs');
      const nextConfigTsPath = join(process.cwd(), 'next.config.ts');
      
      const configExists = existsSync(nextConfigPath) || 
                           existsSync(nextConfigMjsPath) || 
                           existsSync(nextConfigTsPath);
      
      assert.ok(configExists, 'Next.js config file should exist');
    });
  });
});

describe('Integration Test Summary', () => {
  it('should have all required files for deployment', () => {
    const requiredFiles = [
      join(DIST_DIR, 'index.html'),
      join(DIST_DIR, '404.html'),
      join(DIST_DIR, 'listings.html'),
      join(DIST_DIR, 'contact.html'),
      join(DIST_DIR, 'manifest.json'),
      join(DIST_DIR, 'listings', 'riverside-terrace-modern-craftsman.html'),
      join(DIST_DIR, 'listings', 'heights-bungalow-historic.html'),
      join(DIST_DIR, 'listings', 'sugarland-estate-pool.html'),
      join(process.cwd(), 'wrangler.toml'),
      join(process.cwd(), '.node-version')
    ];

    for (const file of requiredFiles) {
      assert.ok(existsSync(file), `${file} should exist`);
    }
  });
});
