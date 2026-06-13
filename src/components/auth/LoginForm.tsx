/**
 * LoginForm Component
 *
 * Client-side agent login form. Implements the full login + session flow:
 * signInWithEmailAndPassword -> getIdToken -> POST /api/auth/session -> redirect.
 *
 * Per UI-SPEC /login spec and RESEARCH Pattern 3:
 * - Email / Password instant validation + ErrorBanner for Firebase rejections
 * - "Forgot password?" link right-aligned to /reset-password
 * - Reads ?redirect param via useSearchParams; redirects to /dashboard on success
 * - The session route already gates on email_verified: unverified login is rejected
 *   server-side — surfaces that as an ErrorBanner directing user to verify
 * - 44px touch targets, label htmlFor/id, aria-describedby for errors
 *
 * @module components/auth/LoginForm
 */

'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
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
 * LoginForm field state
 */
interface LoginFormState {
  email: string;
  password: string;
}

/**
 * Per-field validation errors
 */
interface LoginFormErrors {
  email?: string;
  password?: string;
}

/**
 * LoginForm — agent login form with session cookie exchange.
 *
 * Client component. Reads the ?redirect query param via useSearchParams
 * to support redirect preservation (UI-SPEC Redirect Preservation contract).
 *
 * @returns {JSX.Element} Login form
 */
export function LoginForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fields, setFields] = useState<LoginFormState>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate a single field and return the error (if any).
   */
  function validateField(name: keyof LoginFormState, value: string): string {
    if (name === 'email') {
      if (!value.trim()) return 'Email is required.';
      if (!isValidEmail(value)) return 'Enter a valid email address.';
    }
    if (name === 'password') {
      if (!value) return 'Password is required.';
      if (value.length < 8) return 'Password must be at least 8 characters.';
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

    const error = validateField(name as keyof LoginFormState, value);
    setErrors(prev => ({ ...prev, [name]: error || undefined }));
  }

  /**
   * Validate all fields; return true if valid.
   */
  function validateAll(): boolean {
    const newErrors: LoginFormErrors = {
      email: validateField('email', fields.email) || undefined,
      password: validateField('password', fields.password) || undefined,
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
   * Handle login form submission.
   * Flow: signIn -> getIdToken -> POST /api/auth/session -> redirect
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setServerError('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      // 1. Sign in with Firebase client SDK
      const { user } = await signInWithEmailAndPassword(
        auth,
        fields.email.trim(),
        fields.password
      );

      // 2. Exchange ID token for HttpOnly session cookie
      const idToken = await user.getIdToken();
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) {
        // Session route rejected the token (likely email_verified === false).
        // WR-02: sign the Firebase client out so the SDK does not retain an
        // authenticated session for an account the server refused to mint a
        // cookie for (keeps client and server auth state consistent).
        await signOut(auth);
        const body = await sessionRes.json() as { message?: string };
        if (sessionRes.status === 403) {
          setServerError(
            'Your email address has not been verified. Please check your inbox and click the verification link.'
          );
        } else {
          setServerError(body.message ?? 'Authentication failed. Please try again.');
        }
        return;
      }

      // 3. Redirect to ?redirect or /dashboard (UI-SPEC Redirect Preservation)
      const redirectTo = searchParams.get('redirect') ?? '/dashboard';
      router.push(redirectTo);
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
          htmlFor="login-email"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Email address
        </label>
        <input
          type="email"
          id="login-email"
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
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          placeholder="you@example.com"
        />
        {errors.email && (
          <p id="login-email-error" className="mt-1 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password field */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="login-password"
            className="block text-sm font-semibold text-gray-700"
          >
            Password
          </label>
          <Link
            href="/reset-password"
            className="text-sm text-primary-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <input
          type="password"
          id="login-password"
          name="password"
          value={fields.password}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="current-password"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="true"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          placeholder="Your password"
        />
        {errors.password && (
          <p id="login-password-error" className="mt-1 text-sm text-red-600">
            {errors.password}
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
        {isSubmitting ? 'Please wait...' : 'Log in'}
      </button>
    </form>
  );
}

export default LoginForm;
