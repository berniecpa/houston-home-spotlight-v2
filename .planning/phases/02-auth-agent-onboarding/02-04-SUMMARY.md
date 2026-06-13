---
phase: 02-auth-agent-onboarding
plan: 04
subsystem: admin
tags: [auth-04, firebase-admin, admin-claim, admin-shell, route-protection, cloudflare-workers-boundary]

# Dependency graph
requires:
  - phase: 02-auth-agent-onboarding
    plan: 01
    provides: middleware.ts wired with admin claim check (decodedToken.admin -> 403)
  - phase: 02-auth-agent-onboarding
    plan: 03
    provides: (dashboard)/layout.tsx pattern to mirror for admin shell
provides:
  - scripts/set-admin-claim.ts (Node.js-only one-time admin claim setter via firebase-admin)
  - src/app/(admin)/layout.tsx (red-800 sidebar shell + ADMIN badge)
  - src/app/(admin)/admin/page.tsx (/admin RSC shell, Phase 5 placeholder)
  - src/tests/admin-claim.test.ts (Workers-runtime boundary guard + structural checks)
  - package.json admin:set-claim script
affects: [05-admin-panel -- the admin claim and protected route shell are preconditions]

# Tech tracking
tech-stack:
  added:
    - firebase-admin@14 (devDependency -- Node.js only, never deployed to Workers)
    - tsx@4 (devDependency -- TypeScript runner for Node.js scripts)
  patterns:
    - firebase-admin confined to scripts/ only -- importsFirebaseAdmin() test guard enforces the Workers boundary
    - Admin route shell delegates auth enforcement to middleware -- no redundant getTokens() call in layout
    - Admin layout mirrors dashboard layout structure with red-800 sidebar swap
    - BERNARD_UID read from process.env at runtime -- never hardcoded

key-files:
  created:
    - scripts/set-admin-claim.ts
    - src/app/(admin)/layout.tsx
    - src/app/(admin)/admin/page.tsx
    - src/tests/admin-claim.test.ts
  modified:
    - package.json (admin:set-claim script added; firebase-admin + tsx devDependencies)
    - package-lock.json (lockfile updated)

key-decisions:
  - "Admin layout does not call getTokens() -- middleware is the single enforcement point for the admin claim; re-checking in the layout would add latency and create drift risk if config diverges"
  - "firebase-admin boundary guard excludes *.test.ts files -- test files run in Node.js only and are never deployed to Workers; the guard is for app/lib code, not test infrastructure"
  - "Admin route group (admin) uses Next.js route group convention matching RESEARCH architecture diagram; the URL is /admin (not /(admin)/admin -- the route group parentheses are transparent)"

requirements-completed: [AUTH-04]

# Metrics
duration: ~7min
completed: 2026-06-13T23:26:43Z
tasks-completed: 1
tasks-total: 2
files-created: 4
---

# Phase 02, Plan 04: Admin Claim + Admin Route Shell Summary

**Firebase admin custom-claim setter script (Node.js-only), red-sidebar admin route shell, and Workers-runtime boundary guard tests -- delivering AUTH-04 privilege boundary**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-13T23:20:00Z
- **Completed:** 2026-06-13T23:26:43Z
- **Tasks:** 1 auto task completed + 1 checkpoint (human-action, deferred per autonomous directive)
- **Files created:** 4

## Accomplishments

- Installed `firebase-admin@14` and `tsx@4` as devDependencies; confirmed they are isolated to scripts/ and never reach app code
- Created `scripts/set-admin-claim.ts`: Node.js-only script using `firebase-admin` `setCustomUserClaims()`. Reads `BERNARD_UID` from env with clear error instructions if unset; includes sign-out reminder; exits cleanly after setting the claim
- Added `"admin:set-claim": "tsx scripts/set-admin-claim.ts"` to package.json scripts
- Confirmed `serviceAccountKey.json` already gitignored (added in Plan 02-01)
- Created `src/app/(admin)/layout.tsx`: red-800 sidebar shell with ADMIN badge (red-100 text on red-700 bg) per UI-SPEC Admin Layout contract; mirrors dashboard layout structure; delegates auth enforcement to middleware
- Created `src/app/(admin)/admin/page.tsx`: RSC shell with "Admin Panel" heading (Merriweather serif, text-2xl) and "Admin tools coming in Phase 5." placeholder (text-gray-400); robots noindex/nofollow metadata
- Created `src/tests/admin-claim.test.ts`: 8 tests covering Workers-runtime boundary guard (no firebase-admin in app/src, excluding test files), script existence + setCustomUserClaims, BERNARD_UID env var usage, admin shell file content, package.json script entry, .gitignore exclusion
- npm test: 622 pass / 43 fail (pre-existing cross-machine failures unchanged -- +8 new passing tests); typecheck clean

## Task Commits

1. **feat(02-04): admin claim script, guarded (admin) route shell, boundary tests** -- `d92a4b9`

## Files Created/Modified

| File | Role |
|------|------|
| `scripts/set-admin-claim.ts` | Node.js-only firebase-admin script; sets admin:true on BERNARD_UID; exits with clear instructions if env var missing |
| `src/app/(admin)/layout.tsx` | Admin shell: red-800 sidebar, ADMIN badge (red-100/red-700), Platform Administration footer; defers auth to middleware |
| `src/app/(admin)/admin/page.tsx` | /admin RSC: "Admin Panel" + "Admin tools coming in Phase 5." placeholder; robots noindex |
| `src/tests/admin-claim.test.ts` | 8 tests: firebase-admin boundary guard, script structural checks, shell file content, package.json script, .gitignore |
| `package.json` | Added admin:set-claim script; firebase-admin@14 + tsx@4 devDependencies |
| `package-lock.json` | Updated lockfile for new devDependencies |

## Decisions Made

- **Admin layout delegates to middleware:** The middleware already enforces the admin claim check (Plan 02-01, `decodedToken.admin -> 403`). Calling `getTokens()` again in the layout would add latency and create a second enforcement point that could drift. Middleware is the single gate; the layout is the shell only.
- **firebase-admin boundary guard excludes test files:** The `importsFirebaseAdmin()` scan in admin-claim.test.ts skips `*.test.ts` files. Test files run in Node.js only and never reach Cloudflare Workers, so they are exempt. The guard is for production app/lib code.
- **BERNARD_UID guard is strict:** The script calls `process.exit(1)` with detailed instructions if `BERNARD_UID` is unset or empty. This prevents the script from silently doing nothing if run without the env var.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Firebase-admin boundary guard false positive on test file itself**
- **Found during:** Task 1 verification (`npm test`)
- **Issue:** The `collectSourceFiles()` helper initially included `*.test.ts` files. The test file `admin-claim.test.ts` itself contains the string `'firebase-admin'` in regex patterns and JSDoc comments, causing the boundary guard to flag the test file as a violator.
- **Fix:** Updated `collectSourceFiles()` to exclude `*.test.ts` files from the scan. Test files run in Node.js only and are never deployed to Workers; the boundary guard is for app/lib production code. Added an inline comment explaining the rationale.
- **Files modified:** `src/tests/admin-claim.test.ts`

## Known Stubs

- `src/app/(admin)/admin/page.tsx` contains the intentional Phase 5 placeholder "Admin tools coming in Phase 5." This is by design -- Phase 5 will fill the admin panel with listing moderation, agent management, and other admin tools. The placeholder ensures the route exists and renders correctly for middleware gate tests.
- The admin sidebar nav renders only "Admin Panel" as a single nav item. Phase 5 will add additional admin navigation items (agents, listings, reports, etc.).

## Threat Surface

All STRIDE mitigations from the plan threat model are implemented:

| Threat | Mitigation |
|--------|-----------|
| T-02-17: non-admin reaching /admin | Middleware (Plan 02-01) reads admin claim from signed JWT, returns 403; claim is tamper-evident |
| T-02-18: forging admin claim client-side | Custom claims in Firebase-signed ID token; cannot be forged without Firebase's signing key |
| T-02-19: service account key leakage | serviceAccountKey.json gitignored (Plan 02-01); confirmed by .gitignore test + admin-claim.test.ts |
| T-02-20: firebase-admin reaching Workers runtime | admin-claim.test.ts asserts no src/ file imports firebase-admin; firebase-admin is devDependency in scripts/ only |
| T-02-SC: npm install supply chain | firebase-admin is official Google Admin SDK (devDependency); tsx is widely-used TS runner; both are legitimate |

No new network endpoints, auth paths, or schema changes beyond what is in the plan's threat model.

## Deferred Human Validation

Per autonomous directive, the Task 2 `checkpoint:human-action` (gate="blocking") is deferred. All automated work is complete. The following steps require Bernard to perform manually once Firebase credentials are provisioned:

### Prerequisites

1. Enable Email/Password sign-in in Firebase Console (if not already done)
2. Run D1 migration: `npm run db:migrate:local`
3. Download service account key: Firebase Console -> Project Settings -> Service accounts -> Generate new private key -> save as `./serviceAccountKey.json` (project root, already gitignored)
4. Confirm `git status` does NOT list `serviceAccountKey.json`
5. Find Bernard's UID: Firebase Console -> Authentication -> Users -> find bernardcpa@gmail.com -> copy User UID

### Run the Admin Claim Script

```bash
BERNARD_UID=<paste-uid-here> npm run admin:set-claim
```

Expected console output:
```
Admin claim set successfully for uid: <uid>

IMPORTANT: Bernard must sign out and sign back in (or wait up to
1 hour for the token to auto-refresh) for the admin claim to take
effect. ...
```

### Validate Live Behavior

After running the script and signing back in as Bernard:

1. With `npm run cf:preview` running, visit `/admin` as Bernard. Expected: red-sidebar Admin Panel shell with ADMIN badge and "Admin tools coming in Phase 5."
2. As a standard (non-admin) agent, visit `/admin`. Expected: 403 Forbidden response (blocked by middleware before any page renders).
3. While logged out (no session cookie), visit `/admin`. Expected: redirect to `/login?redirect=/admin` (handleInvalidToken in middleware).
4. Inspect Bernard's token: `decodedToken.admin === true` (can verify in next-firebase-auth-edge logs or by reading decoded token in a test route).

## Self-Check: PASSED

Files verified as present:
- `scripts/set-admin-claim.ts`: EXISTS (contains setCustomUserClaims, process.env.BERNARD_UID)
- `src/app/(admin)/layout.tsx`: EXISTS (contains red-800, ADMIN badge)
- `src/app/(admin)/admin/page.tsx`: EXISTS (contains "Admin Panel", "Admin tools coming in Phase 5")
- `src/tests/admin-claim.test.ts`: EXISTS (8 tests, all pass)
- `package.json`: EXISTS (contains admin:set-claim script, firebase-admin devDep)

Commits verified:
- `d92a4b9`: feat(02-04) -- present

npm run typecheck: PASS (clean)
npm test: 622 pass / 43 fail (43 pre-existing cross-machine failures; +8 new passing tests from this plan; no new failures)

---
*Phase: 02-auth-agent-onboarding*
*Completed: 2026-06-13*
