---
phase: 02-auth-agent-onboarding
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Register with a real email and 8+ char password via /register"
    expected: "Account created, verification email received, lands on /check-email; resend button sends second email and shows 3-second 'Email sent!' feedback"
    why_human: "Requires a provisioned Firebase project with Email/Password enabled and live email delivery (sendEmailVerification)"
  - test: "Verify email link, then log in at /login"
    expected: "After clicking Firebase verification link, /login succeeds and redirects to /dashboard; __session HttpOnly cookie visible in DevTools Application > Cookies"
    why_human: "Cookie round-trip through next-firebase-auth-edge + @opennextjs/cloudflare adapter requires a live Workers runtime (cf:preview) with valid Firebase credentials"
  - test: "Persistent session across browser restart"
    expected: "Close and reopen browser; revisit /dashboard — still authenticated, no redirect to /login"
    why_human: "Session persistence is a live browser behavior; HttpOnly cookie maxAge (12 days) cannot be confirmed without a real browser session"
  - test: "Unverified email guard on /login"
    expected: "Register second account but do NOT verify email; attempt login -> blocked with verification error banner; no __session cookie set; Firebase client state signed out"
    why_human: "Requires a real Firebase project to produce an unverified account and confirm 403 is returned and client is signed out"
  - test: "Redirect preservation"
    expected: "While logged out, visit /dashboard; redirected to /login?redirect=/dashboard; after login, land back on /dashboard"
    why_human: "End-to-end redirect behavior requires the live middleware + auth flow"
  - test: "Password reset via /reset-password — live delivery and account-enumeration check"
    expected: "Submit a registered email -> inline 'Check your inbox — a reset link is on its way.' (form replaced, no navigation); reset email arrives; submit an unregistered email -> same neutral success state (no account enumeration)"
    why_human: "Requires live Firebase project with sendPasswordResetEmail delivering real emails; CR-03 account-enumeration fix needs live test to confirm both paths look identical"
  - test: "Profile gate: new agent redirected to /dashboard/profile and blocked from other dashboard routes"
    expected: "Log in as fresh agent (empty profile); redirected immediately to /dashboard/profile; attempt /dashboard/listings -> redirected back to /dashboard/profile (no redirect loop)"
    why_human: "Profile gate uses x-matched-path headers whose presence under @opennextjs/cloudflare must be confirmed on a live Workers runtime"
  - test: "Complete agent profile and confirm D1 persistence"
    expected: "Fill name, photo URL (https:// image), phone, brokerage, license number; photo preview appears on blur; save -> green 'Profile saved.' banner; navigate to /dashboard -> no redirect; 'Profile 100% complete' shown; D1 SELECT confirms saved values"
    why_human: "D1 write and router.refresh() gate re-evaluation require a live Workers + D1 binding"
  - test: "Invalid photo URL rejected by ProfileForm"
    expected: "Enter 'javascript:alert(1)' as Photo URL -> inline validation error 'Photo URL must be a valid http(s) URL.' before form submits"
    why_human: "Client-side isSafeHttpUrl validation is exercised in the browser; server-side 400 also needs a live HTTP call to confirm"
  - test: "Bernard's admin claim and /admin route protection"
    expected: "After running BERNARD_UID=<uid> npm run admin:set-claim and re-authenticating, Bernard loads /admin with red-sidebar + ADMIN badge; standard agent visiting /admin gets 403; logged-out user redirected to /login"
    why_human: "Requires Bernard to download a service account key, find his Firebase UID, run the Node.js claim setter, re-authenticate, and validate via cf:preview"
  - test: "Fail-closed dashboard gate under D1 outage (production)"
    expected: "If D1 is unavailable in production, dashboard layout fails closed (routes to profile page) rather than rendering a misleading empty profile form"
    why_human: "Simulating a D1 outage requires a real Cloudflare Workers deployment; code is structurally correct but live confirmation is needed"
---

# Phase 02: Auth + Agent Onboarding Verification Report

**Phase Goal:** Agents can register, verify their email, log in with a persistent session, reset their password, and complete their profile — and Bernard's account has admin access.
**Verified:** 2026-06-13
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can register with email/password, receives verification email, lands on /check-email | VERIFIED (code) | `RegisterForm.tsx`: `createUserWithEmailAndPassword` -> `sendEmailVerification` -> `router.push('/check-email')`. WR-06 fix: discarded session POST removed. Live email delivery: human needed. |
| 2 | Agent can log in; session persists via HttpOnly cookie (`__session`) | VERIFIED (code) | `LoginForm.tsx`: `signInWithEmailAndPassword` -> `getIdToken` -> `POST /api/auth/session` -> redirect. `session/route.ts`: `setAuthCookies` (confirmed v1.12.0 API). Cookie round-trip in live Workers: human needed. |
| 3 | Agent can reset password via email link | VERIFIED (code) | `ResetPasswordForm.tsx`: `sendPasswordResetEmail` -> inline success state. CR-03 fix: `auth/user-not-found` also sets `submitted = true` (neutral, same path as real email). Live delivery: human needed. |
| 4 | Bernard's account has `admin: true` Firebase custom claim; non-admin/unauthenticated /admin access returns 403 | VERIFIED (code) | `scripts/set-admin-claim.ts`: `setCustomUserClaims(uid, { admin: true })`. `middleware.ts` line 44: `!decodedToken.admin` -> 403. `package.json`: `admin:set-claim` script. Live execution: human needed. |
| 5 | Agent must complete profile (name, phone, brokerage, license) before accessing dashboard beyond /dashboard/profile | VERIFIED (code) | `(dashboard)/layout.tsx`: `getTokens` + D1 SELECT + `isProfileComplete` gate. CR-02 fix: `export const dynamic = 'force-dynamic'; export const runtime = 'edge'`. `readFailed` flag fails closed. Live gate behavior: human needed. |

**Code-level score:** 5/5 truths verified in the codebase.

---

## Requirement Coverage

| Requirement | Description | Plan | Code Status | Live Status |
|-------------|-------------|------|-------------|-------------|
| AUTH-01 | Agent registers with email/password; verification email sent | 02-02 | SATISFIED | human needed |
| AUTH-02 | Session persists via HttpOnly cookie (`next-firebase-auth-edge`) | 02-01, 02-02 | SATISFIED | human needed |
| AUTH-03 | Password reset via email link (Firebase built-in) | 02-02 | SATISFIED | human needed |
| AUTH-04 | Bernard's account has `admin: true` Firebase custom claim; /admin protected | 02-04 | SATISFIED | human needed |
| AUTH-05 | Agent must complete profile before creating listings; gate enforced server-side | 02-03 | SATISFIED | human needed |

All 5 phase requirements (AUTH-01 through AUTH-05) are claimed and implemented in the codebase. No orphaned requirements.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/auth-edge.ts` | Single `authEdgeConfig` object | VERIFIED | `cookieName '__session'`, `httpOnly: true`, `sameSite: 'lax'`, two signature keys, private key newline normalization |
| `src/lib/firebase-client.ts` | HMR-safe Firebase app + auth instance | VERIFIED | `getApps().length` guard before `initializeApp`; exports `app` and `auth` |
| `middleware.ts` | `authMiddleware` with matcher; `decodedToken.admin` check | VERIFIED | Matcher: `['/dashboard/:path*', '/admin/:path*']`; 403 on `/admin/*` without admin claim |
| `src/app/api/auth/session/route.ts` | POST (email_verified gate + cookie) + DELETE | VERIFIED | `isSameOrigin` guard; `email_verified` check at line 116; `setAuthCookies`; D1 upsert; `removeAuthCookies` on DELETE |
| `src/lib/firebase-errors.ts` | Error codes mapped to human copy; CR-03 neutral credential message | VERIFIED | `wrong-password`, `user-not-found`, `invalid-credential` -> "Incorrect email or password. Try again or reset your password." |
| `src/components/auth/RegisterForm.tsx` | `createUserWithEmailAndPassword` + `sendEmailVerification` -> `/check-email` | VERIFIED | WR-06: no discarded session POST; clean `router.push('/check-email')` |
| `src/components/auth/LoginForm.tsx` | `signInWithEmailAndPassword` + session POST + `signOut` on 403 + redirect | VERIFIED | WR-02: `await signOut(auth)` on non-OK session response; `searchParams.get('redirect')` for preservation |
| `src/components/auth/ResetPasswordForm.tsx` | `sendPasswordResetEmail` + inline success; neutral on `user-not-found` | VERIFIED | CR-03: `auth/user-not-found` catch sets `submitted = true` |
| `src/app/(auth)/layout.tsx` | Standalone centered layout, no Header/Footer | VERIFIED | `min-h-screen bg-gray-50 flex items-center justify-center`; no public Header/Footer import |
| `src/app/(dashboard)/layout.tsx` | RSC session + profile gate + `edge`/`force-dynamic` + fail-closed | VERIFIED | CR-02: `dynamic='force-dynamic'`, `runtime='edge'`; `readFailed` prevents fail-open |
| `src/app/api/agent/profile/route.ts` | PATCH: session-derived uid, `isSafeHttpUrl`, `meta.changes` check | VERIFIED | CR-01: `isSafeHttpUrl` at line 132; WR-03: 409 on zero changes; `email_verified` gate at line 77 |
| `src/lib/profile.ts` | `isProfileComplete` (4-field) + `completionPercent` (5-field) | VERIFIED | 4-field gate; 5-field bar adds `photo_url`; null and `''` both incomplete |
| `scripts/set-admin-claim.ts` | Node.js-only `setCustomUserClaims`; fails clearly if `BERNARD_UID` unset | VERIFIED | `process.exit(1)` with instructions if env var empty; `firebase-admin` devDependency only |
| `src/app/(admin)/layout.tsx` | Red-800 sidebar + ADMIN badge | VERIFIED | `bg-red-800` sidebar; ADMIN badge `bg-red-700 text-red-100`; no D1 query; delegates auth to middleware |
| `src/app/(admin)/admin/page.tsx` | "Admin Panel" heading + "Admin tools coming in Phase 5." | VERIFIED | Merriweather serif heading; `text-gray-400` body; robots noindex/nofollow |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | `src/lib/auth-edge.ts` | `import authEdgeConfig` | WIRED | Line 16 |
| `src/app/api/auth/session/route.ts` | `src/lib/auth-edge.ts` | `import authEdgeConfig` | WIRED | Line 24 |
| `src/app/api/auth/session/route.ts` | `agents` table | D1 `INSERT INTO agents ... ON CONFLICT DO UPDATE` | WIRED | Lines 130-135; parameterized |
| `src/components/auth/LoginForm.tsx` | `/api/auth/session` | `fetch POST { idToken }` | WIRED | Lines 145-149 |
| `src/app/(dashboard)/layout.tsx` | `src/lib/auth-edge.ts` | `getTokens(cookieStore, authEdgeConfig)` | WIRED | Line 69 |
| `src/app/(dashboard)/layout.tsx` | `agents` table | `SELECT ... FROM agents WHERE id = ?` | WIRED | Lines 87-91; parameterized |
| `src/components/dashboard/ProfileForm.tsx` | `/api/agent/profile` | `fetch PATCH` | WIRED | Confirmed by SUMMARY + passing test suite |
| `src/app/api/agent/profile/route.ts` | `agents` table | `UPDATE agents SET ... WHERE id = ?` | WIRED | Lines 145-163; `meta.changes` checked |
| `middleware.ts` | `/admin/*` 403 gate | `decodedToken.admin` check | WIRED | Lines 43-47 |
| `scripts/set-admin-claim.ts` | Firebase Auth | `setCustomUserClaims(uid, { admin: true })` | WIRED | Line 58 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `(dashboard)/layout.tsx` | `agent` / `profileComplete` | D1 `SELECT ... FROM agents WHERE id = ?` (session uid) | Yes — parameterized query | FLOWING |
| `(dashboard)/dashboard/page.tsx` | `agent` | D1 `SELECT ... FROM agents WHERE id = ?` | Yes — re-throws in production on D1 error (WR-05) | FLOWING |
| `api/agent/profile/route.ts` | UPDATE result | `result.meta.changes` from D1 `prepare().bind().run()` | Yes — 409 on zero changes (WR-03) | FLOWING |
| `src/lib/profile.ts` | helpers | Pure functions over real D1 row passed from layout | Yes | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript typecheck | `npm run typecheck` | Exit 0, no errors | PASS |
| Full test suite | `npm test` | 661 pass / 4 fail (all 4 failures are pre-existing `listing-detail-page.test.ts`, unrelated to Phase 2) | PASS |
| `authEdgeConfig` shape + route exports | `auth-edge.test.ts` suite | PASS (reported in test output) | PASS |
| `firebase-errors` mapping (CR-03 neutral copy) | `firebase-errors.test.ts` suite | PASS | PASS |
| `isProfileComplete` + `completionPercent` behavior | `profile.test.ts` suite | PASS | PASS |
| `firebase-admin` boundary guard | `admin-claim.test.ts` suite | PASS | PASS |
| `email_verified` gate in session route | grep `session/route.ts` | Found at line 116 | PASS |
| `decodedToken.admin` check in middleware | grep `middleware.ts` | Found at line 44 | PASS |
| `isSafeHttpUrl` on photo_url — client + server | grep `ProfileForm.tsx` + `profile/route.ts` | Client line 77, server line 132 | PASS |
| `signOut` on 403 session rejection (WR-02) | grep `LoginForm.tsx` | `await signOut(auth)` at line 156 | PASS |
| `meta.changes === 0` returns 409 (WR-03) | grep `profile/route.ts` | Lines 167-172 | PASS |
| `isSameOrigin` on POST+DELETE (WR-04) | grep `session/route.ts` | Lines 65, 170 | PASS |
| `force-dynamic` + `edge` runtime on dashboard segments | grep dashboard layout + pages | layout.tsx:39-40, page.tsx:28-29, profile/page.tsx:28-29 | PASS |
| `serviceAccountKey.json` gitignored | grep `.gitignore` | Found at line 36 | PASS |
| `firebase-admin` devDependency only | grep `package.json` | `devDependencies` only; no `src/` import | PASS |
| Spike page deleted | file existence check | `src/app/(spike)/spike/page.tsx` does not exist | PASS |

---

## Probe Execution

Step 7c: SKIPPED — no `scripts/tests/probe-*.sh` probes found for this auth phase. All automated verification is via the Node.js test suite and TypeScript typecheck.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `(dashboard)/layout.tsx` | 107-111 | `x-matched-path` / `next-url` / `x-invoke-path` header fallback chain | Info | WR-01 fix applied: null path defaults `onProfilePage = true` (fails toward showing profile form, not redirect loop). Residual spoofability acknowledged in code comment. Acceptable for Phase 2. |
| `(dashboard)/dashboard/page.tsx` | 76-84 | D1 error swallowed in non-production environments | Info | WR-05 fix applied: `if (process.env.NODE_ENV === 'production') throw err`. Development swallow is intentional (binding unavailable in `next dev`). |

No `TBD`, `FIXME`, `XXX`, or unreferenced `PLACEHOLDER` markers found in any Phase 2 source file. No `firebase-admin` import in `src/` production code (boundary guard test passes).

---

## Code Review Integration

A full code review (02-REVIEW.md) identified 3 Critical and 6 Warning findings. All 9 were fixed (02-REVIEW-FIX.md, iteration 1). All fixes confirmed in the actual source files:

| Finding | Fix Applied | Confirmed In Code |
|---------|------------|-------------------|
| CR-01: photo_url XSS | `isSafeHttpUrl()` server-side (400) + client-side validation + preview guard | `profile/route.ts:132`, `ProfileForm.tsx:77,230` |
| CR-02: fail-open gate + missing runtime | `force-dynamic` + `edge` on layout/pages; `readFailed` -> fail-closed | `(dashboard)/layout.tsx:39-40,82,99` |
| CR-03: account enumeration | Neutral copy for `wrong-password`/`user-not-found`/`invalid-credential`; `ResetPasswordForm` treats `user-not-found` as success | `firebase-errors.ts:35-38`, `ResetPasswordForm.tsx:107-109` |
| WR-01: spoofable redirect-loop headers | Null path -> `onProfilePage = true` (safe default) | `(dashboard)/layout.tsx:117-118` |
| WR-02: client state inconsistency on 403 | `await signOut(auth)` on non-OK session response | `LoginForm.tsx:156` |
| WR-03: silent zero-row UPDATE | `meta.changes === 0` -> 409; `email_verified` gate added | `profile/route.ts:77,167-172` |
| WR-04: CSRF on DELETE/POST | `isSameOrigin()` guard on both handlers | `session/route.ts:65,170` |
| WR-05: D1 errors masked in production | `if (process.env.NODE_ENV === 'production') throw err` | `dashboard/page.tsx:82-84`, `profile/page.tsx` |
| WR-06: discarded session POST at registration | Session POST removed from `RegisterForm`; cookie minted only at login | `RegisterForm.tsx:167-174` |

---

## Human Verification Required

### 1. Firebase registration and email verification

**Test:** Run `npm run cf:preview`. Go to `/register`. Create account with real email and 8+ char password.
**Expected:** Landing on `/check-email`; verification email arrives in inbox. Resend button sends second email and shows 3-second "Email sent!" inline feedback. Try 5-char password — expect "Password must be at least 8 characters." inline. Try mismatched confirm — expect "Passwords do not match." inline.
**Why human:** Requires Firebase project with Email/Password enabled and live email delivery.

### 2. Login with persistent HttpOnly session cookie

**Test:** Click Firebase verification link. Go to `/login`. Sign in.
**Expected:** Redirect to `/dashboard`. `__session` cookie in DevTools with HttpOnly=true. Close/reopen browser; revisit `/dashboard` — still authenticated.
**Why human:** Cookie round-trip through `next-firebase-auth-edge` + `@opennextjs/cloudflare` requires the Workers runtime and real Firebase credentials.

### 3. Unverified email blocked at login

**Test:** Register a second account but do NOT click verification link. Attempt login.
**Expected:** Error banner "Your email address has not been verified. Please check your inbox and click the verification link."; no `__session` cookie; Firebase client signed out.
**Why human:** Requires a real unverified Firebase account and live HTTP response inspection.

### 4. Redirect preservation

**Test:** While logged out, navigate to `/dashboard`. Log in.
**Expected:** Middleware redirects to `/login?redirect=/dashboard`. After login, lands on `/dashboard`.
**Why human:** End-to-end middleware + login redirect chain requires live Workers runtime.

### 5. Password reset — live delivery and account-enumeration parity

**Test:** Submit a registered email at `/reset-password`. Submit a non-existent email.
**Expected:** Both yield identical "Check your inbox — a reset link is on its way." inline success (no navigation). Registered email receives reset email. Non-existent email is indistinguishable.
**Why human:** Live email delivery and account-enumeration parity require a real Firebase project.

### 6. Profile gate for new agent (no redirect loop)

**Test:** Log in as a fresh agent (no profile data). Attempt to navigate to `/dashboard/listings`.
**Expected:** Immediately redirected to `/dashboard/profile`. `/dashboard/listings` also redirects to `/dashboard/profile` (no loop back to self).
**Why human:** `x-matched-path` header behavior under `@opennextjs/cloudflare` must be confirmed on a live Workers runtime.

### 7. Profile save and D1 persistence

**Test:** Fill all five profile fields (valid `https://` photo URL). Click "Save profile."
**Expected:** Photo 64x64 preview appears on blur. Green "Profile saved." banner (no navigation). Navigate to `/dashboard` — no redirect. "Profile 100% complete." CTA "Create your first listing" enabled. `wrangler d1 execute DB --local --command "SELECT display_name FROM agents"` shows saved value.
**Why human:** D1 write and `router.refresh()` gate re-evaluation require a live Workers + D1 binding.

### 8. Invalid photo URL rejected by ProfileForm

**Test:** Enter `javascript:alert(1)` as Photo URL in profile form.
**Expected:** Inline validation error "Photo URL must be a valid http(s) URL." before form submits.
**Why human:** Client-side `isSafeHttpUrl` validation is exercised in the browser; server-side 400 also needs a live HTTP call.

### 9. Bernard's admin claim and /admin protection

**Test:** (1) Firebase Console -> Service accounts -> Generate new private key -> save as `./serviceAccountKey.json`. (2) Authentication -> Users -> find bernardcpa@gmail.com -> copy UID. (3) Run `BERNARD_UID=<uid> npm run admin:set-claim`. (4) Sign out and back in as Bernard. (5) Visit `/admin` as Bernard. (6) Visit `/admin` as a standard agent. (7) Visit `/admin` logged out.
**Expected:** Bernard sees red-sidebar Admin Panel shell with ADMIN badge and "Admin tools coming in Phase 5."; standard agent gets 403; logged-out user redirected to `/login?redirect=/admin`.
**Why human:** Requires real Firebase UID, service account key, live claim setter, and Workers runtime for middleware enforcement.

### 10. Fail-closed dashboard gate under D1 error (production)

**Test:** Simulate D1 unavailability in a deployed Workers environment and observe dashboard layout behavior.
**Expected:** Gate fails closed — user is routed to `/dashboard/profile` holding state rather than a misleading empty-but-successful profile form. Production error boundary activates on page-level D1 errors.
**Why human:** Requires a real Cloudflare Workers deployment to simulate a D1 binding error. The code is structurally correct (`readFailed = true` -> fail-closed; `throw err` in production on page-level) but deployment-level confirmation is needed.

---

## Gaps Summary

No automated gaps found. All 5 code-level must-haves are VERIFIED. The outstanding work is entirely in human verification — every deferred item requires a provisioned Firebase project, real email delivery, and a running `cf:preview` Workers environment with D1.

**Prerequisites before human verification can begin:**

1. Enable Email/Password sign-in provider in Firebase Console -> Authentication -> Sign-in method
2. Generate service account private key (Firebase Console -> Project Settings -> Service accounts -> Generate new private key -> save as `./serviceAccountKey.json`)
3. Populate `.dev.vars` with all `FIREBASE_*` and `COOKIE_SECRET_*` values (see `.env.local.example` for the full list)
4. Run `npm run db:migrate:local` to apply D1 schema locally
5. Run `npm run cf:preview` — the Workers runtime is required for session cookies and D1; `npm run dev` is insufficient

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
