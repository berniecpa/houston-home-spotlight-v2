/**
 * Listing Detail Page Tests
 * 
 * Tests for the listing detail page including:
 * - Page file structure and exports
 * - generateStaticParams function
 * - generateMetadata function
 * - Page component rendering
 * - 404 handling for invalid slugs
 * - PhotoGallery integration
 * - Property stats display
 * - Description rendering
 * - InquiryForm integration
 * - Mobile responsive design
 * 
 * @module tests/listing-detail-page.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();
const pagePath = join(projectRoot, 'src/app/listings/[slug]/page.tsx');

describe('Listing Detail Page', () => {
  describe('File Structure', () => {
    it('should have page.tsx in src/app/listings/[slug]/', () => {
      assert.ok(existsSync(pagePath), 'page.tsx should exist in src/app/listings/[slug]/');
    });

    it('should NOT export generateStaticParams (force-dynamic removes static generation)', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        !content.includes('export async function generateStaticParams'),
        'generateStaticParams must be absent for force-dynamic pages'
      );
    });

    it('should export generateMetadata function', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('export async function generateMetadata'),
        'Should export generateMetadata function'
      );
    });

    it('should export default page component', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('export default async function ListingDetailPage'),
        'Should export default ListingDetailPage component'
      );
    });
  });

  describe('Imports', () => {
    it('should import Metadata from next', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes("import { Metadata } from 'next'"),
        'Should import Metadata from next'
      );
    });

    it('should import notFound from next/navigation', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes("import { notFound } from 'next/navigation'"),
        'Should import notFound from next/navigation'
      );
    });

    it('should import PhotoGallery component', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes("import { PhotoGallery } from '@/components/PhotoGallery'"),
        'Should import PhotoGallery component'
      );
    });

    it('should import InquiryForm component', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes("import { InquiryForm } from '@/components/InquiryForm'"),
        'Should import InquiryForm component'
      );
    });

    it('should import getListingBySlug from lib/data', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes("from '@/lib/data'") && content.includes('getListingBySlug') &&
          !content.includes('getAllListings'),
        'Should import only getListingBySlug from @/lib/data (getAllListings no longer needed)'
      );
    });

    it('should import Listing type', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes("import { Listing } from '@/types'"),
        'Should import Listing type'
      );
    });
  });

  describe('generateStaticParams', () => {
    it('should not have static params return type (force-dynamic removes static generation)', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        !content.includes('Promise<{ slug: string }[]>'),
        'Should not have generateStaticParams return type — function must be absent for force-dynamic'
      );
    });

    it('should not call getAllListings (no longer needed without static generation)', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        !content.includes('getAllListings()'),
        'Should not call getAllListings — detail page no longer needs it for static paths'
      );
    });
  });

  describe('generateMetadata', () => {
    it('should accept params as Promise<{ slug: string }>', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('params: Promise<{ slug: string }>'),
        'Should use Next.js 15 async params pattern'
      );
    });

    it('should call getListingBySlug with awaited slug', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('const { slug } = await params') &&
          content.includes('getListingBySlug(slug)'),
        'Should destructure slug via await params then pass to getListingBySlug'
      );
    });

    it('should return not found title for missing listing', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('Listing Not Found'),
        'Should return "Listing Not Found" title for invalid slugs'
      );
    });

    it('should include listing address in title', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.address') && content.includes('Houston Home Spotlight'),
        'Should include address in page title'
      );
    });

    it('should include property details in description', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.beds') && content.includes('listing.baths'),
        'Should include beds and baths in meta description'
      );
    });
  });

  describe('Page Component', () => {
    it('should accept params as Promise<{ slug: string }>', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('params: Promise<{ slug: string }>'),
        'Should use Next.js 15 async params pattern'
      );
    });

    it('should call getListingBySlug with awaited slug', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('const { slug } = await params') &&
          content.includes('getListingBySlug(slug)'),
        'Should destructure slug via await params then pass to getListingBySlug'
      );
    });

    it('should call notFound for invalid slugs', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('if (!listing)') && content.includes('notFound()'),
        'Should call notFound when listing is not found'
      );
    });
  });

  describe('PhotoGallery Integration', () => {
    it('should render PhotoGallery component', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('<PhotoGallery'),
        'Should render PhotoGallery component'
      );
    });

    it('should pass listing images to PhotoGallery', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('images={listing.images}'),
        'Should pass listing images to PhotoGallery'
      );
    });

    it('should pass listing address as alt text', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('alt={listing.address}'),
        'Should pass listing address as alt text'
      );
    });
  });

  describe('Property Stats Display', () => {
    it('should display price', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('formatPrice(listing.price)'),
        'Should format and display listing price'
      );
    });

    it('should display beds count', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.beds'),
        'Should display beds count'
      );
    });

    it('should display baths count', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.baths'),
        'Should display baths count'
      );
    });

    it('should display sqft', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('formatNumber(listing.sqft)'),
        'Should format and display square footage'
      );
    });

    it('should display full address', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.address') && 
        content.includes('listing.city') && 
        content.includes('listing.state'),
        'Should display full address'
      );
    });

    it('should have formatPrice helper function', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('function formatPrice'),
        'Should have formatPrice helper function'
      );
    });

    it('should have formatNumber helper function', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('function formatNumber'),
        'Should have formatNumber helper function'
      );
    });
  });

  describe('Description Rendering', () => {
    it('should display property description', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.description'),
        'Should display listing description'
      );
    });

    it('should have About This Home section', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('About This Home'),
        'Should have "About This Home" section heading'
      );
    });
  });

  describe('InquiryForm Integration', () => {
    it('should render InquiryForm component', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('<InquiryForm'),
        'Should render InquiryForm component'
      );
    });

    it('should pass listingSlug to InquiryForm', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listingSlug={listing.slug}'),
        'Should pass listing slug to InquiryForm'
      );
    });

    it('should have inquiry form section heading', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('Interested in this home?'),
        'Should have inquiry form heading'
      );
    });
  });

  describe('Navigation', () => {
    it('should have back to listings link', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('Back to Listings') && content.includes('href="/listings"'),
        'Should have back link to listings page'
      );
    });
  });

  describe('Property Details Section', () => {
    it('should have Property Details section', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('Property Details'),
        'Should have "Property Details" section heading'
      );
    });

    it('should display all property fields in details', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('Address') && 
        content.includes('City') && 
        content.includes('State') && 
        content.includes('ZIP Code'),
        'Should display all property detail fields'
      );
    });

    it('should calculate price per sqft', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('Price per Sqft') && content.includes('listing.price / listing.sqft'),
        'Should calculate and display price per square foot'
      );
    });
  });

  describe('Video Tour Section', () => {
    it('should conditionally render video section', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('listing.videoUrl') && content.includes('Video Tour'),
        'Should conditionally render video tour section'
      );
    });
  });

  describe('Mobile Responsive Design', () => {
    it('should have responsive container classes', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('container-custom'),
        'Should use container-custom for responsive container'
      );
    });

    it('should have responsive padding classes', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('py-6 sm:py-8 md:py-12'),
        'Should have responsive padding (py-6 sm:py-8 md:py-12)'
      );
    });

    it('should have responsive grid layout', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('grid-cols-1 lg:grid-cols-3'),
        'Should have responsive grid (1 col mobile, 3 col desktop)'
      );
    });

    it('should have responsive text sizes', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('text-2xl sm:text-3xl') || content.includes('text-xl sm:text-2xl'),
        'Should have responsive text sizes'
      );
    });

    it('should show mobile-only header on mobile', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('lg:hidden'),
        'Should have lg:hidden class for mobile-only elements'
      );
    });

    it('should show desktop-only header on desktop', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('hidden lg:block'),
        'Should have hidden lg:block class for desktop-only elements'
      );
    });

    it('should have responsive stats grid', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('grid-cols-2 sm:grid-cols-4'),
        'Should have responsive stats grid (2 cols mobile, 4 cols desktop)'
      );
    });

    it('should have responsive gap spacing', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('gap-6 sm:gap-8 lg:gap-10') ||
        content.includes('gap-4 sm:gap-6'),
        'Should have responsive gap spacing'
      );
    });
  });

  describe('Sticky Sidebar (Desktop)', () => {
    it('should have sticky positioning for form on desktop', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('lg:sticky lg:top-6'),
        'Should have sticky sidebar on desktop'
      );
    });
  });

  describe('Styling', () => {
    it('should use Tailwind classes for styling', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('className=') &&
        (content.includes('bg-') || content.includes('text-') || content.includes('rounded-')),
        'Should use Tailwind CSS classes'
      );
    });

    it('should have white background cards with shadows', () => {
      const content = readFileSync(pagePath, 'utf-8');
      assert.ok(
        content.includes('bg-white') && content.includes('shadow-sm'),
        'Should have white background cards with shadows'
      );
    });
  });
});
