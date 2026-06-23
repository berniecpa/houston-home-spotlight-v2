/**
 * BillingWidget Component
 *
 * Client widget for the /dashboard/billing page. Renders the correct UI based
 * on the agent's current subscription state (4 states + admin notice):
 *
 *   - 'none'   → Subscribe CTA (POST /api/stripe/checkout → redirect)
 *   - 'active' → Active badge + renewal date + Manage billing button
 *   - 'grace'  → Payment-failed warning + grace deadline + Manage billing button
 *   - 'lapsed' → Subscription ended copy + Reactivate CTA (same Subscribe flow)
 *   - admin    → Platform owner notice — no paywall, no Subscribe/Manage CTA
 *
 * CTAs POST to the Stripe routes from 03-02, parse `{ url }` from JSON, and
 * redirect via window.location.href. Errors are shown as inline banners
 * (mirror InquiryForm.tsx error pattern — no throw, no modal).
 *
 * Security note (T-03-BW-I): This widget receives only status / grace / renewal
 * / isAdmin. The stripe_customer_id and Stripe secret key are never client-visible.
 *
 * @module components/dashboard/BillingWidget
 */

'use client';

import { useState } from 'react';
import type { SubscriptionStatus } from '@/lib/subscription';
import { PricingTable } from '@/components/PricingTable';

/** Props for the BillingWidget component */
export interface BillingWidgetProps {
  /** Current subscription status from D1 agents.subscription_status */
  status: SubscriptionStatus;
  /** Epoch seconds when grace period expires; null unless status is 'grace' */
  graceUntil: number | null;
  /** Whether the session user is the platform admin (Bernard) */
  isAdmin: boolean;
  /** Epoch seconds of the current subscription period end; null if no active sub */
  renewalDate: number | null;
}

/** Format an epoch-seconds timestamp to a human-readable date string */
function formatEpochDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * BillingWidget — renders subscription state UI with interactive CTAs.
 *
 * @param props.status      - Subscription status from D1
 * @param props.graceUntil  - Grace expiry epoch seconds (null if not in grace)
 * @param props.isAdmin     - True for platform owner account
 * @param props.renewalDate - Period end epoch seconds (null if not active)
 * @returns {JSX.Element} Billing state card
 */
export function BillingWidget({
  status,
  graceUntil,
  isAdmin,
  renewalDate,
}: BillingWidgetProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** POST to /api/stripe/portal and redirect to returned URL */
  async function handleManage(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Unable to open billing portal. Please try again.');
      }

      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div>
      {/* Page heading */}
      <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900 mb-6">
        Billing
      </h1>

      {/* Inline error banner (mirrors InquiryForm.tsx error pattern) */}
      {error && (
        <div
          role="alert"
          className="mb-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {/* Admin notice — platform owner, no paywall */}
      {isAdmin && (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-gray-900 text-base">
                Platform owner — complimentary access
              </p>
              <p className="text-sm text-gray-500 mt-1">
                No subscription required. Your account has full access to all platform features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* State: 'none' — agent has never subscribed */}
      {!isAdmin && status === 'none' && (
        <div>
          <h2 className="font-serif text-xl font-semibold leading-relaxed text-gray-900 mb-2">
            Choose a plan to start publishing
          </h2>
          <p className="text-base text-gray-600 mb-6">
            Subscribe to publish your Houston property listings, receive buyer
            inquiries, and generate AI property-tour videos. Cancel anytime.
          </p>
          <PricingTable ctaLabel="Subscribe" />
        </div>
      )}

      {/* State: 'active' — current, paid subscription */}
      {!isAdmin && status === 'active' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
              Active
            </span>
            <span className="text-sm text-gray-500">Subscription is current</span>
          </div>

          {renewalDate !== null && (
            <p className="text-base text-gray-600 mb-6">
              Renews on{' '}
              <span className="font-semibold text-gray-900">
                {formatEpochDate(renewalDate)}
              </span>
            </p>
          )}

          <p className="text-sm text-gray-500 mb-4">
            Update your payment method, download invoices, or cancel your subscription in
            the Stripe billing portal.
          </p>

          <button
            type="button"
            onClick={handleManage}
            disabled={isLoading}
            aria-label="Open Stripe billing portal to manage your subscription"
            className="btn-primary touch-target w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Please wait...' : 'Manage billing'}
          </button>
        </div>
      )}

      {/* State: 'grace' — payment failed, within 7-day grace window */}
      {!isAdmin && status === 'grace' && (
        <div className="card p-6">
          {/* Warning banner */}
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              Payment failed — update your card to keep access
            </p>
            {graceUntil !== null && (
              <p className="text-sm text-amber-700">
                Your listings remain visible until{' '}
                <span className="font-semibold">{formatEpochDate(graceUntil)}</span>.
                After that, they will be hidden from public browse until payment is resolved.
              </p>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Open the billing portal to update your payment method. Your listings will be
            immediately restored once payment succeeds.
          </p>

          <button
            type="button"
            onClick={handleManage}
            disabled={isLoading}
            aria-label="Open Stripe billing portal to update your payment method"
            className="btn-accent touch-target w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Please wait...' : 'Manage billing'}
          </button>
        </div>
      )}

      {/* State: 'lapsed' — subscription ended or grace period expired */}
      {!isAdmin && status === 'lapsed' && (
        <div>
          <h2 className="font-serif text-xl font-semibold leading-relaxed text-gray-900 mb-2">
            Subscription ended
          </h2>
          <p className="text-base text-gray-600 mb-6">
            Your subscription has lapsed. Reactivate to publish listings and receive
            buyer inquiries. Your existing listings are retained and restored
            automatically when you resubscribe.
          </p>
          <PricingTable ctaLabel="Reactivate" />
        </div>
      )}
    </div>
  );
}

export default BillingWidget;
