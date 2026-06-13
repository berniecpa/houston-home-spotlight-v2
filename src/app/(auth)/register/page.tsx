/**
 * Register Page
 *
 * Agent registration page. Renders the RegisterForm in an AuthCard
 * centered standalone card (no public Header/Footer).
 *
 * Per UI-SPEC /register spec:
 * - Title: "Create your account"
 * - Subtitle: "Already have an account? Log in"
 * - AuthCard max-w-md centered
 *
 * @module app/(auth)/register/page
 */

import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Create Your Account | Houston Home Spotlight',
  description: 'Register as a licensed agent to publish listings on Houston Home Spotlight.',
};

/**
 * RegisterPage — agent registration page.
 *
 * Server component wrapper that renders RegisterForm in AuthCard.
 *
 * @returns {JSX.Element} Registration page
 */
export default function RegisterPage(): JSX.Element {
  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
