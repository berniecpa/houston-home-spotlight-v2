/**
 * Check Email Page
 *
 * Email verification confirmation page shown after agent registration.
 * Provides a resend button with 3-second "Email sent!" transient feedback.
 *
 * Per UI-SPEC /check-email spec:
 * - Title: "Check your inbox"
 * - Body references the email used to register
 * - "Resend email" .btn-primary button
 * - After resend: button text changes to "Email sent!" for 3s, then reverts
 * - Footer: "Wrong email? Register again" link
 *
 * @module app/(auth)/check-email/page
 */

'use client';

import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { AuthCard } from '@/components/auth/AuthCard';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import Link from 'next/link';

/**
 * CheckEmailPage — email verification confirmation page.
 *
 * Client component (resend button requires Firebase client SDK).
 *
 * @returns {JSX.Element} Check email page
 */
export default function CheckEmailPage(): JSX.Element {
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  /** Current user's email for display */
  const userEmail = auth.currentUser?.email ?? 'your email address';

  /**
   * Resend the email verification link.
   * Shows "Email sent!" for 3 seconds, then reverts to "Resend email".
   */
  async function handleResend(): Promise<void> {
    setErrorMessage('');

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage('Could not find your session. Please register again.');
      return;
    }

    try {
      await sendEmailVerification(user);
      setResendStatus('sent');

      // Revert after 3 seconds
      setTimeout(() => {
        setResendStatus('idle');
      }, 3000);
    } catch {
      setErrorMessage('Failed to resend. Please try again in a moment.');
      setResendStatus('idle');
    }
  }

  return (
    <AuthCard title="Check your inbox">
      <div className="space-y-5">
        <ErrorBanner message={errorMessage} />

        {/* Body copy */}
        <p className="text-base text-gray-600 leading-relaxed">
          We sent a verification link to{' '}
          <span className="font-medium text-primary-900">{userEmail}</span>.
          Click the link to activate your account.
        </p>

        <p className="text-sm text-gray-500">
          It may take a few minutes. Check your spam folder if you don&apos;t see it.
        </p>

        {/* Resend button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendStatus === 'sent'}
          aria-disabled={resendStatus === 'sent'}
          className={`btn-primary touch-target w-full ${
            resendStatus === 'sent' ? 'opacity-75' : ''
          }`}
        >
          {resendStatus === 'sent' ? 'Email sent!' : 'Resend email'}
        </button>

        {/* Footer link */}
        <p className="text-sm text-gray-500 text-center">
          Wrong email?{' '}
          <Link href="/register" className="text-primary-600 hover:underline">
            Register again
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
