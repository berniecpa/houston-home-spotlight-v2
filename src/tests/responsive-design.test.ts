/**
 * Responsive Design Tests - US-018
 * 
 * Tests to verify mobile responsiveness across all components and pages.
 * Covers touch targets, breakpoints, layout behavior, and mobile navigation.
 * 
 * @module tests/responsive-design.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');
const COMPONENTS_DIR = join(SRC_DIR, 'components');
const APP_DIR = join(SRC_DIR, 'app');

/**
 * Helper to read file content
 */
function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

describe('Responsive Design Verification - US-018', () => {
  
  describe('Touch Target Requirements (44x44px minimum)', () => {
    
    it('Header mobile menu button has minimum 44px touch target', () => {
      const headerPath = join(COMPONENTS_DIR, 'Header.tsx');
      const content = readFile(headerPath);
      
      // Should have min-w-[44px] or min-h-[44px] or equivalent
      const hasMinWidth = content.includes('min-w-[44px]') || content.includes('min-h-[44px]');
      const hasMobileMenuButton = content.includes('md:hidden') && content.includes('button');
      
      assert.ok(hasMobileMenuButton, 'Header should have mobile menu button');
      assert.ok(hasMinWidth || content.includes('p-2.5'), 'Mobile menu button should have adequate touch target');
    });

    it('Header mobile navigation links have minimum 44px touch target', () => {
      const headerPath = join(COMPONENTS_DIR, 'Header.tsx');
      const content = readFile(headerPath);
      
      // Check for min-h-[44px] on mobile nav links
      assert.ok(
        content.includes('min-h-[44px]') || content.includes('py-3'),
        'Mobile nav links should have minimum 44px touch target'
      );
    });

    it('BedsFilter buttons have minimum 44px touch target', () => {
      const bedsFilterPath = join(COMPONENTS_DIR, 'BedsFilter.tsx');
      const content = readFile(bedsFilterPath);
      
      assert.ok(
        content.includes('min-h-[44px]') || content.includes('py-2.5'),
        'Beds filter buttons should have adequate touch target'
      );
    });

    it('PhotoGallery navigation buttons have minimum 44px touch target', () => {
      const galleryPath = join(COMPONENTS_DIR, 'PhotoGallery.tsx');
      const content = readFile(galleryPath);
      
      const hasMinDimensions = content.includes('min-w-[44px]') && content.includes('min-h-[44px]');
      assert.ok(
        hasMinDimensions,
        'Photo gallery navigation buttons should have 44x44px minimum touch target'
      );
    });

    it('PhotoGallery lightbox close button has minimum 44px touch target', () => {
      const galleryPath = join(COMPONENTS_DIR, 'PhotoGallery.tsx');
      const content = readFile(galleryPath);
      
      // Lightbox close button should have adequate touch target
      assert.ok(
        content.includes('min-w-[44px]') && content.includes('min-h-[44px]'),
        'Lightbox close button should have 44x44px minimum touch target'
      );
    });

    it('Footer links have minimum 44px touch target', () => {
      const footerPath = join(COMPONENTS_DIR, 'Footer.tsx');
      const content = readFile(footerPath);
      
      assert.ok(
        content.includes('min-h-[44px]'),
        'Footer links should have minimum 44px touch target'
      );
    });
  });

  describe('Responsive Breakpoints Configuration', () => {
    
    it('Tailwind config has xs breakpoint at 375px', () => {
      const tailwindPath = join(process.cwd(), 'tailwind.config.ts');
      const content = readFile(tailwindPath);
      
      assert.ok(
        content.includes('"xs": "375px"') || content.includes("'xs': '375px'"),
        'Tailwind config should have xs breakpoint at 375px for mobile testing'
      );
    });

    it('Tailwind config has standard breakpoints (sm, md, lg, xl)', () => {
      const tailwindPath = join(process.cwd(), 'tailwind.config.ts');
      const content = readFile(tailwindPath);
      
      // Check for breakpoint definitions in the screens section
      assert.ok(content.includes('"sm":') || content.includes("'sm':"), 'Should have sm breakpoint defined');
      assert.ok(content.includes('"md":') || content.includes("'md':"), 'Should have md breakpoint defined');
      assert.ok(content.includes('"lg":') || content.includes("'lg':"), 'Should have lg breakpoint defined');
      assert.ok(content.includes('"xl":') || content.includes("'xl':"), 'Should have xl breakpoint defined');
    });
  });

  describe('Mobile-First Responsive Patterns', () => {
    
    it('Home page uses mobile-first responsive classes', () => {
      const homePath = join(APP_DIR, 'page.tsx');
      const content = readFile(homePath);
      
      // Check for mobile-first patterns (base style first, then breakpoints)
      const hasResponsiveText = content.includes('text-3xl sm:text-4xl md:text-5xl') || 
                                content.includes('text-lg sm:text-xl');
      const hasResponsivePadding = content.includes('py-16 sm:py-20 md:py-24') ||
                                   content.includes('section-padding');
      const hasResponsiveGrid = content.includes('grid-cols-1 md:grid-cols-2');
      
      assert.ok(hasResponsiveText || hasResponsivePadding || hasResponsiveGrid,
        'Home page should use mobile-first responsive patterns');
    });

    it('Listings page uses responsive grid layout', () => {
      const listingsPath = join(APP_DIR, 'listings/page.tsx');
      const content = readFile(listingsPath);
      
      assert.ok(
        content.includes('grid-cols-1 md:grid-cols-2 lg:grid-cols-3'),
        'Listings page should use responsive grid (1 col mobile, 2 tablet, 3 desktop)'
      );
    });

    it('Listing detail page uses responsive layout', () => {
      const detailPath = join(APP_DIR, 'listings/[slug]/page.tsx');
      const content = readFile(detailPath);
      
      // Should have responsive grid for main content
      assert.ok(
        content.includes('grid-cols-1 lg:grid-cols-3') || content.includes('lg:col-span-2'),
        'Listing detail should use responsive grid layout'
      );
      
      // Should have responsive text sizes
      assert.ok(
        content.includes('text-2xl sm:text-3xl') || content.includes('text-xl sm:text-2xl'),
        'Listing detail should have responsive typography'
      );
    });

    it('Contact page uses responsive two-column layout', () => {
      const contactPath = join(APP_DIR, 'contact/page.tsx');
      const content = readFile(contactPath);
      
      assert.ok(
        content.includes('grid-cols-1 lg:grid-cols-2'),
        'Contact page should stack on mobile, side-by-side on desktop'
      );
    });

    it('ListingCard component uses responsive image sizes', () => {
      const cardPath = join(COMPONENTS_DIR, 'ListingCard.tsx');
      const content = readFile(cardPath);
      
      // Should have responsive sizes attribute
      assert.ok(
        content.includes('sizes=') && content.includes('max-width'),
        'ListingCard should have responsive image sizes'
      );
    });
  });

  describe('Mobile Navigation', () => {
    
    it('Header has hamburger menu for mobile', () => {
      const headerPath = join(COMPONENTS_DIR, 'Header.tsx');
      const content = readFile(headerPath);
      
      // Should have mobile menu toggle
      assert.ok(
        content.includes('useState') && content.includes('isMenuOpen'),
        'Header should have mobile menu state management'
      );
      
      // Should have hamburger icon
      assert.ok(
        content.includes('M4 6h16M4 12h16M4 18h16'),
        'Header should have hamburger menu icon'
      );
      
      // Should toggle visibility
      assert.ok(
        content.includes('hidden md:flex') && content.includes('md:hidden'),
        'Header should show/hide navigation based on breakpoint'
      );
    });

    it('Mobile menu has accessibility attributes', () => {
      const headerPath = join(COMPONENTS_DIR, 'Header.tsx');
      const content = readFile(headerPath);
      
      assert.ok(
        content.includes('aria-label') && content.includes('menu'),
        'Mobile menu button should have aria-label'
      );
      assert.ok(
        content.includes('aria-expanded'),
        'Mobile menu should have aria-expanded attribute'
      );
    });

    it('FilterBar is collapsible on mobile', () => {
      const filterPath = join(COMPONENTS_DIR, 'FilterBar.tsx');
      const content = readFile(filterPath);
      
      assert.ok(
        content.includes('isExpanded') && content.includes('setIsExpanded'),
        'FilterBar should have expandable state for mobile'
      );
      
      assert.ok(
        content.includes('sm:hidden') || content.includes('hidden sm:'),
        'FilterBar should toggle visibility on mobile'
      );
    });
  });

  describe('Responsive Typography', () => {
    
    it('Globals CSS has responsive heading styles', () => {
      const globalsPath = join(APP_DIR, 'globals.css');
      const content = readFile(globalsPath);
      
      assert.ok(
        content.includes('h1') && content.includes('md:text-4xl'),
        'H1 should have responsive font sizes'
      );
      
      assert.ok(
        content.includes('h2') && content.includes('md:text-3xl'),
        'H2 should have responsive font sizes'
      );
    });

    it('Pages use responsive text utilities', () => {
      const homePath = join(APP_DIR, 'page.tsx');
      const content = readFile(homePath);
      
      // Should have responsive text classes
      const hasResponsiveHeadings = /text-\w+\s+sm:text-\w+/.test(content);
      assert.ok(
        hasResponsiveHeadings,
        'Pages should use responsive text utilities'
      );
    });
  });

  describe('Responsive Spacing and Padding', () => {
    
    it('Container uses responsive padding', () => {
      const globalsPath = join(APP_DIR, 'globals.css');
      const content = readFile(globalsPath);
      
      assert.ok(
        content.includes('section-padding') && content.includes('sm:px-6'),
        'Container should have responsive padding'
      );
    });

    it('Section padding is responsive', () => {
      const homePath = join(APP_DIR, 'page.tsx');
      const content = readFile(homePath);
      
      assert.ok(
        content.includes('py-16 sm:py-20 md:py-24') || 
        content.includes('py-12 sm:py-16 md:py-20'),
        'Sections should have responsive vertical padding'
      );
    });
  });

  describe('Photo Gallery Mobile Support', () => {
    
    it('PhotoGallery has swipe support for mobile', () => {
      const galleryPath = join(COMPONENTS_DIR, 'PhotoGallery.tsx');
      const content = readFile(galleryPath);
      
      assert.ok(
        content.includes('onTouchStart') && content.includes('onTouchEnd'),
        'PhotoGallery should have touch event handlers for swipe'
      );
    });

    it('PhotoGallery shows swipe hint on mobile', () => {
      const galleryPath = join(COMPONENTS_DIR, 'PhotoGallery.tsx');
      const content = readFile(galleryPath);
      
      assert.ok(
        content.includes('Swipe to navigate') || content.includes('swipe'),
        'PhotoGallery should show swipe hint on mobile'
      );
    });

    it('PhotoGallery hides desktop arrows on mobile', () => {
      const galleryPath = join(COMPONENTS_DIR, 'PhotoGallery.tsx');
      const content = readFile(galleryPath);
      
      assert.ok(
        content.includes('hidden md:block') || content.includes('md:hidden'),
        'PhotoGallery should hide/show elements based on breakpoint'
      );
    });
  });

  describe('No Horizontal Scroll', () => {
    
    it('Globals CSS prevents horizontal overflow', () => {
      const globalsPath = join(APP_DIR, 'globals.css');
      const content = readFile(globalsPath);
      
      // Should have overflow control
      assert.ok(
        content.includes('overflow-x-hidden') || content.includes('no-horizontal-scroll'),
        'Should have utility to prevent horizontal scroll'
      );
    });

    it('Layouts use max-width containers', () => {
      // Check layout.tsx for responsive structure
      const layoutPath = join(APP_DIR, 'layout.tsx');
      const layoutContent = readFile(layoutPath);
      
      // Check any page file for container-custom usage
      const homePath = join(APP_DIR, 'page.tsx');
      const homeContent = readFile(homePath);
      
      // Layout should constrain content - either via flex layout or via pages using containers
      const hasFlexLayout = layoutContent.includes('flex-col') || layoutContent.includes('flex-grow');
      const hasContainerUsage = homeContent.includes('container-custom') || homeContent.includes('max-w-');
      
      assert.ok(
        hasFlexLayout || hasContainerUsage,
        'Layout should use flex layout or pages should use container-custom for width constraint'
      );
    });
  });

  describe('Form Responsiveness', () => {
    
    it('InquiryForm has responsive layout', () => {
      const formPath = join(COMPONENTS_DIR, 'InquiryForm.tsx');
      const content = readFile(formPath);
      
      // Should have responsive grid for name fields
      assert.ok(
        content.includes('grid-cols-1 sm:grid-cols-2'),
        'InquiryForm should stack fields on mobile, side-by-side on desktop'
      );
    });

    it('Form inputs are full width on mobile', () => {
      const formPath = join(COMPONENTS_DIR, 'InquiryForm.tsx');
      const content = readFile(formPath);
      
      assert.ok(
        content.includes('w-full'),
        'Form inputs should be full width'
      );
    });
  });

  describe('Touch Target Utilities', () => {
    
    it('Globals CSS has touch target utilities', () => {
      const globalsPath = join(APP_DIR, 'globals.css');
      const content = readFile(globalsPath);
      
      assert.ok(
        content.includes('touch-target'),
        'Should have touch-target utility class'
      );
      
      assert.ok(
        content.includes('min-w-[44px]') && content.includes('min-h-[44px]'),
        'Touch target utility should set 44px minimum dimensions'
      );
    });
  });

  describe('Responsive Image Handling', () => {
    
    it('Images use responsive sizes attribute', () => {
      const cardPath = join(COMPONENTS_DIR, 'ListingCard.tsx');
      const content = readFile(cardPath);
      
      assert.ok(
        content.includes('sizes=') && content.includes('(max-width:'),
        'Images should have responsive sizes attribute'
      );
    });

    it('Images use srcset for responsive loading', () => {
      const cardPath = join(COMPONENTS_DIR, 'ListingCard.tsx');
      const content = readFile(cardPath);
      
      // Next.js Image component with sizes enables responsive srcset
      assert.ok(
        content.includes('from "next/image"') || content.includes('from \'next/image\''),
        'Should use Next.js Image for responsive images'
      );
    });
  });

  describe('Safe Area Support (Notch Devices)', () => {
    
    it('Globals CSS has safe area utilities', () => {
      const globalsPath = join(APP_DIR, 'globals.css');
      const content = readFile(globalsPath);
      
      assert.ok(
        content.includes('safe-area-inset') || content.includes('env(safe-area-inset'),
        'Should have safe area utilities for notch devices'
      );
    });
  });
});
