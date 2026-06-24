/**
 * PricingTable Component
 *
 * Reusable 3-tier pricing UI with a monthly/annual toggle. Used by the public
 * /pricing page and the dashboard BillingWidget (none/lapsed states).
 *
 * CTA flow: POST /api/stripe/checkout { priceId } →
 *   - 200 → redirect to the Stripe Checkout URL
 *   - 401 → not signed in → send to /register?redirect=/pricing
 *   - 403 → admin (no subscription needed) → inline notice
 *   - else → inline error banner
 *
 * Security: the server validates priceId against the pricing allowlist
 * (isValidPriceId) — the client never dictates an arbitrary price.
 *
 * @module components/PricingTable
 */

'use client';

import { useState } from 'react';
import {
  PRICING_TIERS,
  type BillingCadence,
  type PricingTier,
} from '@/lib/pricing';

/** Props for PricingTable. */
export interface PricingTableProps {
  /** CTA label on each tier (default "Choose plan"). */
  ctaLabel?: string;
}

/** Format a whole-dollar amount as USD. */
function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

/**
 * PricingTable — tier cards + monthly/annual toggle + checkout CTAs.
 *
 * @param props.ctaLabel - Optional CTA text per tier.
 * @returns {JSX.Element} Pricing cards
 */
export function PricingTable({ ctaLabel = 'Choose plan' }: PricingTableProps): JSX.Element {
  const [cadence, setCadence] = useState<BillingCadence>('monthly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Start checkout for the selected tier/cadence. */
  async function handleSelect(tier: PricingTier): Promise<void> {
    const priceId = cadence === 'monthly' ? tier.monthly.priceId : tier.annual.priceId;
    setLoadingTier(tier.id);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      if (res.status === 401) {
        // Not signed in — send them to register, returning to pricing after.
        window.location.href = '/register?redirect=/pricing';
        return;
      }
      if (res.status === 403) {
        setError('Your account is the platform owner — no subscription needed.');
        setLoadingTier(null);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Unable to start checkout. Please try again.');
      }

      const { url } = (await res.json()) as { url?: string | null };
      if (typeof url !== 'string' || url.length === 0) {
        throw new Error('Unable to start checkout. Please try again.');
      }
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoadingTier(null);
    }
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-6 mx-auto max-w-md bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm text-center"
        >
          {error}
        </div>
      )}

      {/* Monthly / Annual toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${cadence === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={cadence === 'annual'}
          aria-label="Toggle annual billing"
          onClick={() => setCadence((c) => (c === 'monthly' ? 'annual' : 'monthly'))}
          className="relative inline-flex h-7 w-14 items-center rounded-full bg-primary-600 transition-colors touch-target"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
              cadence === 'annual' ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${cadence === 'annual' ? 'text-gray-900' : 'text-gray-400'}`}>
          Annual
          <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            2 months free
          </span>
        </span>
      </div>

      {/* Tier cards */}
      <div className="grid gap-6 md:grid-cols-3 items-start pt-3">
        {PRICING_TIERS.map((tier) => {
          const price = cadence === 'monthly' ? tier.monthly : tier.annual;
          const suffix = cadence === 'monthly' ? '/mo' : '/yr';
          return (
            <div
              key={tier.id}
              className={`card p-6 flex flex-col ${
                tier.highlighted ? 'ring-2 ring-primary-600 relative overflow-visible' : ''
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="font-serif text-xl font-semibold text-gray-900">{tier.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{tier.tagline}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900 tabular-nums">{usd(price.amount)}</span>
                <span className="text-sm text-gray-500">{suffix}</span>
              </div>
              {cadence === 'annual' && (
                <p className="mt-1 text-xs text-gray-400">
                  ≈ {usd(Math.round(price.amount / 12))}/mo, billed yearly
                </p>
              )}

              <ul className="mt-6 space-y-2 flex-grow">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void handleSelect(tier)}
                disabled={loadingTier !== null}
                className={`${tier.highlighted ? 'btn-primary' : 'btn-accent'} touch-target mt-6 w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={`${ctaLabel} — ${tier.name}`}
              >
                {loadingTier === tier.id ? 'Please wait…' : ctaLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PricingTable;
