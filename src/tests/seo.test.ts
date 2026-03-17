/**
 * SEO and Metadata Tests - US-017
 * 
 * Tests verify that:
 * 1. Root layout has comprehensive metadata configuration
 * 2. OpenGraph tags are present for social sharing
 * 3. Twitter card metadata is configured
 * 4. Favicon is present in app directory
 * 5. manifest.json is properly configured
 * 6. JSON-LD structured data is generated for listings
 * 7. All pages have proper metadata exports
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('SEO and Metadata Configuration - US-017', () => {
  
  describe('Root Layout Metadata', () => {
    const layoutPath = path.join(projectRoot, 'src/app/layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    it('should have viewport export', () => {
      assert.ok(layoutContent.includes('export const viewport'), 'Layout should export viewport configuration');
      assert.ok(layoutContent.includes('device-width'), 'Viewport should include device-width');
      assert.ok(layoutContent.includes('initialScale'), 'Viewport should include initialScale');
      assert.ok(layoutContent.includes('themeColor'), 'Viewport should include themeColor');
    });

    it('should have siteConfig export with required fields', () => {
      assert.ok(layoutContent.includes('export const siteConfig'), 'Layout should export siteConfig');
      assert.ok(layoutContent.includes('name:'), 'siteConfig should have name');
      assert.ok(layoutContent.includes('description:'), 'siteConfig should have description');
      assert.ok(layoutContent.includes('url:'), 'siteConfig should have url');
      assert.ok(layoutContent.includes('ogImage:'), 'siteConfig should have ogImage');
      assert.ok(layoutContent.includes('twitterHandle:'), 'siteConfig should have twitterHandle');
      assert.ok(layoutContent.includes('keywords:'), 'siteConfig should have keywords array');
    });

    it('should have comprehensive metadata export', () => {
      assert.ok(layoutContent.includes('export const metadata'), 'Layout should export metadata');
    });

    it('should have title with default and template', () => {
      assert.ok(layoutContent.includes('default:'), 'Metadata should have default title');
      assert.ok(layoutContent.includes('template:'), 'Metadata should have title template');
    });

    it('should have description metadata', () => {
      assert.ok(layoutContent.includes('description:'), 'Metadata should include description');
    });

    it('should have keywords metadata', () => {
      assert.ok(layoutContent.includes('keywords:'), 'Metadata should include keywords');
    });

    it('should have authors, creator, and publisher metadata', () => {
      assert.ok(layoutContent.includes('authors:'), 'Metadata should include authors');
      assert.ok(layoutContent.includes('creator:'), 'Metadata should include creator');
      assert.ok(layoutContent.includes('publisher:'), 'Metadata should include publisher');
    });

    it('should have metadataBase for URL resolution', () => {
      assert.ok(layoutContent.includes('metadataBase:'), 'Metadata should include metadataBase');
    });

    it('should have canonical alternates', () => {
      assert.ok(layoutContent.includes('alternates:'), 'Metadata should include alternates');
      assert.ok(layoutContent.includes('canonical:'), 'Metadata should include canonical URL');
    });

    it('should have OpenGraph configuration', () => {
      assert.ok(layoutContent.includes('openGraph:'), 'Metadata should include openGraph');
      assert.ok(layoutContent.includes('type: "website"') || layoutContent.includes("type: 'website'"), 'OpenGraph should have type website');
      assert.ok(layoutContent.includes('locale:'), 'OpenGraph should have locale');
      assert.ok(layoutContent.includes('siteName:'), 'OpenGraph should have siteName');
      assert.ok(layoutContent.includes('images:'), 'OpenGraph should have images array');
    });

    it('should have Twitter card configuration', () => {
      assert.ok(layoutContent.includes('twitter:'), 'Metadata should include twitter');
      assert.ok(layoutContent.includes('card:'), 'Twitter should have card type');
      assert.ok(layoutContent.includes('site:'), 'Twitter should have site handle');
      assert.ok(layoutContent.includes('creator:'), 'Twitter should have creator handle');
    });

    it('should have robots configuration', () => {
      assert.ok(layoutContent.includes('robots:'), 'Metadata should include robots');
      assert.ok(layoutContent.includes('index:'), 'Robots should have index directive');
      assert.ok(layoutContent.includes('follow:'), 'Robots should have follow directive');
    });

    it('should have icons configuration', () => {
      assert.ok(layoutContent.includes('icons:'), 'Metadata should include icons');
      assert.ok(layoutContent.includes('favicon.ico'), 'Icons should reference favicon.ico');
    });

    it('should reference manifest.json', () => {
      assert.ok(layoutContent.includes('manifest:'), 'Metadata should include manifest reference');
      assert.ok(layoutContent.includes('manifest.json'), 'Manifest should reference manifest.json');
    });
  });

  describe('Favicon', () => {
    const faviconPath = path.join(projectRoot, 'src/app/favicon.ico');

    it('should have favicon.ico in app directory', () => {
      assert.ok(fs.existsSync(faviconPath), 'favicon.ico should exist in src/app/ directory');
    });

    it('should have favicon file with content', () => {
      const stats = fs.statSync(faviconPath);
      assert.ok(stats.size > 0, 'favicon.ico should have content');
    });
  });

  describe('Manifest.json', () => {
    const manifestPath = path.join(projectRoot, 'public/manifest.json');

    it('should have manifest.json in public directory', () => {
      assert.ok(fs.existsSync(manifestPath), 'manifest.json should exist in public/ directory');
    });

    it('should have valid JSON structure', () => {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      assert.ok(typeof manifest === 'object', 'manifest.json should be valid JSON');
    });

    it('should have required manifest fields', () => {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      
      assert.ok(manifest.name, 'Manifest should have name');
      assert.ok(manifest.short_name, 'Manifest should have short_name');
      assert.ok(manifest.description, 'Manifest should have description');
      assert.ok(manifest.start_url, 'Manifest should have start_url');
      assert.ok(manifest.display, 'Manifest should have display');
      assert.ok(manifest.background_color, 'Manifest should have background_color');
      assert.ok(manifest.theme_color, 'Manifest should have theme_color');
      assert.ok(Array.isArray(manifest.icons), 'Manifest should have icons array');
    });

    it('should have icons with required properties', () => {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      
      assert.ok(manifest.icons.length > 0, 'Manifest should have at least one icon');
      
      for (const icon of manifest.icons) {
        assert.ok(icon.src, 'Each icon should have src');
        assert.ok(icon.sizes, 'Each icon should have sizes');
        assert.ok(icon.type, 'Each icon should have type');
      }
    });
  });

  describe('Listing Detail Page - Structured Data', () => {
    const listingPagePath = path.join(projectRoot, 'src/app/listings/[slug]/page.tsx');
    const listingPageContent = fs.readFileSync(listingPagePath, 'utf-8');

    it('should import siteConfig from layout', () => {
      assert.ok(
        listingPageContent.includes("import { siteConfig } from '@/app/layout'") ||
        listingPageContent.includes('import { siteConfig } from "@/app/layout"'),
        'Listing page should import siteConfig'
      );
    });

    it('should have generateMetadata function with OpenGraph', () => {
      assert.ok(listingPageContent.includes('generateMetadata'), 'Listing page should have generateMetadata');
      assert.ok(listingPageContent.includes('openGraph:'), 'Listing metadata should include OpenGraph');
      assert.ok(listingPageContent.includes('twitter:'), 'Listing metadata should include Twitter cards');
    });

    it('should have JSON-LD structured data generation function', () => {
      assert.ok(listingPageContent.includes('generateListingStructuredData'), 'Should have generateListingStructuredData function');
      assert.ok(listingPageContent.includes("'@context': 'https://schema.org'"), 'Should have Schema.org context');
      assert.ok(listingPageContent.includes("'@type': 'RealEstateListing'"), 'Should have RealEstateListing type');
    });

    it('should include structured data with property details', () => {
      assert.ok(listingPageContent.includes('address:'), 'Structured data should include address');
      assert.ok(listingPageContent.includes('price:'), 'Structured data should include price');
      assert.ok(listingPageContent.includes('floorSize:'), 'Structured data should include floorSize');
      assert.ok(listingPageContent.includes('numberOfRooms:') || listingPageContent.includes('beds'), 'Structured data should include room info');
    });

    it('should include broker/agent information in structured data', () => {
      assert.ok(listingPageContent.includes("'@type': 'RealEstateAgent'"), 'Structured data should include RealEstateAgent');
      assert.ok(listingPageContent.includes('broker:'), 'Structured data should include broker');
    });

    it('should inject JSON-LD script into the page', () => {
      assert.ok(listingPageContent.includes('application/ld+json'), 'Should include JSON-LD script type');
      assert.ok(listingPageContent.includes('dangerouslySetInnerHTML'), 'Should use dangerouslySetInnerHTML for JSON-LD');
      assert.ok(listingPageContent.includes('JSON.stringify(structuredData)'), 'Should stringify structured data');
    });
  });

  describe('Listings Layout - Metadata', () => {
    const listingsLayoutPath = path.join(projectRoot, 'src/app/listings/layout.tsx');

    it('should have listings layout file', () => {
      assert.ok(fs.existsSync(listingsLayoutPath), 'listings/layout.tsx should exist');
    });

    it('should export metadata for listings page', () => {
      const content = fs.readFileSync(listingsLayoutPath, 'utf-8');
      assert.ok(content.includes('export const metadata'), 'Listings layout should export metadata');
      assert.ok(content.includes('title:'), 'Listings metadata should have title');
      assert.ok(content.includes('description:'), 'Listings metadata should have description');
    });

    it('should have OpenGraph and Twitter metadata', () => {
      const content = fs.readFileSync(listingsLayoutPath, 'utf-8');
      assert.ok(content.includes('openGraph:'), 'Listings metadata should include OpenGraph');
      assert.ok(content.includes('twitter:'), 'Listings metadata should include Twitter');
    });
  });

  describe('Contact Page - Metadata', () => {
    const contactPagePath = path.join(projectRoot, 'src/app/contact/page.tsx');
    const contactContent = fs.readFileSync(contactPagePath, 'utf-8');

    it('should have metadata export', () => {
      assert.ok(contactContent.includes('export const metadata'), 'Contact page should export metadata');
    });

    it('should use siteConfig for consistent metadata', () => {
      assert.ok(contactContent.includes("import { siteConfig }") || contactContent.includes('siteConfig.'), 
        'Contact page should use siteConfig');
    });

    it('should have OpenGraph and Twitter metadata', () => {
      assert.ok(contactContent.includes('openGraph:'), 'Contact metadata should include OpenGraph');
      assert.ok(contactContent.includes('twitter:'), 'Contact metadata should include Twitter');
    });

    it('should have keywords metadata', () => {
      assert.ok(contactContent.includes('keywords:'), 'Contact metadata should include keywords');
    });
  });

  describe('Home Page - Metadata', () => {
    const homePagePath = path.join(projectRoot, 'src/app/page.tsx');
    const homeContent = fs.readFileSync(homePagePath, 'utf-8');

    it('should exist and have content', () => {
      assert.ok(fs.existsSync(homePagePath), 'Home page should exist');
      assert.ok(homeContent.length > 0, 'Home page should have content');
    });
  });

  describe('SEO Keywords Coverage', () => {
    const layoutPath = path.join(projectRoot, 'src/app/layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    it('should have Houston real estate keywords', () => {
      const keywords = [
        'Houston real estate',
        'Houston homes for sale',
        'Houston realtor',
      ];
      
      for (const keyword of keywords) {
        assert.ok(
          layoutContent.toLowerCase().includes(keyword.toLowerCase()),
          `Keywords should include "${keyword}"`
        );
      }
    });

    it('should have location-specific keywords', () => {
      assert.ok(
        layoutContent.includes('Harris County') || layoutContent.includes('Fort Bend'),
        'Keywords should include service area locations'
      );
    });
  });
});
