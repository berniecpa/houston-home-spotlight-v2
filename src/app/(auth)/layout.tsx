/**
 * Auth Route Group Layout
 *
 * Standalone centered layout for all auth pages (register, login,
 * reset-password, check-email). No public Header or Footer — clean
 * auth UX with no navigation distraction.
 *
 * Per UI-SPEC Auth Layout contract:
 * - min-h-screen bg-gray-50 (full viewport, light background)
 * - flex items-center justify-center (vertical + horizontal centering)
 * - mx-4 on mobile (16px horizontal margin); max-w-md in AuthCard handles desktop
 * - No public Header or Footer (CONTEXT.md decision: standalone auth pages)
 *
 * @module app/(auth)/layout
 */

import React from 'react';

/**
 * Props for auth layout
 */
interface AuthLayoutProps {
  /** Page content (auth card + form) */
  children: React.ReactNode;
}

/**
 * AuthLayout — minimal centered layout for auth pages.
 *
 * RSC (no client hooks needed). Per-page <title> is set via
 * metadata exports in each page.tsx.
 *
 * @param {AuthLayoutProps} props - Layout props
 * @returns {JSX.Element} Full-screen centered auth container
 */
export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {children}
    </div>
  );
}
