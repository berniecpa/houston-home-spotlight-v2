/**
 * ResetPasswordForm Component
 *
 * Client-side password reset request form. Uses Firebase built-in
 * sendPasswordResetEmail — does not hand-roll tokens (RESEARCH Don't Hand-Roll).
 *
 * Per UI-SPEC /reset-password spec:
 * - Single Email field with instant validation
 * - CTA "Send reset link" .btn-primary
 * - On success: form replaced with inline message (no navigation)
 * - "Back to login" link below CTA
 *
 * @module components/auth/ResetPasswordForm
 */

'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { firebaseErrorMessage } from '@/lib/firebase-errors';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import Link from 'next/link';

/** Email validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * ResetPasswordForm — password reset request form.
 *
 * Client component. On success, replaces the form with an inline success
 * message; does not navigate away (UI-SPEC requirement).
 *
 * @returns {JSX.Element} Password reset form or success message
 */
export function ResetPasswordForm(): JSX.Element {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Handle email field change with instant validation.
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value;
    setEmail(value);
    setServerError('');

    if (!value.trim()) {
      setEmailError('Email is required.');
    } else if (!isValidEmail(value)) {
      setEmailError('Enter a valid email address.');
    } else {
      setEmailError('');
    }
  }

  /**
   * Whether submit should be disabled.
   */
  function isDisabled(): boolean {
    if (isSubmitting) return true;
    if (emailError) return true;
    return false;
  }

  /**
   * Handle form submission — calls sendPasswordResetEmail.
   * On success: shows inline confirmation (no navigation per UI-SPEC).
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setServerError('');

    // Validate before submitting
    if (!email.trim()) {
      setEmailError('Email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // sendPasswordResetEmail is a Firebase built-in flow (RESEARCH: Don't Hand-Roll)
      await sendPasswordResetEmail(auth, email.trim());
      setSubmitted(true);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      setServerError(firebaseErrorMessage(code));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Success state — inline message replaces form (no navigation per UI-SPEC)
  if (submitted) {
    return (
      <div className="space-y-4">
        <div
          className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium">
            Check your inbox &mdash; a reset link is on its way.
          </p>
        </div>
        <p className="text-sm text-center">
          <Link href="/login" className="text-primary-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Server error banner */}
      <ErrorBanner message={serverError} />

      {/* Email field */}
      <div>
        <label
          htmlFor="reset-email"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Email address
        </label>
        <input
          type="email"
          id="reset-email"
          name="email"
          value={email}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="email"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${emailError ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="true"
          aria-invalid={emailError ? 'true' : 'false'}
          aria-describedby={emailError ? 'reset-email-error' : undefined}
          placeholder="you@example.com"
        />
        {emailError && (
          <p id="reset-email-error" className="mt-1 text-sm text-red-600">
            {emailError}
          </p>
        )}
      </div>

      {/* Submit CTA */}
      <button
        type="submit"
        disabled={isDisabled()}
        aria-disabled={isDisabled()}
        className={`btn-primary touch-target w-full ${
          isDisabled() ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? 'Please wait...' : 'Send reset link'}
      </button>

      {/* Back to login */}
      <p className="text-sm text-center">
        <Link href="/login" className="text-primary-600 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}

export default ResetPasswordForm;
