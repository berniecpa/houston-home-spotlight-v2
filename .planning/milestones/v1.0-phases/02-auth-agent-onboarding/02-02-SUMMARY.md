---
phase: 02-auth-agent-onboarding
plan: 02
subsystem: auth
tags: [firebase, firebase-auth, auth-ui, registration, login, password-reset, email-verification, session-cookie]
completed: 2026-06-13
duration: ~7min
---

# Phase 02, Plan 02: Auth UI Vertical Slice Summary

**Complete agent auth UI: register, verify email, login, reset password — built on Plan 02-01 session cookie foundation with Firebase error mapping and instant client-side validation**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-13T22:52:46Z
- **Completed:** 2026-06-13T22:59:57Z
- **Tasks:** 2 auto tasks (TDD) + 1 checkpoint (auto-approved per autonomous directive)
- **Files created:** 12 (11 source + 1 test)
- **Files deleted:** 1 (spike page)

## Accomplishments

- Implemented full auth vertical slice: /register -> /check-email -> /login -> /dashboard redirect, plus /reset-password standalone
- Created firebase-errors.ts with 7 error code mappings + default fallback (UI-SPEC Copywriting Contract exact copy)
- Built AuthCard server component and ErrorBanner client component as reusable auth shells
- RegisterForm: createUserWithEmailAndPassword -> sendEmailVerification -> POST /api/auth/session -> /check-email redirect
- LoginForm: signInWithEmailAndPassword -> POST /api/auth/session -> ?redirect || /dashboard; handles 403 (unverified email) distinctly from Firebase errors
- ResetPasswordForm: sendPasswordResetEmail -> inline success state (no navigation); Suspense-wrapped LoginForm for App Router compatibility
- All auth pages standalone centered cards (no public Header/Footer per CONTEXT.md decision)
- All files under 500 lines; @/ imports; JSDoc module comments; AccessibilityContract: role=alert, aria-describedby, touch-target, aria-disabled
- 11/11 firebase-errors tests pass; typecheck clean

## Task Commits

1. **test(02-02): add failing tests for firebase-errors mapping (RED)** - 488e78d
2. **feat(02-02): auth shell, firebase-errors mapping, register + check-email slice** - 5ef04e0
3. **feat(02-02): login persistent session + password reset slice** - 0b512c2

## Files Created/Modified

### Created
- `src/lib/firebase-errors.ts` — Maps 7 Firebase auth error codes to UI-SPEC copy; fallback for unknown codes
- `src/components/auth/AuthCard.tsx` — Centered .card max-w-md server display component; site name in primary-900; 24px Merriweather title; optional subtitle slot
- `src/components/auth/ErrorBanner.tsx` — role=alert banner; bg-red-50 border border-red-200 text-red-700; renders null when message falsy
- `src/components/auth/RegisterForm.tsx` — createUserWithEmailAndPassword + sendEmailVerification + POST /api/auth/session + redirect /check-email
- `src/components/auth/LoginForm.tsx` — signInWithEmailAndPassword + POST /api/auth/session + redirect preservation; 403 guard for unverified email
- `src/components/auth/ResetPasswordForm.tsx` — sendPasswordResetEmail + inline success state; no navigation on success
- `src/app/(auth)/layout.tsx` — min-h-screen bg-gray-50 flex items-center justify-center; no Header/Footer
- `src/app/(auth)/register/page.tsx` — AuthCard title="Create your account" + RegisterForm
- `src/app/(auth)/login/page.tsx` — AuthCard title="Welcome back" + Suspense + LoginForm
- `src/app/(auth)/reset-password/page.tsx` — AuthCard title="Reset your password" + ResetPasswordForm
- `src/app/(auth)/check-email/page.tsx` — resend button with 3s transient feedback; auth.currentUser?.email display
- `src/tests/firebase-errors.test.ts` — 11 assertions covering all mapped codes + file-level checks

### Deleted
- `src/app/(spike)/spike/page.tsx` — Throwaway spike page from Plan 02-01 no longer needed

## Decisions Made

- **Login Suspense boundary:** App Router requires Suspense when client component uses useSearchParams; LoginForm wrapped in Suspense in page component
- **ResetPasswordForm inline success:** UI-SPEC requires form replaced by inline message with no navigation; implemented via submitted state flag
- **403 handling in LoginForm:** Session route returns 403 for unverified email; LoginForm checks sessionRes.status before Firebase error mapping
- **auth.currentUser?.email with fallback:** check-email page reads currentUser.email; falls back to "your email address" for null case
- **auth/invalid-credential added:** Firebase v9+ SDK sometimes returns this instead of wrong-password; added as alias mapping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale .next/types entries for deleted spike page**
- **Found during:** Task 1 typecheck verification
- **Issue:** Deleting spike page left stale entries in .next/types/validator.ts causing TypeScript errors
- **Fix:** Removed stale entry from generated .next/types/validator.ts and deleted .next/types/app/(spike)/spike/ directory
- **Files modified:** .next/types/validator.ts (generated, not committed)

## Known Stubs

None — all components call real Firebase SDK methods. No hardcoded empty values or TODO placeholders in rendered output.

## Deferred Human Validation

The plan's Task 3 checkpoint requires live manual testing that cannot be automated without a configured Firebase project. Per autonomous directive, checkpoint auto-approved. Steps deferred:

**Pre-requisites:**
1. Configure Firebase credentials in .dev.vars and wrangler secrets (see .env.local.example)
2. Enable Email/Password sign-in provider in Firebase Console
3. Run npm run cf:preview (Workers runtime required)

**Validation steps:**
1. Register with real email + 8 char password -> expect /check-email + verification email
2. Test client validation: 5-char password -> "Password must be at least 8 characters"; mismatched confirm -> "Passwords do not match"
3. Verify email link -> login -> expect /dashboard redirect + __session HttpOnly cookie in DevTools
4. Close/reopen browser -> revisit /dashboard -> expect still authenticated
5. Register second account, do NOT verify, try login -> expect blocked with verification error banner
6. While logged out visit /dashboard -> /login?redirect=/dashboard -> login -> back to /dashboard
7. Reset password: /reset-password -> submit email -> expect inline success message + reset email
8. Register duplicate email -> expect "An account with this email already exists. Log in instead."

## Threat Surface

All STRIDE mitigations from plan threat model implemented:
- T-02-07: LoginForm checks 403 + shows verify message; session route blocks email_verified=false
- T-02-08: Client enforces password >= 8 chars; Firebase rate limiting applies
- T-02-09: Accepted per plan (distinguishes user-not-found vs wrong-password intentionally)
- T-02-10: React escapes all error copy; redirect used only for router.push, never rendered as HTML
- T-02-11: sendPasswordResetEmail is Firebase-managed with built-in throttling

## Self-Check: PASSED

Files verified:
- src/lib/firebase-errors.ts: EXISTS
- src/components/auth/AuthCard.tsx: EXISTS
- src/components/auth/ErrorBanner.tsx: EXISTS
- src/components/auth/RegisterForm.tsx: EXISTS (contains createUserWithEmailAndPassword, sendEmailVerification)
- src/components/auth/LoginForm.tsx: EXISTS (contains signInWithEmailAndPassword, api/auth/session, redirect)
- src/components/auth/ResetPasswordForm.tsx: EXISTS (contains sendPasswordResetEmail)
- src/app/(auth)/layout.tsx: EXISTS
- src/app/(auth)/register/page.tsx: EXISTS
- src/app/(auth)/login/page.tsx: EXISTS
- src/app/(auth)/reset-password/page.tsx: EXISTS
- src/app/(auth)/check-email/page.tsx: EXISTS
- src/app/(spike)/spike/page.tsx: DELETED (confirmed)
- Commits: 488e78d, 5ef04e0, 0b512c2 present in git log
- typecheck: PASS
- firebase-errors tests: 11/11 PASS

---
*Phase: 02-auth-agent-onboarding*
*Completed: 2026-06-13*
