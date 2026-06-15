---
status: testing
phase: 04-listings-migration-and-leads
source: [04-VERIFICATION.md]
started: 2026-06-14T00:00:00Z
updated: 2026-06-14T00:00:00Z
note: Deferred per autonomous-run directive. Requires migrations 0002+0003 applied (0003 needs Bernard's admin agents row first), wrangler dev + D1 binding, and Resend creds (RESEND_API_KEY, LEAD_FROM_EMAIL verified domain, ADMIN_NOTIFY_EMAIL). Item 9 is a PRODUCT DECISION for Bernard.
---

## Current Test

number: 1
name: Apply migrations 0002 + 0003 and confirm 3 legacy slugs resolve
expected: |
  wrangler d1 execute shows seeded=3; /listings/heights-bungalow-historic,
  /listings/riverside-terrace-modern-craftsman, /listings/sugarland-estate-pool
  all return 200 with correct data.
awaiting: user response

## Tests

### 1. Apply migrations 0002 + 0003; confirm 3 legacy slugs resolve (LIST-07/08)
expected: seeded=3; all 3 original /listings/[slug] URLs return 200 with correct data
result: [pending]

### 2. Live D1 listing CRUD round-trip (wrangler dev)
expected: POST creates (201) + images; GET returns; PUT updates + PRESERVES original slug; PATCH toggles status; DELETE cascades images; public /listings reflects changes
result: [pending]

### 3. Subscription gate on create — lapsed agent → 403 (LIST-03)
expected: POST /api/agent/listings with lapsed session → 403 "Active subscription required to create listings"
result: [pending]

### 4. Cross-agent 403 on PUT/DELETE/PATCH (LIST-02)
expected: direct API call with a different agent's session → 403 Forbidden
result: [pending]

### 5. Resend delivery — agent email (reply_to=buyer) + Bernard CC (LEAD-02/03/04)
expected: agent receives email reply_to=buyer; Bernard (ADMIN_NOTIFY_EMAIL) CC'd; buyer sees 200
result: [pending]

### 6. Best-effort leads — Resend failure does not block buyer (LEAD-04)
expected: invalid RESEND_API_KEY → buyer still gets 200; D1 leads row written; console.error logged
result: [pending]

### 7. Dashboard lead inbox isolation (LEAD-05)
expected: agent sees own leads (name/email/phone/message/date); second agent sees only theirs
result: [pending]

### 8. CR-02 edit data-flow — edit form pre-fills ALL fields from real D1 record
expected: edit modal shows loading spinner then pre-fills city/state/zip/sqft/description from actual record; save does not overwrite with defaults
result: [pending]

### 9. WR-05 PRODUCT DECISION — leads gated on active/publishable listing
expected: Confirm desired behavior — CURRENT: pausing/lapsing a listing blocks new inquiries (400 "Listing not found", no lead). Alternative: capture good-faith inquiries even for paused listings (revert one query in /api/leads/route.ts).
result: [pending]

### 10. Public pages — no visual regression from JSON→D1 switch (LIST-08)
expected: /listings browse (hero, filter bar, results count, responsive grid) and /listings/[slug] (gallery, stats, description, JSON-LD, inquiry form) identical to before
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
