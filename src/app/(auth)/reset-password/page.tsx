/**
 * Reset Password Page
 *
 * Password reset request page. Renders ResetPasswordForm in an AuthCard.
 * On success, ResetPasswordForm replaces itself with an inline message
 * (no navigation — per UI-SPEC).
 *
 * Per UI-SPEC /reset-password spec:
 * - Title: "Reset your password"
 * - Subtitle: "Enter your email and we'll send a reset link."
 *
 * @module app/(auth)/reset-password/page
 */

import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset Password | Houston Home Spotlight',
  description: 'Request a password reset link for your Houston Home Spotlight account.',
};

/**
 * ResetPasswordPage — password reset request page.
 *
 * @returns {JSX.Element} Reset password page
 */
export default function ResetPasswordPage(): JSX.Element {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
