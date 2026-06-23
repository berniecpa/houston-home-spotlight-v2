/**
 * Subscription pricing — single source of truth for tiers and Stripe price IDs.
 *
 * Shared by the public /pricing page, the dashboard BillingWidget, and the
 * Stripe checkout route. The checkout route validates the client-supplied
 * priceId against `isValidPriceId` so an arbitrary price can never be charged.
 *
 * Price IDs are LIVE Stripe prices (created 2026-06-23). They are public
 * identifiers (safe in source) — not secrets.
 *
 * @module lib/pricing
 */

/** Billing cadence for a tier. */
export type BillingCadence = 'monthly' | 'annual';

/** Tier identifier. */
export type TierId = 'starter' | 'pro' | 'team';

/** A single price option (monthly or annual) for a tier. */
export interface TierPrice {
  /** Live Stripe price id */
  priceId: string;
  /** Whole-dollar amount billed for the period */
  amount: number;
}

/** A pricing tier shown on the pricing table. */
export interface PricingTier {
  id: TierId;
  name: string;
  tagline: string;
  monthly: TierPrice;
  annual: TierPrice;
  /** Whether to visually highlight this tier as the recommended anchor */
  highlighted?: boolean;
  /** Feature bullets shown on the card */
  features: string[];
}

/** Ordered tiers (Starter → Pro → Team). Pro is the highlighted anchor. */
export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For agents getting started',
    monthly: { priceId: 'price_1TlVZNFSIcdeQXwWkVU3TLi7', amount: 99 },
    annual: { priceId: 'price_1TlVZdFSIcdeQXwWvvmPWMCP', amount: 990 },
    features: [
      'Up to 3 active listings',
      'All buyer inquiry leads',
      '3 AI property-tour videos / mo',
      'Standard listing placement',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For active listing agents',
    highlighted: true,
    monthly: { priceId: 'price_1TlVZPFSIcdeQXwWTO0rqrKi', amount: 249 },
    annual: { priceId: 'price_1TlVZeFSIcdeQXwWh5Lk6KpQ', amount: 2490 },
    features: [
      'Up to 15 active listings',
      'Featured Houston search placement',
      '1 ZIP “spotlight”',
      'Lead inbox + CSV export',
      '10 AI property-tour videos / mo',
    ],
  },
  {
    id: 'team',
    name: 'Team / Brokerage',
    tagline: 'For teams and brokerages',
    monthly: { priceId: 'price_1TlVZRFSIcdeQXwWmg2RltXx', amount: 499 },
    annual: { priceId: 'price_1TlVZgFSIcdeQXwWKOO5h7uI', amount: 4990 },
    features: [
      'Unlimited active listings',
      'Top-of-search featured placement',
      'Multi-ZIP spotlight',
      'Priority buyer leads',
      '30 AI property-tour videos / mo',
    ],
  },
];

/** Set of every valid (chargeable) price id across all tiers/cadences. */
const VALID_PRICE_IDS: ReadonlySet<string> = new Set(
  PRICING_TIERS.flatMap((t) => [t.monthly.priceId, t.annual.priceId])
);

/**
 * True when `priceId` is one of the known subscription prices.
 * The checkout route MUST gate on this before passing a price to Stripe.
 */
export function isValidPriceId(priceId: string): boolean {
  return VALID_PRICE_IDS.has(priceId);
}

/** Lowest monthly tier price — used for "Plans from $N/mo" copy. */
export const STARTING_MONTHLY_PRICE = Math.min(
  ...PRICING_TIERS.map((t) => t.monthly.amount)
);
