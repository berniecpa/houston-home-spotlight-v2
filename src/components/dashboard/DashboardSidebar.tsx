/**
 * DashboardSidebar Component
 *
 * Left navigation sidebar for the agent dashboard. Persistent 256px column on
 * lg+ screens; collapses to an off-canvas drawer on mobile.
 *
 * Navigation items:
 *   - Listings: "(Coming soon)" — renders as <span>, not clickable
 *   - Leads: "(Coming soon)" — renders as <span>, not clickable
 *   - Profile: active link — navigates to /dashboard/profile
 *   - Billing: "(Coming soon)" — renders as <span>, not clickable
 *
 * Active item detection: usePathname() matches current route to highlight
 * the Profile link with primary-700 background.
 *
 * Mobile: hamburger button (.touch-target) toggles drawer from left.
 * Escape key closes the drawer and returns focus to hamburger.
 * aria-expanded + aria-label="Navigation menu" per Accessibility Contract.
 *
 * Pattern mirrors Header.tsx mobile menu toggle (useState + svg icons).
 *
 * @module components/dashboard/DashboardSidebar
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** DashboardSidebar component props */
export interface DashboardSidebarProps {
  /** Whether the agent's profile is fully complete (four-field gate) */
  isProfileComplete: boolean;
}

/**
 * DashboardSidebar — left navigation + mobile drawer for the agent dashboard.
 *
 * @param props.isProfileComplete - Controls footer CTA visibility
 * @returns {JSX.Element} Sidebar navigation element
 */
export function DashboardSidebar({
  isProfileComplete,
}: DashboardSidebarProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  /** Close drawer and return focus to hamburger button */
  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  /** Close drawer on Escape key */
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeDrawer();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDrawer]);

  /** Close drawer when route changes (user navigated) */
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isProfileActive = pathname?.startsWith('/dashboard/profile');

  return (
    <>
      {/* Mobile hamburger button — visible only below lg */}
      <button
        ref={hamburgerRef}
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 touch-target flex items-center justify-center rounded-lg bg-primary-900 text-white shadow-md"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="dashboard-nav-drawer"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <aside
        id="dashboard-nav-drawer"
        aria-label="Navigation menu"
        className={`
          fixed top-0 left-0 h-full w-64 bg-primary-900 text-white z-50
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-primary-700">
          <span className="font-serif font-semibold text-lg leading-snug">
            Houston Home Spotlight
          </span>

          {/* Close button — mobile only */}
          <button
            type="button"
            className="lg:hidden touch-target flex items-center justify-center rounded-lg hover:bg-primary-700 transition-colors"
            onClick={closeDrawer}
            aria-label="Close navigation menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4" aria-label="Dashboard navigation">
          <ul className="space-y-1">
            {/* Listings — Coming soon (not a link) */}
            <li>
              <span
                className="flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-primary-300 cursor-default select-none"
                aria-disabled="true"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span>
                  Listings{' '}
                  <span className="text-xs text-primary-400">(Coming soon)</span>
                </span>
              </span>
            </li>

            {/* Leads — Coming soon (not a link) */}
            <li>
              <span
                className="flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-primary-300 cursor-default select-none"
                aria-disabled="true"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
                <span>
                  Leads{' '}
                  <span className="text-xs text-primary-400">(Coming soon)</span>
                </span>
              </span>
            </li>

            {/* Profile — active link */}
            <li>
              <Link
                href="/dashboard/profile"
                className={`flex items-center gap-2 px-4 min-h-[44px] rounded-lg transition-colors duration-150
                  ${
                    isProfileActive
                      ? 'bg-primary-700 text-white font-semibold'
                      : 'text-white hover:bg-primary-800'
                  }`}
                aria-current={isProfileActive ? 'page' : undefined}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Profile
              </Link>
            </li>

            {/* Billing — Coming soon (not a link) */}
            <li>
              <span
                className="flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-primary-300 cursor-default select-none"
                aria-disabled="true"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                <span>
                  Billing{' '}
                  <span className="text-xs text-primary-400">(Coming soon)</span>
                </span>
              </span>
            </li>
          </ul>
        </nav>

        {/* Footer — profile completion indicator */}
        {!isProfileComplete && (
          <div className="px-4 py-4 border-t border-primary-800">
            <Link
              href="/dashboard/profile"
              className="block text-sm text-primary-300 hover:text-white transition-colors"
            >
              Complete your profile &rarr;
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

export default DashboardSidebar;
