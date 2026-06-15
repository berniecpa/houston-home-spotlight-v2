---
status: testing
phase: 05-admin-panel-agent-profiles
source: [05-VERIFICATION.md]
started: 2026-06-14T00:00:00Z
updated: 2026-06-14T00:00:00Z
note: Deferred per autonomous-run directive. Requires wrangler dev + D1 (with agent rows), the slug backfill migration applied, a live admin (Bernard) session, and a second non-admin agent session.
---

## Current Test

number: 1
name: Apply slug backfill migration 0004 (IN-01)
expected: |
  After agent rows exist, apply 0004_backfill_agent_slugs.sql; SELECT id, display_name, slug
  FROM agents shows no NULL slugs for real agents; /agents/[slug] resolves for each.
awaiting: user response

## Tests

### 1. Slug backfill migration application (IN-01)
expected: 0004 applied after agent rows exist; no NULL slugs; /agents/[slug] resolves. NOTE: confirm the backfill SQL strategy is robust against UNIQUE collisions on backfill.
result: [pending]

### 2. Live suspension — listings browse + detail (ADMIN-02)
expected: set is_suspended=1 → agent's listings vanish from /listings and slug URLs 404; set 0 → restored
result: [pending]

### 3. Live suspension — agent profile page (ADMIN-02/04)
expected: suspended agent's /agents/[slug] returns 404; unsuspend restores
result: [pending]

### 4. Lead submission refused for suspended agent listing
expected: inquiry on a suspended agent's (hidden) listing → 400 "Listing not found", no lead row
result: [pending]

### 5. Dashboard suspended banner (ADMIN-02)
expected: suspended agent logs in → read-only dashboard with "Account suspended — contact the administrator" banner; create/edit/delete/pause return 403
result: [pending]

### 6. Admin agent list + suspend toggle (ADMIN-01/02)
expected: Bernard sees paginated agents (name/email/subscription/account status); inline suspend/unsuspend toggle works + refreshes; pagination Prev/Next clamps
result: [pending]

### 7. Admin API 403 from non-admin (security)
expected: a non-admin authenticated agent calling /api/admin/* directly (bypassing middleware) → 403 from server-side requireAdmin; admin pages also reject non-admin via the (admin) layout choke point
result: [pending]

### 8. IN-03 architectural decision (isAdminRejection discriminant)
expected: Bernard/team decide whether to refactor the admin-rejection discriminant shape (forward-looking; no immediate danger). Not blocking.
result: [pending]

### 9. Platform stats accuracy (ADMIN-03)
expected: /admin/stats 4 cards (total agents, active subscriptions, total listings, total leads) match D1 COUNT(*) values
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
