---
status: testing
phase: 03-subscription-billing
source: [03-VERIFICATION.md]
started: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
note: Deferred per autonomous-run directive. Requires Stripe test-mode keys in .dev.vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID), a $79/mo recurring Price + enabled Customer Portal in the Stripe Dashboard, and `npm run cf:preview` + `stripe listen --forward-to localhost:8787/api/stripe/webhook`.
---

## Current Test

number: 1
name: Live Stripe Checkout (BILL-01)
expected: |
  Complete Checkout with test card 4242 4242 4242 4242; D1 agents row reflects
  subscription_status='active' within seconds; redirected back to /dashboard/billing.
awaiting: user response

## Tests

### 1. Live Stripe Checkout (BILL-01)
expected: Checkout with test card 4242... -> D1 subscription_status='active' within seconds; redirect to /dashboard/billing
result: [pending]

### 2. Customer Portal self-service (BILL-02)
expected: Portal enabled in Stripe Dashboard first; open Portal from billing page -> update card / cancel -> cancellation drives subscription_status to lapsed
result: [pending]

### 3. Webhook delivery + grace + idempotency (BILL-03 + BILL-05)
expected: stripe trigger invoice.payment_failed -> subscription_status='grace', subscription_grace_until = now + 604800 epoch seconds; resending same event_id creates NO duplicate stripe_events row (no-op)
result: [pending]

### 4. WR-06 business-rule approval
expected: Confirm invoice.paid must NOT resurrect a lapsed agent (reactivation only via new customer.subscription.created)
result: [pending]

### 5. BillingWidget visual rendering (4 states + admin)
expected: none -> Subscribe; active -> badge + renewal date + Manage; grace -> warning + Manage; lapsed -> reactivate; admin -> owner notice, no paywall
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
