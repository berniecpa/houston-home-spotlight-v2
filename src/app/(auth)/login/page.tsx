/**
 * Login Page
 *
 * Agent login page. Renders LoginForm in an AuthCard centered standalone card.
 * Passes the ?redirect query param through via Suspense/useSearchParams in LoginForm.
 *
 * Per UI-SPEC /login spec:
 * - Title: "Welcome back"
 * - Subtitle: "New agent? Create an account"
 * - LoginForm reads ?redirect for redirect preservation
 *
 * @module app/(auth)/login/page
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Log In | Houston Home Spotlight',
  description: 'Log in to your Houston Home Spotlight agent account.',
};

/**
 * LoginPage — agent login page.
 *
 * Wraps LoginForm (which uses useSearchParams) in a Suspense boundary
 * as required by Next.js App Router for client components using useSearchParams.
 *
 * @returns {JSX.Element} Login page
 */
export default function LoginPage(): JSX.Element {
  return (
    <AuthCard
      title="Welcome back"
      subtitle={
        <>
          New agent?{' '}
          <Link href="/register" className="text-primary-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {/* Suspense required for useSearchParams in LoginForm */}
      <Suspense fallback={<div className="h-48" aria-label="Loading login form" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
