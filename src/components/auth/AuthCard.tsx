/**
 * AuthCard Component
 *
 * Centered card shell for all auth pages (register, login, reset-password, check-email).
 * Renders a standalone centered .card with site name branding — no public Header/Footer.
 *
 * Per UI-SPEC Auth Layout contract:
 * - max-w-md, p-8, mx-auto
 * - Site name in primary-900 at top
 * - 24px Merriweather semibold title
 * - Optional subtitle slot
 * - Children slot for form content
 *
 * @module components/auth/AuthCard
 */

import React from 'react';

/**
 * Props for the AuthCard component
 */
export interface AuthCardProps {
  /** Page title displayed in 24px Merriweather semibold */
  title: string;
  /** Optional subtitle — supports JSX for inline links */
  subtitle?: React.ReactNode;
  /** Form content to render inside the card */
  children: React.ReactNode;
}

/**
 * AuthCard — centered standalone card shell for all auth pages.
 *
 * Server display component (no client hooks). Provides consistent
 * branding and layout for register, login, reset-password, and check-email.
 *
 * @param {AuthCardProps} props - Component props
 * @returns {JSX.Element} Centered auth card
 */
export function AuthCard({ title, subtitle, children }: AuthCardProps): JSX.Element {
  return (
    <div className="card max-w-md w-full mx-4 p-8">
      {/* Site branding */}
      <p className="text-primary-900 font-semibold text-sm mb-6">
        Houston Home Spotlight
      </p>

      {/* Page title */}
      <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900 mb-2">
        {title}
      </h1>

      {/* Optional subtitle */}
      {subtitle && (
        <p className="text-sm text-gray-500 mb-6">
          {subtitle}
        </p>
      )}

      {/* Form content */}
      <div className={subtitle ? '' : 'mt-6'}>
        {children}
      </div>
    </div>
  );
}

export default AuthCard;
