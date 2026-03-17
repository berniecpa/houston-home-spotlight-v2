/**
 * InquiryForm Component
 * 
 * A lead inquiry form for property listings.
 * Submits lead data to the API which forwards to Perfex CRM.
 * 
 * Features:
 * - Client-side validation for required fields
 * - Email format validation
 * - Loading state during submission
 * - Success/error message display
 * - Mobile-first responsive design
 * - Accessible form inputs with proper labels
 * 
 * @module components/InquiryForm
 */

'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { LeadFormData, LeadSubmissionResponse } from '@/types';

/**
 * Props for the InquiryForm component
 */
interface InquiryFormProps {
  /** The slug of the listing being inquired about (optional for general inquiries) */
  listingSlug?: string;
  /** Optional callback called after successful submission */
  onSuccess?: () => void;
}

/**
 * Form submission status
 */
type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Initial form state
 */
const initialFormState: LeadFormData = {
  firstname: '',
  lastname: '',
  email: '',
  phonenumber: '',
  description: '',
  listingSlug: ''
};

/**
 * Validation error type
 */
type FormErrors = Partial<Record<keyof LeadFormData, string>>;

/**
 * Validate email format
 * @param email - Email to validate
 * @returns Whether the email is valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (basic US format)
 * @param phone - Phone number to validate
 * @returns Whether the phone number is valid
 */
function isValidPhone(phone: string): boolean {
  // Allow various formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
  const phoneRegex = /^[\d\s\-\.\(\)\+]{10,}$/;
  const digitsOnly = phone.replace(/\D/g, '');
  return phoneRegex.test(phone) && digitsOnly.length >= 10;
}

/**
 * InquiryForm component - Lead submission form for property inquiries
 * 
 * @param {InquiryFormProps} props - Component props
 * @returns {JSX.Element} The inquiry form
 */
export function InquiryForm({ listingSlug, onSuccess }: InquiryFormProps): JSX.Element {
  const [formData, setFormData] = useState<LeadFormData>({
    ...initialFormState,
    listingSlug: listingSlug || ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  /**
   * Handle input changes
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof LeadFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  /**
   * Validate form data
   * @returns Whether the form is valid
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate required fields (all except description)
    if (!formData.firstname.trim()) {
      newErrors.firstname = 'First name is required';
    }

    if (!formData.lastname.trim()) {
      newErrors.lastname = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phonenumber.trim()) {
      newErrors.phonenumber = 'Phone number is required';
    } else if (!isValidPhone(formData.phonenumber)) {
      newErrors.phonenumber = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Reset status
    setStatus('idle');
    setStatusMessage('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Set loading state
    setStatus('loading');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result: LeadSubmissionResponse = await response.json();

      if (result.success) {
        setStatus('success');
        setStatusMessage(result.message);
        
        // Reset form
        setFormData({
          ...initialFormState,
          listingSlug: listingSlug || ''
        });

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setStatus('error');
        setStatusMessage(result.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Failed to submit. Please check your connection and try again.');
      console.error('Form submission error:', error);
    }
  };

  /**
   * Clear status message
   */
  const clearStatus = (): void => {
    setStatus('idle');
    setStatusMessage('');
  };

  return (
    <div className="w-full">
      {/* Status Messages */}
      {status === 'success' && (
        <div 
          className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <svg 
              className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div className="flex-1">
              <p className="text-green-800 font-medium">{statusMessage}</p>
            </div>
            <button
              onClick={clearStatus}
              className="text-green-600 hover:text-green-800 p-1"
              aria-label="Dismiss success message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div 
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <svg 
              className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div className="flex-1">
              <p className="text-red-800 font-medium">{statusMessage}</p>
            </div>
            <button
              onClick={clearStatus}
              className="text-red-600 hover:text-red-800 p-1"
              aria-label="Dismiss error message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Hidden listingSlug field */}
        <input
          type="hidden"
          name="listingSlug"
          value={formData.listingSlug}
        />

        {/* Name Row - First and Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label 
              htmlFor="firstname" 
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              First Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id="firstname"
              name="firstname"
              value={formData.firstname}
              onChange={handleChange}
              disabled={status === 'loading'}
              className={`
                w-full px-4 py-2.5 rounded-lg border
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:bg-gray-100 disabled:cursor-not-allowed
                transition-colors duration-200
                ${errors.firstname 
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300'
                }
              `}
              placeholder="John"
              aria-required="true"
              aria-invalid={errors.firstname ? 'true' : 'false'}
              aria-describedby={errors.firstname ? 'firstname-error' : undefined}
            />
            {errors.firstname && (
              <p id="firstname-error" className="mt-1.5 text-sm text-red-600">
                {errors.firstname}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label 
              htmlFor="lastname" 
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Last Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id="lastname"
              name="lastname"
              value={formData.lastname}
              onChange={handleChange}
              disabled={status === 'loading'}
              className={`
                w-full px-4 py-2.5 rounded-lg border
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:bg-gray-100 disabled:cursor-not-allowed
                transition-colors duration-200
                ${errors.lastname 
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300'
                }
              `}
              placeholder="Doe"
              aria-required="true"
              aria-invalid={errors.lastname ? 'true' : 'false'}
              aria-describedby={errors.lastname ? 'lastname-error' : undefined}
            />
            {errors.lastname && (
              <p id="lastname-error" className="mt-1.5 text-sm text-red-600">
                {errors.lastname}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label 
            htmlFor="email" 
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Email Address <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={status === 'loading'}
            className={`
              w-full px-4 py-2.5 rounded-lg border
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              transition-colors duration-200
              ${errors.email 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-300'
              }
            `}
            placeholder="john.doe@example.com"
            aria-required="true"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-sm text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <label 
            htmlFor="phonenumber" 
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Phone Number <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            type="tel"
            id="phonenumber"
            name="phonenumber"
            value={formData.phonenumber}
            onChange={handleChange}
            disabled={status === 'loading'}
            className={`
              w-full px-4 py-2.5 rounded-lg border
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              transition-colors duration-200
              ${errors.phonenumber 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-300'
              }
            `}
            placeholder="(713) 555-1234"
            aria-required="true"
            aria-invalid={errors.phonenumber ? 'true' : 'false'}
            aria-describedby={errors.phonenumber ? 'phonenumber-error' : undefined}
          />
          {errors.phonenumber && (
            <p id="phonenumber-error" className="mt-1.5 text-sm text-red-600">
              {errors.phonenumber}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label 
            htmlFor="description" 
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Message <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            disabled={status === 'loading'}
            rows={4}
            className="
              w-full px-4 py-2.5 rounded-lg border border-gray-300
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              transition-colors duration-200
              resize-none
            "
            placeholder="Tell us more about what you're looking for..."
            aria-required="false"
          />
        </div>

        {/* Required Fields Note */}
        <p className="text-sm text-gray-500">
          <span className="text-red-500" aria-hidden="true">*</span> Required fields
        </p>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="
            w-full py-3 px-6 rounded-lg font-semibold text-white
            bg-primary-600 hover:bg-primary-700 
            focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            disabled:bg-gray-400 disabled:cursor-not-allowed
            transition-all duration-200
            flex items-center justify-center gap-2
          "
          aria-label={status === 'loading' ? 'Submitting inquiry' : 'Submit inquiry'}
        >
          {status === 'loading' ? (
            <>
              <svg 
                className="animate-spin h-5 w-5" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Send Inquiry</span>
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M14 5l7 7m0 0l-7 7m7-7H3" 
                />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default InquiryForm;
