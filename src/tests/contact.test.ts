/**
 * Contact Page Tests
 * 
 * Tests for the contact page component and functionality.
 * 
 * @module tests/contact.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CONTACT_PAGE_PATH = path.join(process.cwd(), 'src/app/contact/page.tsx');

describe('Contact Page', () => {
  describe('File Structure', () => {
    it('should have contact page at src/app/contact/page.tsx', () => {
      assert.ok(fs.existsSync(CONTACT_PAGE_PATH), 'Contact page should exist');
    });

    it('should export default ContactPage component', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('export default function ContactPage'),
        'Should export default ContactPage function'
      );
    });

    it('should export metadata', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('export const metadata'),
        'Should export metadata'
      );
    });
  });

  describe('Contact Information', () => {
    it('should display email address', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('mailto:') && content.includes('@'),
        'Should include email with mailto: link'
      );
    });

    it('should mention Houston and Texas', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('Houston'),
        'Should mention Houston location'
      );
      assert.ok(
        content.includes('TX') || content.includes('Texas'),
        'Should mention Texas'
      );
    });
  });

  describe('Contact Form', () => {
    it('should import InquiryForm component', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes("import { InquiryForm } from '@/components/InquiryForm'"),
        'Should import InquiryForm from @/components/InquiryForm'
      );
    });

    it('should render InquiryForm component', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('<InquiryForm'),
        'Should render InquiryForm component'
      );
    });

    it('should include form heading text', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.toLowerCase().includes('send') || content.toLowerCase().includes('message'),
        'Should include form heading like "Send a Message"'
      );
    });
  });

  describe('Styling and Layout', () => {
    it('should use mobile-first responsive classes', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      // Check for responsive grid or flex layouts
      const hasResponsiveLayout = 
        content.includes('grid-cols-1') ||
        content.includes('md:') ||
        content.includes('lg:');
      assert.ok(
        hasResponsiveLayout,
        'Should use mobile-first responsive classes (grid-cols-1, md:, lg:)'
      );
    });

    it('should have hero section with gradient', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('gradient-primary'),
        'Should use gradient-primary class for hero section'
      );
    });

    it('should use card class for form container', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('className="card'),
        'Should use card class for form container'
      );
    });

    it('should use container-custom class', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('container-custom'),
        'Should use container-custom for consistent width'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      const hasH1 = content.includes('<h1');
      const hasH2 = content.includes('<h2');
      const hasH3 = content.includes('<h3');
      
      assert.ok(hasH1, 'Should have h1 element');
      assert.ok(hasH2 || hasH3, 'Should have h2 or h3 elements');
    });

    it('should use semantic HTML elements', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('<section'),
        'Should use section elements for content areas'
      );
    });

    it('should have aria-hidden on decorative icons', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('aria-hidden="true"'),
        'Should use aria-hidden="true" on decorative icons'
      );
    });
  });

  describe('SEO and Metadata', () => {
    it('should have page title in metadata', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('title:') && content.includes('Contact'),
        'Should have Contact in page title metadata'
      );
    });

    it('should have page description', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('description:'),
        'Should have description in metadata'
      );
    });
  });

  describe('Business Information', () => {
    it('should mention Houston Home Spotlight', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('Houston Home Spotlight'),
        'Should mention Houston Home Spotlight'
      );
    });

    it('should have license information', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.toLowerCase().includes('license') || 
        content.toLowerCase().includes('trec') ||
        content.toLowerCase().includes('commission'),
        'Should include license or TREC information'
      );
    });

    it('should mention service areas', () => {
      const content = fs.readFileSync(CONTACT_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('Harris') || content.includes('Fort Bend') || content.includes('Service Areas'),
        'Should mention service areas (Harris/Fort Bend Counties)'
      );
    });
  });
});
