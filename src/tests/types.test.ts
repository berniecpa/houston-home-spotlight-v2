/**
 * Type Definition Tests - US-003
 * 
 * Tests verify that:
 * 1. All required type definitions exist
 * 2. Interfaces have correct field names and types
 * 3. Optional fields are properly marked
 * 4. Types match expected schemas (e.g., Perfex CRM)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { 
  Listing, 
  LeadFormData, 
  FilterOptions, 
  LeadSubmissionResponse,
  ListingImage 
} from '../types/index.js';

describe('Type Definitions - US-003', () => {
  
  describe('Listing Interface', () => {
    it('should accept a complete valid listing object', () => {
      const listing: Listing = {
        id: '123',
        slug: '123-main-st-houston',
        address: '123 Main St',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        price: 450000,
        beds: 3,
        baths: 2,
        sqft: 2100,
        description: 'Beautiful home in Houston',
        images: ['/images/house1.jpg', '/images/house2.jpg'],
        videoUrl: 'https://youtube.com/watch?v=abc123',
        featured: true,
        createdAt: '2025-03-17T12:00:00Z'
      };
      
      assert.strictEqual(listing.id, '123');
      assert.strictEqual(listing.slug, '123-main-st-houston');
      assert.strictEqual(listing.address, '123 Main St');
      assert.strictEqual(listing.city, 'Houston');
      assert.strictEqual(listing.state, 'TX');
      assert.strictEqual(listing.zip, '77001');
      assert.strictEqual(listing.price, 450000);
      assert.strictEqual(listing.beds, 3);
      assert.strictEqual(listing.baths, 2);
      assert.strictEqual(listing.sqft, 2100);
      assert.strictEqual(listing.description, 'Beautiful home in Houston');
      assert.deepStrictEqual(listing.images, ['/images/house1.jpg', '/images/house2.jpg']);
      assert.strictEqual(listing.videoUrl, 'https://youtube.com/watch?v=abc123');
      assert.strictEqual(listing.featured, true);
      assert.strictEqual(listing.createdAt, '2025-03-17T12:00:00Z');
    });

    it('should accept listing without optional videoUrl', () => {
      const listing: Listing = {
        id: '456',
        slug: '456-oak-ave-houston',
        address: '456 Oak Ave',
        city: 'Houston',
        state: 'TX',
        zip: '77002',
        price: 350000,
        beds: 2,
        baths: 2,
        sqft: 1500,
        description: 'Cozy starter home',
        images: ['/images/house3.jpg'],
        featured: false,
        createdAt: '2025-03-16T10:00:00Z'
      };
      
      assert.strictEqual(listing.videoUrl, undefined);
    });

    it('should have correct types for numeric fields', () => {
      const listing: Listing = {
        id: '789',
        slug: '789-pine-st-houston',
        address: '789 Pine St',
        city: 'Houston',
        state: 'TX',
        zip: '77003',
        price: 550000.50,
        beds: 4,
        baths: 3.5,
        sqft: 2800,
        description: 'Spacious family home',
        images: [],
        featured: true,
        createdAt: '2025-03-15T08:00:00Z'
      };
      
      assert.strictEqual(typeof listing.price, 'number');
      assert.strictEqual(typeof listing.beds, 'number');
      assert.strictEqual(typeof listing.baths, 'number');
      assert.strictEqual(typeof listing.sqft, 'number');
    });

    it('should accept empty images array', () => {
      const listing: Listing = {
        id: '000',
        slug: 'coming-soon',
        address: 'TBD',
        city: 'Houston',
        state: 'TX',
        zip: '77004',
        price: 0,
        beds: 0,
        baths: 0,
        sqft: 0,
        description: 'Coming soon',
        images: [],
        featured: false,
        createdAt: '2025-03-17T12:00:00Z'
      };
      
      assert.deepStrictEqual(listing.images, []);
    });
  });

  describe('LeadFormData Interface', () => {
    it('should accept a complete lead form with listing reference', () => {
      const lead: LeadFormData = {
        firstname: 'John',
        lastname: 'Doe',
        email: 'john@example.com',
        phonenumber: '713-555-1234',
        description: 'Interested in viewing this property',
        listingSlug: '123-main-st-houston'
      };
      
      assert.strictEqual(lead.firstname, 'John');
      assert.strictEqual(lead.lastname, 'Doe');
      assert.strictEqual(lead.email, 'john@example.com');
      assert.strictEqual(lead.phonenumber, '713-555-1234');
      assert.strictEqual(lead.description, 'Interested in viewing this property');
      assert.strictEqual(lead.listingSlug, '123-main-st-houston');
    });

    it('should accept lead form without optional listingSlug', () => {
      const lead: LeadFormData = {
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'jane@example.com',
        phonenumber: '713-555-5678',
        description: 'General inquiry about available properties'
      };
      
      assert.strictEqual(lead.listingSlug, undefined);
    });

    it('should use Perfex CRM compatible field names', () => {
      // Verify field names match Perfex CRM API expectations
      const lead: LeadFormData = {
        firstname: 'Test',
        lastname: 'User',
        email: 'test@example.com',
        phonenumber: '555-0000',
        description: 'Test message'
      };
      
      // These assertions verify the field names are exactly as expected by Perfex
      assert.ok('firstname' in lead, 'Must have firstname field (Perfex CRM format)');
      assert.ok('lastname' in lead, 'Must have lastname field (Perfex CRM format)');
      assert.ok('phonenumber' in lead, 'Must have phonenumber field (Perfex CRM format)');
    });
  });

  describe('FilterOptions Interface', () => {
    it('should accept complete filter options', () => {
      const filters: FilterOptions = {
        minPrice: 300000,
        maxPrice: 600000,
        minBeds: 3
      };
      
      assert.strictEqual(filters.minPrice, 300000);
      assert.strictEqual(filters.maxPrice, 600000);
      assert.strictEqual(filters.minBeds, 3);
    });

    it('should accept partial filter options', () => {
      const minOnly: FilterOptions = { minPrice: 400000 };
      const maxOnly: FilterOptions = { maxPrice: 500000 };
      const bedsOnly: FilterOptions = { minBeds: 2 };
      
      assert.strictEqual(minOnly.minPrice, 400000);
      assert.strictEqual(maxOnly.maxPrice, 500000);
      assert.strictEqual(bedsOnly.minBeds, 2);
    });

    it('should accept empty filter options', () => {
      const filters: FilterOptions = {};
      assert.deepStrictEqual(filters, {});
    });

    it('should support undefined values for optional filters', () => {
      const filters: FilterOptions = {
        minPrice: undefined,
        maxPrice: 450000,
        minBeds: undefined
      };
      
      assert.strictEqual(filters.minPrice, undefined);
      assert.strictEqual(filters.maxPrice, 450000);
      assert.strictEqual(filters.minBeds, undefined);
    });
  });

  describe('LeadSubmissionResponse Interface', () => {
    it('should accept successful response', () => {
      const response: LeadSubmissionResponse = {
        success: true,
        message: 'Lead created successfully',
        leadId: '12345'
      };
      
      assert.strictEqual(response.success, true);
      assert.strictEqual(response.message, 'Lead created successfully');
      assert.strictEqual(response.leadId, '12345');
    });

    it('should accept error response without leadId', () => {
      const response: LeadSubmissionResponse = {
        success: false,
        message: 'Failed to create lead'
      };
      
      assert.strictEqual(response.success, false);
      assert.strictEqual(response.message, 'Failed to create lead');
      assert.strictEqual(response.leadId, undefined);
    });
  });

  describe('ListingImage Interface', () => {
    it('should accept minimal image with just URL', () => {
      const image: ListingImage = {
        url: '/images/house1.jpg'
      };
      
      assert.strictEqual(image.url, '/images/house1.jpg');
      assert.strictEqual(image.alt, undefined);
      assert.strictEqual(image.isPrimary, undefined);
    });

    it('should accept complete image metadata', () => {
      const image: ListingImage = {
        url: '/images/house1.jpg',
        alt: 'Front view of the house',
        isPrimary: true
      };
      
      assert.strictEqual(image.url, '/images/house1.jpg');
      assert.strictEqual(image.alt, 'Front view of the house');
      assert.strictEqual(image.isPrimary, true);
    });
  });
});
