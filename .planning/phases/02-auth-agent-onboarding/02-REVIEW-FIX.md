---
phase: 02-auth-agent-onboarding
fixed_at: 2026-06-13T00:00:00Z
review_path: .planning/phases/02-auth-agent-onboarding/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-06-13
**Source review:** .planning/phases/02-auth-agent-onboarding/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (3 Critical + 6 Warning; Info findings excluded per critical_warning scope)
- Fixed: 9
- Skipped: 0

**Verification:**
- `npm run typecheck` (`tsc --noEmit`): clean, no errors.
- `npm test`: only the 4 pre-existing, out-of-scope failures in
  `src/tests/listing-detail-page.test.ts` remain. No NEW failures introduced.
  The `firebase-errors` test suite was updated to assert the new neutral copy
  and now passes (it previously locked in the enumeration behavior CR-03 fixes).

## Fixed Issues

### CR-01: `photo_url` stored without URL validation, then rendered into `<img src>`

**Files modified:** `src/app/api/agent/profile/route.ts`, `src/components/dashboard/ProfileForm.tsx`
**Commit:** 307620d
**Applied fix:** Added an `isSafeHttpUrl()` http(s) scheme allow-list. Server-side,
the PATCH route now rejects any non-http(s) `photo_url` with a 400 before binding to
D1. Client-side, `ProfileForm.validateField` rejects non-http(s) photo URLs, and the
preview `<img>` only renders when `previewUrl` passes the same check — so a
`javascript:`/`data:` value never binds to `src`.

### CR-02: Fail-open profile gate + missing edge/dynamic runtime

**Files modified:** `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/profile/page.tsx`
**Commit:** c2ade23
**Applied fix:** Added `export const dynamic = 'force-dynamic'` and
`export const runtime = 'edge'` to the dashboard layout and both D1-reading pages so
they execute per-request in the worker binding context. Made the gate fail CLOSED: a
thrown D1 read now sets `readFailed`, which forces `profileComplete = false` and routes
the user to the `/dashboard/profile` holding state instead of rendering the gated
dashboard. A read failure is no longer indistinguishable from a complete profile.
**Note:** requires human verification — this changes gate control-flow (fail-closed
semantics); confirm the redirect holding-state behavior is correct in the deployed
worker before proceeding.

### CR-03: Account enumeration via differentiated auth error copy

**Files modified:** `src/lib/firebase-errors.ts`, `src/components/auth/ResetPasswordForm.tsx`, `src/tests/firebase-errors.test.ts`
**Commit:** 053c91a
**Applied fix:** Collapsed `auth/wrong-password`, `auth/invalid-credential`, and
`auth/user-not-found` into one neutral message ("Incorrect email or password. Try again
or reset your password."). In `ResetPasswordForm`, `auth/user-not-found` now yields the
same neutral success state as a real email, so existing vs. non-existing accounts are
indistinguishable. Updated the regression tests to assert the neutral copy and to assert
that the "No account found" string is absent.

## Warnings Fixed

### WR-01: Redirect-loop guard depends on spoofable / adapter-dependent headers

**Files modified:** `src/app/(dashboard)/layout.tsx`
**Commit:** ebb30a1
**Applied fix:** When none of `x-matched-path` / `next-url` / `x-invoke-path` are present
(path undeterminable), the guard now defaults `onProfilePage = true`, failing toward
showing the profile form rather than redirect-looping an incomplete agent to
`/dashboard/profile`. A known non-profile path still triggers the gate.
**Note:** the spoofing concern for non-profile routes is mitigated in direction but not
fully eliminated without per-segment gating; recommend human review.

### WR-02: Login does not sign the Firebase client out on 403 (unverified)

**Files modified:** `src/components/auth/LoginForm.tsx`
**Commit:** 719300b
**Applied fix:** On a non-OK `/api/auth/session` response, the form now calls
`await signOut(auth)` before returning, so the client SDK does not retain an
authenticated session for an account the server refused to mint a cookie for.

### WR-03: PATCH reports success for zero rows affected; no email_verified check

**Files modified:** `src/app/api/agent/profile/route.ts`
**Commit:** 76579e2
**Applied fix:** Added an `email_verified` gate (403 for unverified tokens). The UPDATE
result is now inspected; when `meta.changes === 0` (no matching agent row) the route
returns 409 instead of falsely reporting success.

### WR-04: DELETE/POST /api/auth/session unauthenticated cross-site invocation

**Files modified:** `src/app/api/auth/session/route.ts`
**Commit:** 5c366b1
**Applied fix:** Added an `isSameOrigin()` guard that compares the Origin (or Referer
fallback) host against the request host, applied at the top of both POST and DELETE.
Cross-origin requests are rejected with 403. DELETE now takes the `request` argument to
read its headers.

### WR-05: D1 read errors swallowed across RSC files, masking production failures

**Files modified:** `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/profile/page.tsx`
**Commit:** bacb271
**Applied fix:** Both pages now re-throw the caught D1 error when
`NODE_ENV === 'production'` (surfacing to the Next.js error boundary) and only swallow
locally where the Cloudflare binding is legitimately absent (`next dev`). A production
D1 outage no longer renders a misleading empty-but-successful profile form.
(The layout — the third file — already fails closed via CR-02.)

### WR-06: Register fires a session-cookie request whose result is discarded

**Files modified:** `src/components/auth/RegisterForm.tsx`
**Commit:** 00cc245
**Applied fix:** Removed the discarded `POST /api/auth/session` from the registration
flow. The user is sent to `/check-email` after verification email send; the session
cookie is minted at `/login` after the user verifies. Updated the module/flow JSDoc to
match.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
