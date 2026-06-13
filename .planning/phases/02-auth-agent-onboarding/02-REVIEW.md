---
phase: 02-auth-agent-onboarding
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/lib/firebase-errors.ts
  - src/lib/profile.ts
  - src/lib/auth-edge.ts
  - src/app/api/agent/profile/route.ts
  - src/app/api/auth/session/route.ts
  - middleware.ts
  - src/components/auth/AuthCard.tsx
  - src/components/auth/ErrorBanner.tsx
  - src/components/auth/LoginForm.tsx
  - src/components/auth/RegisterForm.tsx
  - src/components/auth/ResetPasswordForm.tsx
  - src/components/dashboard/DashboardSidebar.tsx
  - src/components/dashboard/ProfileCompletionBar.tsx
  - src/components/dashboard/ProfileForm.tsx
  - src/components/dashboard/WelcomeCard.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/(auth)/reset-password/page.tsx
  - src/app/(auth)/check-email/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/dashboard/profile/page.tsx
  - src/app/(dashboard)/dashboard/listings/page.tsx
  - src/app/(dashboard)/dashboard/leads/page.tsx
  - src/app/(dashboard)/dashboard/billing/page.tsx
  - src/app/(admin)/layout.tsx
  - src/app/(admin)/admin/page.tsx
  - scripts/set-admin-claim.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-13
**Depth:** standard
**Files Reviewed:** 28 (26 in-scope + middleware.ts and session route.ts read as call-chain dependencies)
**Status:** issues_found

## Summary

Phase 2 delivers Firebase Auth (register/login/reset/verify), an agent dashboard with a
profile-completeness gate, the profile PATCH API, and an admin shell. The core security
primitives are largely correct: the profile PATCH route derives `uid` from the verified
session and never from the body, all D1 access is parameterized via `.bind()`, the session
route enforces an `email_verified` gate, and the admin-claim script is correctly confined to
`devDependencies` with `serviceAccountKey.json` gitignored.

However, the review surfaced three blocking defects centered on the **mismatch between the
documented security model and the implemented code**, plus a stored-input-validation gap on
`photo_url`:

1. The `(dashboard)` layout and pages call `getCloudflareContext`/D1 but **no file in the
   route group exports `runtime = 'edge'` or `dynamic = 'force-dynamic'`** — while the PATCH
   route's own header comment insists "Runtime must be edge." Combined with the catch-all
   "non-fatal, continue" handlers, this produces a **fail-open profile gate**.
2. `photo_url` is stored with no scheme/URL validation, then rendered into `<img src>` — a
   `javascript:`/`data:` value is persisted and reflected.
3. Firebase error copy distinguishes "no account found" from "incorrect password," enabling
   **account enumeration** on `/login` and `/reset-password`.

The authentication boundary itself (middleware + `getTokens` returning null → redirect, plus
the middleware admin-claim 403 gate) is sound; the blocking defects are in input validation,
fail-open behavior, and information disclosure rather than a raw auth bypass.

## Critical Issues

### CR-01: `photo_url` stored without URL validation, then rendered into `<img src>` (stored-input / XSS-adjacent)

**File:** `src/app/api/agent/profile/route.ts:91-132`, `src/components/dashboard/ProfileForm.tsx:214-223`

**Issue:** The PATCH route validates `photo_url` only as "non-empty trimmed string"
(`route.ts:99-106`, with `photo_url` in the `requiredFields` list at line 94). It accepts
arbitrary values such as `javascript:alert(1)`, `data:text/html,...`, or an attacker-controlled
tracking URL and persists them verbatim to D1. The value is then rendered directly into
`<img src={previewUrl}>` in `ProfileForm.tsx:216` and is destined for public agent/listing
display in later phases. React does **not** sanitize `src` attributes. Because the field
bypasses any scheme allow-list at the system boundary, a malicious or compromised agent stores
hostile URLs that other surfaces reflect. This violates CLAUDE.md "Validate input at system
boundaries."

**Fix:** Enforce an `http(s)` scheme allow-list server-side before binding:
```ts
function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
// after the string/trim check, for the photo_url field:
if (!isSafeHttpUrl(photo_url.trim())) {
  return NextResponse.json(
    { success: false, message: 'Photo URL must be a valid http(s) URL.' },
    { status: 400 }
  );
}
```
Mirror the same check in `ProfileForm.validateField` so the preview never binds a
`javascript:`/`data:` URL.

### CR-02: Fail-open profile gate — D1 read failure is swallowed and treated as "incomplete," while missing edge/dynamic runtime makes the failure path reachable in production

**File:** `src/app/(dashboard)/layout.tsx:70-104`; affected siblings `src/app/(dashboard)/dashboard/page.tsx:52-71`, `src/app/(dashboard)/dashboard/profile/page.tsx:56-81`

**Issue:** The dashboard layout wraps the D1 read in `try/catch` and on any error sets
`agent = null` → `profileComplete = false` (lines 80-86), with a comment that explicitly says
"this should not fail — log and continue without gate" (lines 81-84). The PATCH route declares
`export const runtime = 'edge'` (`route.ts:28`) so `getCloudflareContext` resolves there, but
**neither `(dashboard)/layout.tsx` nor any `(dashboard)/**/page.tsx` declares `runtime = 'edge'`
or `dynamic = 'force-dynamic'`** (verified: no `runtime`/`dynamic` export in any dashboard
segment). Under `@opennextjs/cloudflare`, a cookie- and D1-reading segment without an explicit
dynamic/edge declaration can be evaluated outside the worker binding context, in which case
`getCloudflareContext` throws, the catch fires, and the gate silently degrades. A gate whose own
error path "continues without the gate" is fail-open, and the page-level reads silently fall
back to an empty agent — masking real production failures and making a transient D1 error
indistinguishable from a brand-new empty profile.

**Fix:** (1) Add explicit dynamic rendering to the layout and every D1-reading dashboard page:
```ts
export const dynamic = 'force-dynamic';
export const runtime = 'edge';
```
(2) Make the gate fail-closed: if the D1 read *throws* (as opposed to legitimately returning a
row with empty fields), redirect to a safe holding state rather than rendering the dashboard.
Do not treat "could not determine profile" identically to "profile readable but incomplete."

### CR-03: Account enumeration via differentiated auth error copy on /login and /reset-password

**File:** `src/lib/firebase-errors.ts:40-41`, `src/components/auth/ResetPasswordForm.tsx:100-105`, `src/components/auth/LoginForm.tsx:167-172`

**Issue:** `firebaseErrorMessage` returns the distinct string *"No account found with this email.
Create an account."* for `auth/user-not-found` (lines 40-41), versus *"Incorrect password..."*
for wrong-password. On `/login` and especially `/reset-password`, this lets an unauthenticated
attacker enumerate which email addresses have accounts (submit an email → "No account found" vs.
a generic success). For a paid-agent marketplace this discloses the customer list.
`sendPasswordResetEmail` surfaces `auth/user-not-found` to the client unless the form normalizes
it.

**Fix:** Collapse `auth/user-not-found` into the generic/invalid-credential message, and make
`/reset-password` always show the same neutral success state regardless of whether the account
exists:
```ts
case 'auth/user-not-found':
case 'auth/invalid-credential':
  return 'Incorrect email or password. Try again or reset your password.';
```
In `ResetPasswordForm.handleSubmit`, treat `auth/user-not-found` as success (still set
`submitted = true`) so existing vs. non-existing emails are indistinguishable.

## Warnings

### WR-01: Redirect-loop guard depends on spoofable / adapter-dependent request headers

**File:** `src/app/(dashboard)/layout.tsx:93-104`

**Issue:** The profile-completion redirect skip is decided by reading `x-matched-path` /
`next-url` / `x-invoke-path` from the incoming request headers and doing
`matchedPath.startsWith('/dashboard/profile')` (lines 94-100). These headers are client-visible
in some proxy/adapter configurations, and their presence under `@opennextjs/cloudflare` is
explicitly hedged in the file's own comment ("may be unreliable"). If all three are absent,
`matchedPath = ''`, `onProfilePage = false`, and an incomplete agent already *on*
`/dashboard/profile` is redirect-looped to `/dashboard/profile` — the exact Pitfall-4 bug the
guard was meant to prevent. If a header is spoofable, an incomplete agent bypasses the gate on
other dashboard routes.

**Fix:** Do not derive the current path from free-form request headers. Implement the
profile-completion redirect per-segment (e.g., only the non-profile pages perform the gate, or
pass the segment via route context), or anchor on a header Next.js guarantees and overwrites,
with a default that fails toward *showing the profile form* rather than looping.

### WR-02: Login does not sign the Firebase client out when the session route rejects (403 unverified)

**File:** `src/components/auth/LoginForm.tsx:151-162`

**Issue:** When `/api/auth/session` returns 403 (email not verified), the form shows an error and
`return`s, but `auth.currentUser` remains a fully authenticated Firebase client session. No
HttpOnly cookie is minted (the server boundary holds), but the client SDK now holds an
authenticated user for an unverified account, which the `check-email` resend flow and any future
client-gated UI will treat as "logged in." This is an inconsistent auth state and a latent
bypass surface for client-only gates added later.

**Fix:** On a non-OK session response, `await signOut(auth)` before returning so client and
server auth state stay consistent.

### WR-03: PATCH updates a possibly-nonexistent agent row and reports success for zero rows affected

**File:** `src/app/api/agent/profile/route.ts:114-134`

**Issue:** The handler runs `UPDATE agents ... WHERE id = ?` and unconditionally returns
`{ success: true }` (line 134) without checking `meta.changes`. If the session is valid but the
agent row was never upserted (the session-route upsert at `session/route.ts:90-105` is explicitly
"non-fatal" and is skipped when `env.DB` is falsy or on a D1 error), the UPDATE affects 0 rows
and the user is told "Profile updated." — data silently lost. The route also never checks
`decodedToken.email_verified`, so any token reaching this route writes profile data regardless
of verification state.

**Fix:** Inspect the result and 409/404 when nothing was written (or use an upsert):
```ts
const result = await env.DB.prepare(`UPDATE agents SET ... WHERE id = ?`).bind(...).run();
if (!result.meta || result.meta.changes === 0) {
  return NextResponse.json(
    { success: false, message: 'Profile record not found. Please sign in again.' },
    { status: 409 }
  );
}
```

### WR-04: DELETE /api/auth/session is unauthenticated and accepts cross-site invocation

**File:** `src/app/api/auth/session/route.ts:128-144`, `src/lib/auth-edge.ts:29`

**Issue:** The sign-out handler removes the cookie with no session check and no origin/CSRF
guard. The session cookie is `sameSite: 'lax'`, which does not protect non-GET cross-site
requests in all browsers/embeddings. A cross-site page could trigger a forced sign-out (logout
CSRF). Low impact (no data exposure) but it is an unauthenticated state-changing endpoint.

**Fix:** Add a same-origin check (verify `Origin`/`Referer` against the deployment host) on POST
and DELETE, or set the session cookie to `sameSite: 'strict'` if the redirect flows allow it.

### WR-05: D1 read errors are swallowed across three RSC files, masking production failures

**File:** `src/app/(dashboard)/layout.tsx:80-84`, `src/app/(dashboard)/dashboard/page.tsx:69-71`, `src/app/(dashboard)/dashboard/profile/page.tsx:79-81`

**Issue:** All three catch a D1 failure, `console.error`, and continue with an empty/`null`
agent. The comments justify this as "dev environment where D1 is unavailable," but the same code
runs in production. A real D1 outage in production is indistinguishable from a fresh empty
profile: the user sees a blank profile form and, if they re-save, may overwrite good data
(compounding WR-03). There is no signal (no 5xx, no error banner) that the read failed.

**Fix:** Distinguish "running locally without a binding" from "production D1 error." In
production, surface a degraded-state UI or throw to the Next.js error boundary instead of
rendering an empty-but-successful-looking profile.

### WR-06: `register` fires a session-cookie request whose result is discarded

**File:** `src/components/auth/RegisterForm.tsx:167-176`, `src/app/api/auth/session/route.ts:79-88`

**Issue:** Registration immediately POSTs the fresh ID token to `/api/auth/session` (lines
167-173), then unconditionally `router.push('/check-email')` with no `if (!res.ok)` check. The
session route correctly rejects the unverified token with 403 today (so no cookie is minted), but
the silently discarded response means any future relaxation of the route — or a 500 — is
invisible to the flow, and a transient cookie-set path would mint a session for an unverified
user. The stated intent ("mint cookie after verification") and the code ("POST immediately,
ignore result") disagree.

**Fix:** Either drop the `/api/auth/session` POST from the register flow (user verifies, then
logs in), or check the response and surface failures. Do not fire a state-changing auth request
whose result is discarded.

## Info

### IN-01: Contradictory runtime declaration — PATCH route insists on edge, sibling D1 readers omit it

**File:** `src/app/api/agent/profile/route.ts:27-28` vs. `src/app/(dashboard)/layout.tsx` (no runtime export)

**Issue:** The PATCH route comments "Runtime must be edge for Cloudflare Workers compatibility"
and exports it; the dashboard layout/pages do identical D1 work without the export. The
inconsistency is the maintenance trap underlying CR-02. Standardize the runtime/dynamic
declaration across all Worker-executing routes and segments.

### IN-02: `set-admin-claim.ts` correctly Node-only — add a guard rail to keep it out of the edge bundle

**File:** `scripts/set-admin-claim.ts:7-9`, `scripts/set-admin-claim.ts:53-54`

**Issue:** Confirmed: `firebase-admin` is in `devDependencies`, `serviceAccountKey.json` is
gitignored and not committed, and the script reads the key from `./serviceAccountKey.json` rather
than embedding a secret — all good. Residual risk: `firebase-admin` (Node-only `node:crypto`,
`node:net`) must never be imported from any `src/` module that reaches the Workers bundle. No such
import exists today; add an ESLint `no-restricted-imports` rule banning `firebase-admin` under
`src/` to keep it that way.

### IN-03: Email regex is permissive and duplicated across three forms

**File:** `src/components/auth/LoginForm.tsx:29`, `RegisterForm.tsx:31`, `ResetPasswordForm.tsx:26`

**Issue:** `^[^\s@]+@[^\s@]+\.[^\s@]+$` is copy-pasted in three files. Not a security issue
(Firebase is the authority), but it should live in `src/lib/` to avoid drift.

### IN-04: Photo preview `onError` hides the img but never resets `previewUrl`

**File:** `src/components/dashboard/ProfileForm.tsx:220-222`

**Issue:** On image load error the handler sets `display:none`, leaving the gray placeholder
behind it — acceptable visually — but it never clears `previewUrl`, so a stored bad URL persists
in state and re-renders on every keystroke. Prefer clearing `previewUrl` to fall back to the
semantic placeholder branch.

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
