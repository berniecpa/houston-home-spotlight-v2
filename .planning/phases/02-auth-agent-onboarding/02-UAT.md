---
status: testing
phase: 02-auth-agent-onboarding
source: [02-VERIFICATION.md]
started: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
note: Deferred per autonomous-run directive — all items require a provisioned Firebase project + `npm run cf:preview` (Workers runtime) + populated .dev.vars (see .env.local.example).
---

## Current Test

number: 1
name: Register with a real email and 8+ char password via /register
expected: |
  Account created, verification email received, lands on /check-email; resend
  button sends second email and shows 3-second 'Email sent!' feedback
awaiting: user response

## Tests

### 1. Register with a real email and 8+ char password via /register
expected: Account created, verification email received, lands on /check-email; resend sends second email with 3s 'Email sent!' feedback
result: [pending]

### 2. Verify email link, then log in at /login
expected: After clicking Firebase verification link, /login succeeds and redirects to /dashboard; __session HttpOnly cookie visible in DevTools
result: [pending]

### 3. Persistent session across browser restart
expected: Close/reopen browser; revisit /dashboard — still authenticated, no redirect to /login
result: [pending]

### 4. Unverified email guard on /login
expected: Unverified account login blocked with verification error banner; no __session cookie; Firebase client signed out
result: [pending]

### 5. Redirect preservation
expected: Logged out visit to /dashboard -> /login?redirect=/dashboard; after login, back to /dashboard
result: [pending]

### 6. Password reset via /reset-password — live delivery + account-enumeration parity
expected: Registered email -> inline 'Check your inbox' (no nav) + email arrives; unregistered email -> identical neutral success (no enumeration)
result: [pending]

### 7. Profile gate: new agent redirected to /dashboard/profile, blocked from other dashboard routes
expected: Fresh agent redirected to /dashboard/profile; /dashboard/listings redirects back to profile (no loop)
result: [pending]

### 8. Complete agent profile and confirm D1 persistence
expected: Fill 5 fields; photo preview on blur; save -> green banner; /dashboard shows 100% complete; D1 SELECT confirms values
result: [pending]

### 9. Invalid photo URL rejected by ProfileForm
expected: 'javascript:alert(1)' as Photo URL -> inline 'Photo URL must be a valid http(s) URL.' before submit; server returns 400
result: [pending]

### 10. Bernard's admin claim and /admin route protection
expected: After `BERNARD_UID=<uid> npm run admin:set-claim` + re-auth, Bernard loads /admin (red sidebar + ADMIN badge); standard agent -> 403; logged out -> /login
result: [pending]

### 11. Fail-closed dashboard gate under D1 outage (production)
expected: D1 unavailable in prod -> dashboard layout fails closed (routes to profile) rather than rendering an empty profile form
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
