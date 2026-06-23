-- db/migrations/0006_add_subscription_tier.sql
-- Adds the agent's current subscription tier so per-tier limits (listing caps,
-- AI-video monthly credits) can be enforced.
--
-- Values: 'starter' | 'pro' | 'team', or NULL when the agent has never had a
-- tiered subscription (legacy/none) or is the admin (admin bypasses limits).
-- The webhook (customer.subscription.created/updated) maps the subscription's
-- Stripe price id → tier (see src/lib/pricing.ts tierForPriceId) and writes it.

ALTER TABLE agents ADD COLUMN subscription_tier TEXT;
