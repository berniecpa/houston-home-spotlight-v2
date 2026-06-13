/**
 * ErrorBanner Component
 *
 * Full-width error banner for displaying Firebase/server rejection messages
 * inside auth forms. Rendered only when a message is present.
 *
 * Per UI-SPEC Server Error Banner contract:
 * - bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg
 * - role="alert" for accessibility (screen reader announcement)
 * - Renders nothing when message is empty or undefined
 * - No dismiss button — clears on next successful interaction or navigation
 *
 * @module components/auth/ErrorBanner
 */

'use client';

/**
 * Props for the ErrorBanner component
 */
export interface ErrorBannerProps {
  /** Error message to display. Component renders nothing when falsy. */
  message: string;
}

/**
 * ErrorBanner — displays a Firebase/server error inside an auth card.
 *
 * Client component (used inside 'use client' forms). Conditionally renders
 * a full-width red banner with role="alert" for accessibility.
 *
 * @param {ErrorBannerProps} props - Component props
 * @returns {JSX.Element | null} Error banner or null
 */
export function ErrorBanner({ message }: ErrorBannerProps): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <div
      className="w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default ErrorBanner;
