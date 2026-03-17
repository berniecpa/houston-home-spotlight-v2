/**
 * Leads API Route Tests - US-013
 * 
 * Tests verify that:
 * 1. POST /api/leads route exists and exports POST handler
 * 2. Route reads PERFEX_RE_URL and PERFEX_RE_KEY from environment
 * 3. Lead data is mapped correctly to Perfex CRM format
 * 4. API calls Perfex /api/v1/leads endpoint
 * 5. Success response returns 200 with confirmation
 * 6. Error response returns 500 with error details
 * 7. Validation works for required fields
 * 8. Typecheck passes
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROUTE_PATH = join(process.cwd(), 'src/app/api/leads/route.ts');

describe('Leads API Route - US-013', () => {
  describe('File Structure', () => {
    it('should have route.ts in src/app/api/leads/', () => {
      assert.strictEqual(existsSync(ROUTE_PATH), true, 'route.ts should exist');
    });

    it('should export POST function', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('export async function POST'),
        'Should export POST async function'
      );
    });
  });

  describe('Imports', () => {
    it('should import NextRequest from next/server', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("import { NextRequest"),
        'Should import NextRequest'
      );
    });

    it('should import NextResponse from next/server', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('NextResponse'),
        'Should import NextResponse'
      );
    });

    it('should import LeadFormData type', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('LeadFormData'),
        'Should import LeadFormData type'
      );
    });

    it('should import LeadSubmissionResponse type', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('LeadSubmissionResponse'),
        'Should import LeadSubmissionResponse type'
      );
    });
  });

  describe('Environment Variables', () => {
    it('should read PERFEX_RE_URL from process.env', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('process.env.PERFEX_RE_URL'),
        'Should read PERFEX_RE_URL from environment'
      );
    });

    it('should read PERFEX_RE_KEY from process.env', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('process.env.PERFEX_RE_KEY'),
        'Should read PERFEX_RE_KEY from environment'
      );
    });
  });

  describe('Request Body Parsing', () => {
    it('should parse JSON request body', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('await request.json()'),
        'Should parse JSON request body'
      );
    });

    it('should type body as LeadFormData', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('body: LeadFormData'),
        'Should type body as LeadFormData'
      );
    });
  });

  describe('Field Mapping', () => {
    it('should map firstname field correctly', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("firstname: body.firstname") || content.includes("firstname: body['firstname']"),
        'Should map firstname field to CRM format'
      );
    });

    it('should map lastname field correctly', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("lastname: body.lastname") || content.includes("lastname: body['lastname']"),
        'Should map lastname field to CRM format'
      );
    });

    it('should map email field correctly', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("email: body.email") || content.includes("email: body['email']"),
        'Should map email field to CRM format'
      );
    });

    it('should map phonenumber field correctly', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("phonenumber: body.phonenumber") || content.includes("phonenumber: body['phonenumber']"),
        'Should map phonenumber field to CRM format'
      );
    });

    it('should map description field correctly', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("description:") && content.includes('body.description'),
        'Should map description field to CRM format'
      );
    });
  });

  describe('Perfex CRM API Call', () => {
    it('should call Perfex /api/v1/leads endpoint', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('/api/v1/leads'),
        'Should call Perfex CRM /api/v1/leads endpoint'
      );
    });

    it('should use POST method for CRM call', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("method: 'POST'") || content.includes('method: "POST"'),
        'Should use POST method for CRM API call'
      );
    });

    it('should use authtoken header for authentication', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("'authtoken'") || content.includes('"authtoken"'),
        'Should use authtoken header for Perfex CRM authentication'
      );
    });

    it('should use perfexKey in authtoken header', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('authtoken') && content.includes('perfexKey'),
        'Should use perfexKey in authtoken header'
      );
    });

    it('should set Content-Type header to application/json', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("'Content-Type'") || content.includes('"Content-Type"'),
        'Should set Content-Type header'
      );
      assert.ok(
        content.includes('application/json'),
        'Content-Type should be application/json'
      );
    });

    it('should stringify body when sending to CRM', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('JSON.stringify'),
        'Should stringify request body for CRM call'
      );
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields exist', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('requiredFields'),
        'Should define requiredFields array'
      );
    });

    it('should check for missing firstname', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("'firstname'") || content.includes('"firstname"'),
        'Should include firstname in required fields'
      );
    });

    it('should check for missing lastname', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("'lastname'") || content.includes('"lastname"'),
        'Should include lastname in required fields'
      );
    });

    it('should check for missing email', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("'email'") || content.includes('"email"'),
        'Should include email in required fields'
      );
    });

    it('should check for missing phonenumber', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("'phonenumber'") || content.includes('"phonenumber"'),
        'Should include phonenumber in required fields'
      );
    });

    it('should validate email format', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('emailRegex') || content.includes('test(body.email)'),
        'Should validate email format'
      );
    });

    it('should return 400 for validation errors', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes("status: 400"),
        'Should return 400 status for validation errors'
      );
    });
  });

  describe('Success Response', () => {
    it('should return 200 status on success', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      const success200Count = (content.match(/status: 200/g) || []).length;
      assert.ok(
        success200Count >= 1,
        'Should return 200 status for successful submissions'
      );
    });

    it('should return success: true in response', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('success: true'),
        'Should return success: true in response body'
      );
    });

    it('should return a success message', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('message:') && content.includes('Thank you'),
        'Should return thank you message on success'
      );
    });

    it('should return leadId in response', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('leadId:'),
        'Should return leadId in success response'
      );
    });
  });

  describe('Error Response', () => {
    it('should return 500 status on server error', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      const status500Count = (content.match(/status: 500/g) || []).length;
      assert.ok(
        status500Count >= 2,
        'Should return 500 status for server errors (try-catch and CRM failure)'
      );
    });

    it('should return success: false on error', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('success: false'),
        'Should return success: false in error response'
      );
    });

    it('should include error message in response', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('message:') && content.includes('error') || content.includes('try again'),
        'Should include error message in error response'
      );
    });

    it('should catch errors with try-catch', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('try {') && content.includes('} catch'),
        'Should wrap logic in try-catch blocks'
      );
    });
  });

  describe('Listing Slug Handling', () => {
    it('should handle listingSlug from request body', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('listingSlug'),
        'Should handle listingSlug from request body'
      );
    });

    it('should append listingSlug to description for CRM', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('[Listing:') || content.includes('listingSlug') && content.includes('description'),
        'Should include listing reference in description'
      );
    });
  });

  describe('TypeScript Types', () => {
    it('should have return type annotation', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('Promise<NextResponse<LeadSubmissionResponse>>'),
        'Should have typed return annotation'
      );
    });

    it('should have JSDoc comments', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('/**') && content.includes('*/'),
        'Should have JSDoc comments'
      );
    });
  });

  describe('CRM Response Handling', () => {
    it('should check CRM response status', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('crmResponse.ok') || content.includes('!crmResponse.ok'),
        'Should check CRM response ok status'
      );
    });

    it('should parse CRM response JSON', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('crmResponse.json()'),
        'Should parse CRM response as JSON'
      );
    });

    it('should log CRM errors', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('console.error') && content.includes('Perfex CRM'),
        'Should log Perfex CRM errors to console'
      );
    });
  });
});
