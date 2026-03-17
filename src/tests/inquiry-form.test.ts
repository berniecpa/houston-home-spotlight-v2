/**
 * InquiryForm Component Tests - US-012
 * 
 * Tests verify that:
 * 1. Form file exists and exports InquiryForm component
 * 2. Form has all required inputs (firstname, lastname, email, phonenumber, description)
 * 3. All fields except description are required
 * 4. Email validation checks for valid format
 * 5. Form shows loading state during submission
 * 6. Success message displays on successful submission
 * 7. Error message displays on submission failure
 * 8. Form has proper accessibility attributes
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENT_PATH = join(process.cwd(), 'src/components/InquiryForm.tsx');

describe('InquiryForm Component - US-012', () => {
  describe('File Structure', () => {
    it('should have InquiryForm.tsx in src/components/', () => {
      assert.strictEqual(existsSync(COMPONENT_PATH), true, 'InquiryForm.tsx should exist');
    });

    it('should export InquiryForm function', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('export function InquiryForm'),
        'Should export InquiryForm function'
      );
    });

    it('should export default InquiryForm', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('export default InquiryForm'),
        'Should have default export'
      );
    });
  });

  describe('Form Fields', () => {
    it('should have firstname input', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('id="firstname"') && content.includes('name="firstname"'),
        'Should have firstname input with id and name'
      );
      assert.ok(
        content.includes('type="text"'),
        'Firstname should be text input'
      );
    });

    it('should have lastname input', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('id="lastname"') && content.includes('name="lastname"'),
        'Should have lastname input with id and name'
      );
      assert.ok(
        content.includes('type="text"'),
        'Lastname should be text input'
      );
    });

    it('should have email input', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('id="email"') && content.includes('name="email"'),
        'Should have email input with id and name'
      );
      assert.ok(
        content.includes('type="email"'),
        'Email should be email input type'
      );
    });

    it('should have phonenumber input', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('id="phonenumber"') && content.includes('name="phonenumber"'),
        'Should have phonenumber input with id and name'
      );
      assert.ok(
        content.includes('type="tel"'),
        'Phonenumber should be tel input type'
      );
    });

    it('should have description textarea', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('id="description"') && content.includes('name="description"'),
        'Should have description textarea with id and name'
      );
      assert.ok(
        content.includes('<textarea'),
        'Description should be textarea element'
      );
    });

    it('should have hidden listingSlug field', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('type="hidden"') && content.includes('listingSlug'),
        'Should have hidden listingSlug field'
      );
    });
  });

  describe('Required Fields', () => {
    it('should mark firstname as required', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('First Name') && content.includes('text-red-500'),
        'Firstname should be marked as required'
      );
      assert.ok(
        content.includes('aria-required="true"') && content.includes('id="firstname"'),
        'Firstname should have aria-required="true"'
      );
    });

    it('should mark lastname as required', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('Last Name') && content.includes('text-red-500'),
        'Lastname should be marked as required'
      );
      assert.ok(
        content.includes('aria-required="true"') && content.includes('id="lastname"'),
        'Lastname should have aria-required="true"'
      );
    });

    it('should mark email as required', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('Email Address') && content.includes('text-red-500'),
        'Email should be marked as required'
      );
      assert.ok(
        content.includes('aria-required="true"') && content.includes('id="email"'),
        'Email should have aria-required="true"'
      );
    });

    it('should mark phonenumber as required', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('Phone Number') && content.includes('text-red-500'),
        'Phonenumber should be marked as required'
      );
      assert.ok(
        content.includes('aria-required="true"') && content.includes('id="phonenumber"'),
        'Phonenumber should have aria-required="true"'
      );
    });

    it('should mark description as optional', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('(optional)'),
        'Description should be marked as optional'
      );
      assert.ok(
        content.includes('aria-required="false"') && content.includes('id="description"'),
        'Description should have aria-required="false"'
      );
    });
  });

  describe('Validation', () => {
    it('should have email validation function', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('function isValidEmail'),
        'Should have isValidEmail validation function'
      );
      assert.ok(
        content.includes('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/') || 
        content.includes('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/'),
        'Email validation should use proper regex'
      );
    });

    it('should have phone validation function', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('function isValidPhone'),
        'Should have isValidPhone validation function'
      );
    });

    it('should have validateForm function', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('const validateForm') || content.includes('function validateForm'),
        'Should have validateForm function'
      );
    });

    it('should validate email format', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('isValidEmail(formData.email)') || 
        content.includes('isValidEmail(email)'),
        'Should validate email format in validateForm'
      );
    });

    it('should validate phone format', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('isValidPhone(formData.phonenumber)') ||
        content.includes('isValidPhone(phone)'),
        'Should validate phone format in validateForm'
      );
    });

    it('should check required fields are not empty', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('!formData.firstname.trim()'),
        'Should check firstname is not empty'
      );
      assert.ok(
        content.includes('!formData.lastname.trim()'),
        'Should check lastname is not empty'
      );
      assert.ok(
        content.includes('!formData.email.trim()'),
        'Should check email is not empty'
      );
      assert.ok(
        content.includes('!formData.phonenumber.trim()'),
        'Should check phonenumber is not empty'
      );
    });
  });

  describe('Loading State', () => {
    it('should have loading state type', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'"),
        'Should define SubmitStatus type with loading state'
      );
    });

    it('should disable inputs during loading', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("disabled={status === 'loading'}"),
        'Should disable inputs when status is loading'
      );
    });

    it('should show loading spinner in button', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("animate-spin") && content.includes('status ==='),
        'Should show animated spinner during loading'
      );
      assert.ok(
        content.includes("Submitting..."),
        'Should show "Submitting..." text during loading'
      );
    });
  });

  describe('Success Message', () => {
    it('should display success message on successful submission', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("status === 'success'") && content.includes('bg-green-50'),
        'Should display green success alert when status is success'
      );
      assert.ok(
        content.includes("role=\"alert\"") && content.includes('aria-live'),
        'Success message should have alert role and aria-live'
      );
    });

    it('should show checkmark icon for success', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('text-green-600') && content.includes('bg-green-50'),
        'Success message should have green styling'
      );
    });

    it('should have dismiss button for success message', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('Dismiss success message'),
        'Should have dismiss button with proper aria-label'
      );
    });
  });

  describe('Error Message', () => {
    it('should display error message on submission failure', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("status === 'error'") && content.includes('bg-red-50'),
        'Should display red error alert when status is error'
      );
      assert.ok(
        content.includes("aria-live=\"assertive\""),
        'Error message should have aria-live="assertive"'
      );
    });

    it('should show error icon for error', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('text-red-600') && content.includes('bg-red-50'),
        'Error message should have red styling'
      );
    });

    it('should have dismiss button for error message', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('Dismiss error message'),
        'Should have dismiss button with proper aria-label'
      );
    });
  });

  describe('Form Submission', () => {
    it('should have handleSubmit function', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('const handleSubmit') || content.includes('function handleSubmit'),
        'Should have handleSubmit function'
      );
      assert.ok(
        content.includes('e.preventDefault()'),
        'Should prevent default form submission'
      );
    });

    it('should post to /api/leads endpoint', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("fetch('/api/leads'"),
        'Should POST to /api/leads endpoint'
      );
      assert.ok(
        content.includes("method: 'POST'"),
        'Should use POST method'
      );
    });

    it('should send JSON body with form data', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('Content-Type') && content.includes('application/json'),
        'Should set Content-Type header to application/json'
      );
      assert.ok(
        content.includes('JSON.stringify'),
        'Should stringify form data'
      );
    });

    it('should reset form after successful submission', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('...initialFormState'),
        'Should reset form to initial state after success'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper label associations', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('htmlFor="firstname"'),
        'Firstname label should have htmlFor'
      );
      assert.ok(
        content.includes('htmlFor="lastname"'),
        'Lastname label should have htmlFor'
      );
      assert.ok(
        content.includes('htmlFor="email"'),
        'Email label should have htmlFor'
      );
      assert.ok(
        content.includes('htmlFor="phonenumber"'),
        'Phonenumber label should have htmlFor'
      );
      assert.ok(
        content.includes('htmlFor="description"'),
        'Description label should have htmlFor'
      );
    });

    it('should have aria-invalid for error states', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('aria-invalid={errors.firstname'),
        'Firstname should have aria-invalid based on errors'
      );
      assert.ok(
        content.includes('aria-invalid={errors.lastname'),
        'Lastname should have aria-invalid based on errors'
      );
      assert.ok(
        content.includes('aria-invalid={errors.email'),
        'Email should have aria-invalid based on errors'
      );
      assert.ok(
        content.includes('aria-invalid={errors.phonenumber'),
        'Phonenumber should have aria-invalid based on errors'
      );
    });

    it('should have aria-describedby for error messages', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('aria-describedby={errors.firstname'),
        'Firstname should have aria-describedby for errors'
      );
    });

    it('should have error message elements with ids', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('id="firstname-error"'),
        'Should have firstname error message element'
      );
      assert.ok(
        content.includes('id="lastname-error"'),
        'Should have lastname error message element'
      );
      assert.ok(
        content.includes('id="email-error"'),
        'Should have email error message element'
      );
      assert.ok(
        content.includes('id="phonenumber-error"'),
        'Should have phonenumber error message element'
      );
    });

    it('should have aria-label for submit button', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('aria-label={status') || 
        content.includes("aria-label='Submit inquiry'"),
        'Submit button should have aria-label'
      );
    });
  });

  describe('Props Interface', () => {
    it('should define InquiryFormProps interface', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('interface InquiryFormProps'),
        'Should define InquiryFormProps interface'
      );
    });

    it('should accept optional listingSlug prop', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('listingSlug?: string'),
        'Should accept optional listingSlug prop'
      );
    });

    it('should accept optional onSuccess callback', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('onSuccess?: () => void') || 
        content.includes('onSuccess?:'),
        'Should accept optional onSuccess callback'
      );
    });
  });

  describe('Styling', () => {
    it('should use primary color for submit button', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('bg-primary-600'),
        'Submit button should use primary-600 background'
      );
    });

    it('should have responsive grid layout for name fields', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('sm:grid-cols-2'),
        'Name fields should be responsive grid'
      );
    });

    it('should have focus styles for inputs', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes('focus:ring-2') && content.includes('focus:ring-primary-500'),
        'Inputs should have primary focus ring'
      );
    });
  });

  describe('TypeScript Types', () => {
    it('should import LeadFormData type', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("import { LeadFormData"),
        'Should import LeadFormData type'
      );
    });

    it('should import LeadSubmissionResponse type', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes("import { LeadFormData, LeadSubmissionResponse }"),
        'Should import LeadSubmissionResponse type'
      );
    });

    it('should use JSX.Element return type', () => {
      const content = readFileSync(COMPONENT_PATH, 'utf-8');
      assert.ok(
        content.includes(': JSX.Element'),
        'Component should have JSX.Element return type'
      );
    });
  });
});
