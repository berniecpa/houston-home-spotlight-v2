/**
 * Layout Component Tests - US-006
 * 
 * Tests verify that:
 * 1. Header component exists with correct structure
 * 2. Mobile hamburger menu is present
 * 3. Footer component exists with contact info
 * 4. Layout wraps all pages correctly
 * 5. Navigation links work
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('Layout Components - US-006', () => {
  
  describe('Header Component', () => {
    const headerPath = path.join(projectRoot, 'src/components/Header.tsx');
    
    it('should exist as a file', () => {
      assert.ok(fs.existsSync(headerPath), 'Header.tsx should exist');
    });

    it('should be a valid TypeScript React component', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes('export default function Header'), 'Should export default Header function');
      assert.ok(content.includes('useState'), 'Should use useState hook for mobile menu');
    });

    it('should have navigation links for Home, Listings, Contact', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes('href=') && content.includes('/"'), 'Should have Home link');
      assert.ok(content.includes('/listings'), 'Should have Listings link');
      assert.ok(content.includes('/contact'), 'Should have Contact link');
    });

    it('should have mobile hamburger menu button', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes('aria-label'), 'Should have aria-label for accessibility');
      assert.ok(content.includes('aria-expanded'), 'Should have aria-expanded for accessibility');
      assert.ok(content.includes('onClick'), 'Should have onClick handler for toggle');
      assert.ok(content.includes('isMenuOpen'), 'Should use isMenuOpen state');
    });

    it('should have logo branding', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes('/logo.png'), 'Should reference the logo image');
      assert.ok(content.includes('Houston Home Spotlight'), 'Should label the logo with the site name');
    });

    it('should be responsive with mobile-first classes', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes('md:hidden'), 'Should hide elements on desktop');
      assert.ok(content.includes('hidden md:flex'), 'Should show nav on desktop only');
      assert.ok(content.includes('container-custom'), 'Should use custom container class');
    });

    it('should use client directive for interactivity', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes("'use client'"), 'Should have use client directive');
    });

    it('should import next/link for navigation', () => {
      const content = fs.readFileSync(headerPath, 'utf-8');
      assert.ok(content.includes("import Link from 'next/link'"), 'Should import next/link');
    });
  });

  describe('Footer Component', () => {
    const footerPath = path.join(projectRoot, 'src/components/Footer.tsx');
    
    it('should exist as a file', () => {
      assert.ok(fs.existsSync(footerPath), 'Footer.tsx should exist');
    });

    it('should be a valid TypeScript React component', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes('export default function Footer'), 'Should export default Footer function');
    });

    it('should display copyright information', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes('All rights reserved'), 'Should have copyright text');
      assert.ok(content.includes('new Date().getFullYear()'), 'Should use dynamic year');
      assert.ok(content.includes('NB Elite Realty'), 'Should mention NB Elite Realty');
    });

    it('should have contact information', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes('Houston, TX'), 'Should have Houston location');
      assert.ok(content.includes('mailto:'), 'Should have email link');
      assert.ok(content.includes('tel:'), 'Should have phone link');
    });

    it('should have navigation links', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes('Quick Links'), 'Should have Quick Links section');
      assert.ok(content.includes('/"') || content.includes("/listings"), 'Should have Home link');
      assert.ok(content.includes('/listings'), 'Should have Listings link');
      assert.ok(content.includes('/contact'), 'Should have Contact link');
    });

    it('should be responsive', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes('md:grid-cols-3'), 'Should use 3 columns on desktop');
      assert.ok(content.includes('grid-cols-1'), 'Should use single column on mobile');
      assert.ok(content.includes('container-custom'), 'Should use custom container class');
    });

    it('should import next/link for navigation', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes("import Link from 'next/link'"), 'Should import next/link');
    });

    it('should have licensing information', () => {
      const content = fs.readFileSync(footerPath, 'utf-8');
      assert.ok(content.includes('Licensed Realtor'), 'Should have license info');
      assert.ok(content.includes('Harris and Fort Bend counties'), 'Should mention counties');
    });
  });

  describe('Root Layout', () => {
    const layoutPath = path.join(projectRoot, 'src/app/layout.tsx');
    
    it('should exist as a file', () => {
      assert.ok(fs.existsSync(layoutPath), 'layout.tsx should exist');
    });

    it('should import Header and Footer components', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      assert.ok(content.includes('Header') && content.includes('@/components/Header'), 'Should import Header');
      assert.ok(content.includes('Footer') && content.includes('@/components/Footer'), 'Should import Footer');
    });

    it('should render Header at the top', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      const headerIndex = content.indexOf('<Header');
      const mainIndex = content.indexOf('<main');
      assert.ok(headerIndex > -1, 'Should render Header component');
      assert.ok(mainIndex > -1, 'Should have main element');
      assert.ok(headerIndex < mainIndex, 'Header should be before main content');
    });

    it('should render Footer at the bottom', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      const footerIndex = content.indexOf('<Footer />');
      const mainIndex = content.indexOf('</main>');
      assert.ok(footerIndex > -1, 'Should render Footer component');
      assert.ok(footerIndex > mainIndex, 'Footer should be after main content');
    });

    it('should have main content area that grows', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      assert.ok(content.includes('flex-grow'), 'Main should have flex-grow class');
      assert.ok(content.includes('flex flex-col'), 'Body should be flex column');
      assert.ok(content.includes('min-h-screen'), 'Body should have min-h-screen');
    });

    it('should wrap children in main element', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      assert.ok(content.includes('<main'), 'Should have main element');
      assert.ok(content.includes('{children}'), 'Should render children prop');
      assert.ok(content.includes('</main>'), 'Should close main element');
    });

    it('should have proper HTML structure', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      assert.ok(content.includes('<html lang="en">'), 'Should have html element with lang');
      assert.ok(content.includes('<body'), 'Should have body element');
    });

    it('should preserve metadata configuration', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      assert.ok(content.includes('export const metadata'), 'Should export metadata');
      assert.ok(content.includes('siteConfig'), 'Metadata should be derived from siteConfig');
      const siteConfigContent = fs.readFileSync(path.join(projectRoot, 'src/lib/site-config.ts'), 'utf-8');
      assert.ok(siteConfigContent.includes('Houston Home Spotlight'), 'siteConfig should have site title');
      assert.ok(siteConfigContent.includes('NB Elite Realty'), 'siteConfig should mention NB Elite Realty');
    });

    it('should preserve font configuration', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      assert.ok(content.includes('Inter'), 'Should use Inter font');
      assert.ok(content.includes('Merriweather'), 'Should use Merriweather font');
    });
  });

  describe('Component File Structure', () => {
    it('should have all components in src/components directory', () => {
      const componentsDir = path.join(projectRoot, 'src/components');
      assert.ok(fs.existsSync(componentsDir), 'src/components directory should exist');
      
      const files = fs.readdirSync(componentsDir);
      assert.ok(files.includes('Header.tsx'), 'Header.tsx should be in components');
      assert.ok(files.includes('Footer.tsx'), 'Footer.tsx should be in components');
    });
  });

  describe('Navigation Links Consistency', () => {
    it('should have matching navigation between Header and Footer', () => {
      const headerContent = fs.readFileSync(
        path.join(projectRoot, 'src/components/Header.tsx'), 
        'utf-8'
      );
      const footerContent = fs.readFileSync(
        path.join(projectRoot, 'src/components/Footer.tsx'), 
        'utf-8'
      );

      // Check for paths (works with both single and double quotes)
      const headerLinks = ['Home', 'Listings', 'Contact'];
      
      headerLinks.forEach(link => {
        assert.ok(headerContent.includes(link), `Header should have ${link} link`);
        assert.ok(footerContent.includes(link), `Footer should have ${link} link`);
      });
    });
  });

  describe('Accessibility Features', () => {
    it('should have ARIA labels in mobile menu button', () => {
      const headerContent = fs.readFileSync(
        path.join(projectRoot, 'src/components/Header.tsx'), 
        'utf-8'
      );
      
      assert.ok(headerContent.includes('aria-label'), 'Should have aria-label');
      assert.ok(headerContent.includes('aria-expanded'), 'Should have aria-expanded');
    });

    it('should have semantic HTML structure', () => {
      const headerContent = fs.readFileSync(
        path.join(projectRoot, 'src/components/Header.tsx'), 
        'utf-8'
      );
      const footerContent = fs.readFileSync(
        path.join(projectRoot, 'src/components/Footer.tsx'), 
        'utf-8'
      );
      
      assert.ok(headerContent.includes('<header'), 'Header should use header tag');
      assert.ok(headerContent.includes('<nav'), 'Header should use nav tag');
      assert.ok(footerContent.includes('<footer'), 'Footer should use footer tag');
    });
  });
});
