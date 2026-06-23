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

/** Map a Stripe price id (monthly or annual) back to its tier, or null. */
const PRICE_ID_TO_TIER: ReadonlyMap<string, TierId> = new Map(
  PRICING_TIERS.flatMap((t) => [
    [t.monthly.priceId, t.id] as const,
    [t.annual.priceId, t.id] as const,
  ])
);

/**
 * Resolve a Stripe price id to its tier id, or null if unknown.
 * Used by the webhook to persist `agents.subscription_tier`.
 */
export function tierForPriceId(priceId: string | null | undefined): TierId | null {
  if (!priceId) return null;
  return PRICE_ID_TO_TIER.get(priceId) ?? null;
}

/** Enforced per-tier limits. `maxListings: null` means unlimited. */
export interface TierLimits {
  /** Max simultaneously-active listings; null = unlimited */
  maxListings: number | null;
  /** AI property-tour videos allowed per calendar month */
  aiVideosPerMonth: number;
}

/** Hard limits enforced server-side per tier. */
export const TIER_LIMITS: Record<TierId, TierLimits> = {
  starter: { maxListings: 3, aiVideosPerMonth: 3 },
  pro: { maxListings: 15, aiVideosPerMonth: 10 },
  team: { maxListings: null, aiVideosPerMonth: 30 },
};

/** Limits for a tier id (or null when tier is unknown). */
export function limitsForTier(tier: string | null | undefined): TierLimits | null {
  if (tier === 'starter' || tier === 'pro' || tier === 'team') {
    return TIER_LIMITS[tier];
  }
  return null;
}
