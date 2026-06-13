/**
 * RegisterForm Component
 *
 * Client-side agent registration form. Implements the full registration flow:
 * createUserWithEmailAndPassword -> sendEmailVerification -> redirect to
 * /check-email. The session cookie is minted at /login after verification
 * (WR-06: no session is created for an unverified account).
 *
 * Per RESEARCH Pattern 3 and UI-SPEC /register spec:
 * - Instant onChange validation (email format, password >= 8 chars, passwords match)
 * - Submit disabled while form has errors or is submitting
 * - Button shows "Please wait..." while submitting
 * - Firebase errors mapped via firebaseErrorMessage -> ErrorBanner
 * - 44px touch targets, label htmlFor/id pairing, aria-describedby for errors
 *
 * @module components/auth/RegisterForm
 */

'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase-client';
import { firebaseErrorMessage } from '@/lib/firebase-errors';
import { ErrorBanner } from '@/components/auth/ErrorBanner';

/** Email validation regex (RFC-aligned, permissive) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * RegisterForm component state
 */
interface RegisterFormState {
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Per-field validation errors
 */
interface RegisterFormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * RegisterForm — agent registration form.
 *
 * Client component. Handles the full registration + verification email
 * + session-cookie exchange flow.
 *
 * @returns {JSX.Element} Registration form
 */
export function RegisterForm(): JSX.Element {
  const router = useRouter();

  const [fields, setFields] = useState<RegisterFormState>({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate a single field and return the error (if any).
   */
  function validateField(name: keyof RegisterFormState, value: string): string {
    if (name === 'email') {
      if (!value.trim()) return 'Email is required.';
      if (!isValidEmail(value)) return 'Enter a valid email address.';
    }
    if (name === 'password') {
      if (!value) return 'Password is required.';
      if (value.length < 8) return 'Password must be at least 8 characters.';
    }
    if (name === 'confirmPassword') {
      if (!value) return 'Please confirm your password.';
      if (value !== fields.password) return 'Passwords do not match.';
    }
    return '';
  }

  /**
   * Handle field changes with instant validation.
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    setServerError('');

    // Instant validation on change
    const error = validateField(name as keyof RegisterFormState, value);
    setErrors(prev => ({ ...prev, [name]: error || undefined }));

    // Re-validate confirmPassword when password changes
    if (name === 'password' && fields.confirmPassword) {
      const confirmError =
        fields.confirmPassword !== value ? 'Passwords do not match.' : '';
      setErrors(prev => ({
        ...prev,
        confirmPassword: confirmError || undefined,
      }));
    }
  }

  /**
   * Validate all fields and return whether the form is valid.
   */
  function validateAll(): boolean {
    const newErrors: RegisterFormErrors = {
      email: validateField('email', fields.email) || undefined,
      password: validateField('password', fields.password) || undefined,
      confirmPassword:
        validateField('confirmPassword', fields.confirmPassword) || undefined,
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  }

  /**
   * Whether submit should be disabled.
   */
  function isDisabled(): boolean {
    if (isSubmitting) return true;
    if (Object.values(errors).some(Boolean)) return true;
    return false;
  }

  /**
   * Handle registration form submission.
   * Flow: createUser -> sendEmailVerification -> /check-email
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setServerError('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      // 1. Create Firebase user
      const { user } = await createUserWithEmailAndPassword(
        auth,
        fields.email.trim(),
        fields.password
      );

      // 2. Send verification email
      await sendEmailVerification(user);

      // 3. Redirect to check-email confirmation page.
      // WR-06: do NOT mint a session cookie here — the account is unverified,
      // so the session route would reject it (403). The cookie is minted at
      // /login after the user verifies. Firing a request whose result is
      // discarded hid that contradiction and risked minting a session for an
      // unverified user if the route ever relaxed.
      router.push('/check-email');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Server error banner */}
      <ErrorBanner message={serverError} />

      {/* Email field */}
      <div>
        <label
          htmlFor="reg-email"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Email address
        </label>
        <input
          type="email"
          id="reg-email"
          name="email"
          value={fields.email}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="email"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="true"
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'reg-email-error' : undefined}
          placeholder="you@example.com"
        />
        {errors.email && (
          <p id="reg-email-error" className="mt-1 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password field */}
      <div>
        <label
          htmlFor="reg-password"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Password
        </label>
        <input
          type="password"
          id="reg-password"
          name="password"
          value={fields.password}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="new-password"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="true"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'reg-password-error' : 'reg-password-hint'}
          placeholder="Minimum 8 characters"
        />
        {errors.password ? (
          <p id="reg-password-error" className="mt-1 text-sm text-red-600">
            {errors.password}
          </p>
        ) : (
          <p id="reg-password-hint" className="mt-1 text-sm text-gray-400">
            Must be at least 8 characters
          </p>
        )}
      </div>

      {/* Confirm Password field */}
      <div>
        <label
          htmlFor="reg-confirm-password"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Confirm password
        </label>
        <input
          type="password"
          id="reg-confirm-password"
          name="confirmPassword"
          value={fields.confirmPassword}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="new-password"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="true"
          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
          aria-describedby={
            errors.confirmPassword ? 'reg-confirm-error' : undefined
          }
          placeholder="Re-enter your password"
        />
        {errors.confirmPassword && (
          <p id="reg-confirm-error" className="mt-1 text-sm text-red-600">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isDisabled()}
        aria-disabled={isDisabled()}
        className={`btn-accent touch-target w-full ${
          isDisabled() ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? 'Please wait...' : 'Create account'}
      </button>

      {/* Terms note */}
      <p className="text-xs text-gray-400 text-center">
        By registering, you agree to our Terms of Service.
      </p>
    </form>
  );
}

export default RegisterForm;
