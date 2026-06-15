# Phase 2: Auth + Agent Onboarding - Research

**Researched:** 2026-06-13
**Domain:** Firebase Auth + next-firebase-auth-edge + Cloudflare Workers + Next.js App Router
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth Page Layout & Flow**
- Auth pages (register/login/reset-password) use a standalone centered card layout — no site Header/Footer
- After registration, agent lands on a "Check your email" confirmation page with a resend button
- After successful login: `/dashboard` if profile complete; `/dashboard/profile` if required fields missing — enforced in dashboard layout
- Client-side instant feedback (email format, password >= 8 chars) plus server error banner on Firebase rejection

**Session & Route Protection**
- Middleware protects `/dashboard/*` and `/admin/*` — all other routes remain public
- Unauthenticated access redirects to `/login?redirect=/original-path`
- Profile completeness gate enforced in `/dashboard/layout.tsx` server component — reads D1 agent row
- Middleware reads Firebase token `admin` claim and blocks `/admin/*` with 403 before page renders

**Agent Dashboard Shell Design**
- Left sidebar: Listings, Leads, Profile, Billing — hamburger drawer mobile, persistent desktop
- Dashboard has its own layout (no public Header/Footer)
- New agent landing: Welcome card + profile completion progress + "Create your first listing" CTA (disabled until profile complete)

### Claude's Discretion
- Specific color/spacing for auth card and dashboard sidebar — use existing Tailwind `primary-*` / `accent-*` / `gray-*` palette
- Dashboard page content for Listings, Leads, Billing — Phase 2 only scaffolds shells with "Coming soon"
- Firebase Admin SDK setup (custom claims script) — run in Node.js, not Workers runtime

### Deferred Ideas (OUT OF SCOPE)
- Dashboard listing management UI — Phase 4
- Lead inbox UI — Phase 4
- Billing management page with Stripe portal link — Phase 3
- Agent profile photo upload — stays as URL input per project constraints
- OAuth (Google/GitHub) — explicitly out of scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Agent can register with email/password via Firebase Auth (email verification sent) | Firebase client SDK `createUserWithEmailAndPassword` + `sendEmailVerification` patterns; confirmed registration -> verify-email page flow |
| AUTH-02 | Agent can log in; session persists via HttpOnly cookie (`next-firebase-auth-edge`) | `next-firebase-auth-edge` middleware config; `getTokens()` in Server Components; `authMiddleware()` setup; cookie refresh pattern |
| AUTH-03 | Agent can reset password via email link (Firebase built-in) | Firebase client SDK `sendPasswordResetEmail`; reset-password page pattern |
| AUTH-04 | Bernard's account has `admin: true` Firebase custom claim granting admin panel access | One-time Node.js script with `firebase-admin` SDK; middleware `admin` claim check; 403 response pattern |
| AUTH-05 | Agent must complete profile before creating listings (name, photo URL, phone, brokerage, license #) | Dashboard layout RSC reads D1 `agents` row; profile completeness check; redirect to `/dashboard/profile` |
</phase_requirements>

---

## Summary

Phase 2 delivers the complete agent identity layer on top of the Cloudflare Workers + Next.js App Router foundation established in Phase 1. The core challenge is the Workers runtime constraint: `firebase-admin` SDK uses Node.js-only APIs (crypto, net) that throw at Workers runtime. The solution — locked in STATE.md — is `next-firebase-auth-edge`, a purpose-built library that verifies Firebase ID tokens using the Web Crypto API (available in Workers), then mints an HttpOnly cookie session.

The architecture has two clear halves: (1) client-side Firebase Auth SDK (`firebase` npm package) handles all user-facing operations — registration, email verification, login, password reset — running entirely in the browser; (2) `next-firebase-auth-edge` handles everything server-side — middleware token verification, cookie creation/refresh, and Server Component token reads. The two halves communicate via the Firebase ID token: the client SDK signs in the user, obtains an ID token, and POSTs it to a Next.js API route that `next-firebase-auth-edge` exchanges for a signed HttpOnly cookie.

A known risk flagged in STATE.md is that `next-firebase-auth-edge` + `@opennextjs/cloudflare` middleware cookie interaction needs prototype validation. The CONTEXT.md specifics section recommends treating Plan 1 of Phase 2 as a spike: install the library, wire up middleware, and verify the cookie round-trip works in `wrangler dev` before building auth UI on top of it. This is the correct sequencing — build on a confirmed foundation.

**Primary recommendation:** Use `next-firebase-auth-edge@1.12.0` for all server-side session management. Implement Plan 1 as a middleware spike (auth library installed, cookie round-trip validated, no UI). Build auth UI (register/login/reset) in Plan 2. Build dashboard shell + profile form in Plan 3. Set admin claim via one-time `scripts/set-admin-claim.ts` Node.js script in Plan 4.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User registration (email/password) | Browser / Client | — | Firebase client SDK runs in browser; `createUserWithEmailAndPassword` is client-only |
| Email verification send | Browser / Client | — | `sendEmailVerification` called immediately after registration on the client |
| Login / sign-in | Browser / Client | API (cookie exchange) | Client signs in; ID token sent to `/api/auth/session` to mint HttpOnly cookie |
| Session persistence (HttpOnly cookie) | Frontend Server (middleware) | — | `next-firebase-auth-edge` `authMiddleware()` in `middleware.ts` verifies + refreshes cookie on every request |
| Token verification in Server Components | Frontend Server (SSR) | — | `getTokens()` from `next-firebase-auth-edge` reads HttpOnly cookie in RSC |
| Route protection (`/dashboard/*`, `/admin/*`) | Frontend Server (middleware) | — | Middleware runs before page render; redirects unauthenticated; blocks admin with 403 |
| Password reset | Browser / Client | — | `sendPasswordResetEmail` is client-only Firebase SDK call |
| Admin custom claim assignment | API / Backend (Node.js script) | — | `firebase-admin` SDK; NOT deployed to Workers; run once locally |
| Agent profile read (completeness gate) | Frontend Server (SSR) | Database (D1) | `/dashboard/layout.tsx` as RSC queries D1 `agents` table via `env.DB` binding |
| Agent profile update | API / Backend | Database (D1) | `PATCH /api/agent/profile` route writes to D1 `agents` row |
| D1 agent row creation on first login | API / Backend | Database (D1) | `/api/auth/session` API route upserts agent row in D1 after validating Firebase token |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-firebase-auth-edge` | 1.12.0 | HttpOnly cookie sessions, token verification in Workers runtime | Only library that verifies Firebase tokens using Web Crypto API — works in Cloudflare Workers; `firebase-admin` does not |
| `firebase` | 12.14.0 | Client-side Auth SDK — register, login, reset, email verify | Official Firebase client SDK; all client-side auth operations |

Note: `firebase-admin` is NOT used in Workers runtime. It is used only in the one-time `scripts/set-admin-claim.ts` Node.js script (run locally, never deployed to Workers).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase-admin` | latest (devDependency) | Set Bernard's `admin: true` custom claim | Only in `scripts/set-admin-claim.ts`; never imported in app code |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next-firebase-auth-edge` | `firebase-admin` | `firebase-admin` uses Node.js crypto APIs unavailable in Workers runtime — fails at deploy |
| `next-firebase-auth-edge` | Custom JWT verification | Would require hand-rolling Google public key fetching + JWT verify — solved problem |
| HttpOnly cookie session | localStorage token | HttpOnly cookie is XSS-resistant; localStorage is not |

**Installation:**
```bash
npm install next-firebase-auth-edge firebase
npm install --save-dev firebase-admin
```

**Version verification:** [VERIFIED: npm registry]
- `next-firebase-auth-edge@1.12.0` — published 2026-02-26, 25,563 weekly downloads, verdict OK
- `firebase@12.14.0` — published 2026-05-28, 8,152,168 weekly downloads (false positive SUS — official Google SDK)
- `firebase-admin` — devDependency only; not deployed to Workers runtime

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `next-firebase-auth-edge` | npm | ~2 yrs | 25,563/wk | github.com/awinogrodzki/next-firebase-auth-edge | OK | Approved |
| `firebase` | npm | 8+ yrs | 8,152,168/wk | github.com/firebase/firebase-js-sdk | SUS (too-new flag) | Approved — false positive; official Google SDK at massive scale |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `firebase` flagged only because the latest version (12.14.0) was published recently. This is the official Google Firebase JS SDK from the canonical Firebase GitHub org with 8M+ weekly downloads. Not a slopsquatted package. No human-verify checkpoint required.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client)
  |
  |-- firebase SDK: createUserWithEmailAndPassword()
  |-- firebase SDK: signInWithEmailAndPassword() ---[ID Token]---> /api/auth/session (Workers route)
  |-- firebase SDK: sendPasswordResetEmail()                           |
  `-- firebase SDK: sendEmailVerification()                            |-- next-firebase-auth-edge: verify token
                                                                       |-- D1: UPSERT agents row (id=uid, email)
                                                                       `-- Set-Cookie: __session (HttpOnly, Secure, SameSite=Lax)

Every Subsequent Request
  Browser --[Cookie: __session]--> middleware.ts (Workers edge)
                                       |
                                       |-- next-firebase-auth-edge: authMiddleware()
                                       |-- Verify token from cookie
                                       |-- Check custom claims: admin?
                                       |-- /admin/* + no admin claim -> 403
                                       |-- /dashboard/* + no token -> redirect /login?redirect=...
                                       `-- Pass request through (token refreshed in cookie)

/dashboard/layout.tsx (Server Component)
  |
  |-- next-firebase-auth-edge: getTokens(cookies(), credentials) -> { decodedToken }
  |-- D1: SELECT display_name, phone, brokerage, license_number FROM agents WHERE id = uid
  |-- Profile complete? (all four fields non-null)
  |       YES -> render dashboard
  |       NO  -> redirect /dashboard/profile (skip if already there)
  `-- Render sidebar + {children}

scripts/set-admin-claim.ts  (Node.js only -- run once locally)
  `-- firebase-admin: auth().setCustomUserClaims(bernardUid, { admin: true })
```

### Recommended Project Structure

```
src/
|-- app/
|   |-- (auth)/                     # Route group -- no shared layout
|   |   |-- login/page.tsx          # Login form ('use client')
|   |   |-- register/page.tsx       # Registration form ('use client')
|   |   |-- verify-email/page.tsx   # "Check your email" + resend
|   |   `-- reset-password/page.tsx # Password reset request form
|   |-- (dashboard)/                # Route group -- dashboard layout
|   |   |-- layout.tsx              # Session gate + profile gate + sidebar shell
|   |   `-- dashboard/
|   |       |-- page.tsx            # Welcome card + progress + CTA
|   |       |-- profile/page.tsx    # Profile completion form
|   |       |-- listings/page.tsx   # "Coming soon" placeholder
|   |       |-- leads/page.tsx      # "Coming soon" placeholder
|   |       `-- billing/page.tsx    # "Coming soon" placeholder
|   |-- (admin)/
|   |   `-- admin/page.tsx          # Admin shell (guarded in middleware)
|   `-- api/
|       |-- auth/
|       |   `-- session/route.ts    # POST: exchange ID token for cookie; DELETE: logout
|       `-- agent/
|           `-- profile/route.ts    # PATCH: update agent profile fields in D1
|-- components/
|   |-- auth/
|   |   |-- LoginForm.tsx           # 'use client'
|   |   |-- RegisterForm.tsx        # 'use client'
|   |   `-- ResetPasswordForm.tsx   # 'use client'
|   `-- dashboard/
|       |-- Sidebar.tsx             # 'use client' -- mobile toggle state
|       `-- ProfileForm.tsx         # 'use client' -- profile update form
|-- lib/
|   |-- firebase-client.ts          # initializeApp() -- client-side Firebase config
|   `-- auth-edge.ts                # next-firebase-auth-edge shared config object
middleware.ts                        # authMiddleware() from next-firebase-auth-edge
scripts/
`-- set-admin-claim.ts               # Node.js -- firebase-admin setCustomUserClaims()
```

### Pattern 1: Middleware Configuration (next-firebase-auth-edge)

**What:** `authMiddleware()` verifies the HttpOnly session cookie on every protected route request, redirects unauthenticated users, and blocks admin routes for non-admin tokens.

**When to use:** Single entry point for all session verification. All protected routes flow through this.

```typescript
// middleware.ts -- project root [ASSUMED: API from training knowledge; validate against v1.12.0 README]
import { authMiddleware } from 'next-firebase-auth-edge';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: '/api/auth/session',
    logoutPath: '/api/auth/session',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: '__session',
    cookieSignatureKeys: [
      process.env.COOKIE_SECRET_CURRENT!,
      process.env.COOKIE_SECRET_PREVIOUS!,
    ],
    cookieSerializeOptions: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 12, // 12 days
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    handleValidToken: async ({ token, decodedToken }, headers) => {
      if (
        request.nextUrl.pathname.startsWith('/admin') &&
        !decodedToken.admin
      ) {
        return new Response('Forbidden', { status: 403 });
      }
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async (_reason) => {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    },
    handleError: async (error) => {
      console.error('Middleware auth error:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    },
  });
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/api/auth/:path*'],
};
```

### Pattern 2: Session API Route (ID Token -> HttpOnly Cookie)

**What:** Client POSTs Firebase ID token; route verifies it and sets the HttpOnly cookie. Also upserts agent row in D1.

**When to use:** Called immediately after client-side Firebase sign-in succeeds.

```typescript
// src/app/api/auth/session/route.ts [ASSUMED: validate function names against v1.12.0]
import { NextRequest, NextResponse } from 'next/server';
import { createResponse, getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const { idToken } = await request.json() as { idToken: string };

  try {
    const response = await createResponse(request, idToken, authEdgeConfig);
    // Upsert agent row in D1
    const tokens = await getTokens(request.cookies, authEdgeConfig);
    if (tokens?.decodedToken.email_verified) {
      const { env } = getCloudflareContext();
      await env.DB.prepare(
        `INSERT INTO agents (id, email, created_at, updated_at)
         VALUES (?, ?, unixepoch(), unixepoch())
         ON CONFLICT(id) DO UPDATE SET updated_at = unixepoch()`
      ).bind(tokens.decodedToken.uid, tokens.decodedToken.email ?? '').run();
    }
    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Authentication failed' },
      { status: 401 }
    );
  }
}

export async function DELETE(_request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.delete('__session');
  return response;
}
```

### Pattern 3: Client-Side Registration

**What:** Browser-only Firebase SDK calls. After successful registration, send verification email and redirect to confirm page.

```typescript
// src/components/auth/RegisterForm.tsx [ASSUMED]
'use client';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

async function handleRegister(email: string, password: string) {
  // 1. Create user in Firebase Auth
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  // 2. Send verification email
  await sendEmailVerification(user);
  // 3. Exchange ID token for HttpOnly cookie session
  const idToken = await user.getIdToken();
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  // 4. Redirect to confirmation page
  window.location.href = '/verify-email';
}
```

### Pattern 4: Dashboard Layout Session + Profile Gate

**What:** RSC reads the session cookie via `getTokens()`, queries D1 for profile completeness, and conditionally redirects.

```typescript
// src/app/(dashboard)/layout.tsx [ASSUMED]
import { getTokens } from 'next-firebase-auth-edge';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tokens = await getTokens(cookies(), authEdgeConfig);

  if (!tokens) {
    redirect('/login?redirect=/dashboard');
  }

  const { env } = getCloudflareContext();
  const agent = await env.DB.prepare(
    'SELECT display_name, phone, brokerage, license_number FROM agents WHERE id = ?'
  )
    .bind(tokens.decodedToken.uid)
    .first<{
      display_name: string | null;
      phone: string | null;
      brokerage: string | null;
      license_number: string | null;
    }>();

  const isProfileComplete = !!(
    agent?.display_name &&
    agent?.phone &&
    agent?.brokerage &&
    agent?.license_number
  );

  // Get current path to avoid redirect loop on the profile page itself
  const headersList = headers();
  const pathname = headersList.get('x-invoke-path') ?? '';
  if (!isProfileComplete && !pathname.includes('/dashboard/profile')) {
    redirect('/dashboard/profile');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isProfileComplete={isProfileComplete} />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
```

### Pattern 5: Shared Auth Edge Config

**What:** Single source of truth for `next-firebase-auth-edge` config — imported by middleware, API routes, and layouts.

```typescript
// src/lib/auth-edge.ts [ASSUMED]
export const authEdgeConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: '__session',
  cookieSignatureKeys: [
    process.env.COOKIE_SECRET_CURRENT!,
    process.env.COOKIE_SECRET_PREVIOUS!,
  ],
  cookieSerializeOptions: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 12,
  },
  serviceAccount: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
};
```

### Pattern 6: Admin Custom Claim Script (Node.js only)

```typescript
// scripts/set-admin-claim.ts [ASSUMED]
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp({ credential: cert('./serviceAccountKey.json') });
const uid = process.env.BERNARD_UID!; // Bernard's Firebase UID from Firebase Console

await getAuth(app).setCustomUserClaims(uid, { admin: true });
console.log(`Admin claim set for uid: ${uid}`);
process.exit(0);
```

Run with: `npx tsx scripts/set-admin-claim.ts` (requires `tsx` devDependency and `serviceAccountKey.json` locally — never committed to git).

### Anti-Patterns to Avoid

- **Importing `firebase-admin` in any app code:** Uses `node:crypto` and `node:net` — throws in Cloudflare Workers runtime.
- **Storing Firebase ID token in localStorage:** HttpOnly cookies prevent XSS token theft. Never fall back to localStorage.
- **Calling `getTokens()` in client components:** Only works in RSC and Route Handlers (reads server-side cookies).
- **Skipping the middleware spike:** Do not build auth UI before validating the cookie round-trip works in `wrangler dev`.
- **One config object per file:** Define `authEdgeConfig` once in `src/lib/auth-edge.ts`; import everywhere. Duplication causes drift.
- **Unconditional redirect loop in dashboard layout:** Always check current pathname before redirecting to `/dashboard/profile`; otherwise the profile page itself redirects again.
- **Not checking `email_verified` in session route:** An unverified user who obtains a cookie bypasses the email verification requirement. Always check `decodedToken.email_verified === true` before setting cookie.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firebase token verification in Workers | Custom JWT + Google public key fetch | `next-firebase-auth-edge` `authMiddleware()` | Key rotation, clock skew, edge cases already handled |
| HttpOnly cookie signing + refresh | Custom HMAC + cookie rotation | `next-firebase-auth-edge` `createResponse()` | Token expiry, double-submit protection already handled |
| Password reset flow | Custom token + email send | `firebase.sendPasswordResetEmail()` | Firebase handles token generation, email, link expiry |
| Email verification | Custom verification token | `firebase.sendEmailVerification()` | Firebase built-in; reliable, idempotent |
| Admin claim enforcement | Role table in D1 + middleware lookup | Firebase custom claims (`admin: true`) in JWT | Claims travel with every token; no D1 query in middleware |

**Key insight:** Firebase Auth + `next-firebase-auth-edge` together cover 100% of the session management surface. All custom code is limited to: (1) D1 upsert on session creation, (2) profile completeness gate reading D1, and (3) profile update writing to D1.

---

## Common Pitfalls

### Pitfall 1: Firebase private key newline escaping

**What goes wrong:** `FIREBASE_PRIVATE_KEY` contains `\n` newline characters. When stored as a Wrangler secret, the newlines are often double-escaped to `\\n`, causing JWT signing to fail with cryptic "invalid signature" errors.

**How to avoid:** Always apply `.replace(/\\n/g, '\n')` when reading the key from env. Store the raw PEM via `wrangler secret put FIREBASE_PRIVATE_KEY`.

**Warning signs:** `Error: error:09091064:PEM routines` or "Failed to verify token" in middleware logs.

### Pitfall 2: Middleware matcher too broad

**What goes wrong:** If matcher includes `/_next/*` or `/favicon.ico`, auth middleware runs on every static asset request.

**How to avoid:** Use explicit paths: `['/dashboard/:path*', '/admin/:path*', '/api/auth/:path*']`. Never use catch-all.

### Pitfall 3: next-firebase-auth-edge + @opennextjs/cloudflare cookie compatibility

**What goes wrong:** Middleware may not correctly forward `Set-Cookie` headers when running through the OpenNext adapter.

**How to avoid:** Plan 1 MUST be a spike: install library, wire middleware, verify cookie round-trip in `wrangler dev` before building any auth UI. This is the highest-risk item in the phase.

**Warning signs:** Login appears to succeed client-side but subsequent requests show user as unauthenticated.

### Pitfall 4: Profile completeness redirect loop

**What goes wrong:** Layout redirects to `/dashboard/profile` when profile is incomplete. If profile page is a child of the same layout, it triggers the same check — infinite redirect.

**How to avoid:** Check current pathname in layout before redirecting; skip redirect if already on `/dashboard/profile`.

### Pitfall 5: `getCloudflareContext()` not available in `next dev`

**What goes wrong:** `getCloudflareContext()` throws in `next dev` (Node.js runtime) because there are no Cloudflare bindings.

**How to avoid:** Always use `npm run cf:preview` (`wrangler dev`) for testing D1 queries. The `initOpenNextCloudflareForDev()` from Phase 1 provides mock bindings only in wrangler dev.

### Pitfall 6: NEXT_PUBLIC_ env vars in Cloudflare build

**What goes wrong:** Firebase client config must be `NEXT_PUBLIC_` prefixed. Wrangler `[vars]` only provides server-side vars; client bundle may not have them.

**How to avoid:** Confirm during spike that `NEXT_PUBLIC_` vars are statically inlined at `cf:build` time. Add them to `wrangler.toml [vars]` with the `NEXT_PUBLIC_` prefix AND verify a client component can read them after build.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `firebase-admin` in Next.js API routes | `next-firebase-auth-edge` in middleware (Web Crypto) | Cloudflare Workers adoption (2023+) | firebase-admin cannot run in Workers |
| `getServerSideProps` for auth checks | RSC + `getTokens()` in layout | Next.js 13+ App Router | Layouts as auth gates replace per-page auth checks |
| `@cloudflare/next-on-pages` | `@opennextjs/cloudflare` | Phase 1 (complete) | Already migrated; no action needed |

**Deprecated/outdated:**
- `firebase-admin` in Workers: Incompatible with Workers runtime. Use `next-firebase-auth-edge` instead.
- `@cloudflare/next-on-pages`: Already replaced in Phase 1.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `authMiddleware()` API signature matches code example (v1.12.0) | Pattern 1 | Middleware won't compile; must check library README during spike |
| A2 | `createResponse()` is the correct function for session cookie creation in v1.12.0 | Pattern 2 | Session route fails; may be `setAuthCookies()` or different name |
| A3 | `getTokens(cookies(), credentials)` signature correct for v1.12.0 in App Router RSC | Pattern 4 | Layout gate broken; tokens cannot be read server-side |
| A4 | `@opennextjs/cloudflare` correctly passes `Set-Cookie` response headers from middleware | Pitfall 3 | Cookie sessions fail entirely — highest risk item |
| A5 | Firebase `NEXT_PUBLIC_` env vars are statically inlined at `cf:build` time | Pitfall 6 | Firebase client SDK cannot initialize |
| A6 | `getCloudflareContext()` available in Route Handlers (not just Server Components) | Pattern 2 | D1 upsert in session route fails |
| A7 | `x-invoke-path` header available in RSC `headers()` for current pathname | Pattern 4 | Redirect loop prevention broken; need alternative approach |

**A1-A4 MUST be validated during the Plan 1 middleware spike before building auth UI.**

---

## Open Questions

1. **Exact `next-firebase-auth-edge` v1.12.0 function names**
   - What we know: The library creates session cookies and reads tokens
   - What's unclear: Whether it's `createResponse()`, `setAuthCookies()`, or another name
   - Recommendation: Read v1.12.0 GitHub README during Plan 1 spike before coding

2. **Cookie compatibility with @opennextjs/cloudflare v1.19.x**
   - What we know: Library documents Cloudflare Workers support
   - What's unclear: Specific compatibility with OpenNext v1.19.x
   - Recommendation: Plan 1 spike validates end-to-end; check library GitHub issues if broken

3. **NEXT_PUBLIC_ vars in Cloudflare build**
   - What we know: Next.js statically inlines these at build time
   - What's unclear: Whether OpenNext's `cf:build` passes them correctly
   - Recommendation: Test in spike with a logged client-side value

4. **Bernard's Firebase UID for admin claim script**
   - What we know: Bernard registers via the same form; UID assigned by Firebase
   - What's unclear: How Bernard retrieves his UID
   - Recommendation: Plan 4 instructions include: Firebase Console -> Authentication -> Users -> copy UID

5. **Pathname detection in RSC for redirect loop prevention**
   - What we know: RSC does not have access to `usePathname()` (client hook)
   - What's unclear: Most reliable way to get current pathname in a layout RSC
   - Recommendation: Use `headers().get('x-invoke-path')` or pass current path via searchParams; validate during implementation

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `scripts/set-admin-claim.ts` | Yes | 20.11.0 (pinned) | — |
| wrangler | D1 local dev, cookie testing | Yes | 4.99.0 | — |
| Firebase project (credentials) | All auth flows | Must exist — not verified | — | Cannot proceed without Firebase project configured |
| D1 database (local) | Agent profile reads | Yes (Phase 1 complete) | — | — |
| D1 database (remote) | Production agent reads | Yes (Phase 1 complete) | — | — |

**Missing dependencies with no fallback:**
- Firebase project credentials (API key, project ID, client email, private key) must be configured before Phase 2 executes. If Bernard has not yet created a Firebase project, Plan 1 spike will be blocked.

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Firebase Auth (email/password, email verification, password reset) |
| V3 Session Management | YES | `next-firebase-auth-edge` HttpOnly cookie; 12-day maxAge; Secure + SameSite=Lax |
| V4 Access Control | YES | Middleware: unauthenticated -> redirect; non-admin -> 403 on `/admin/*`; profile gate in layout |
| V5 Input Validation | YES | Client: email format, password >= 8 chars; server: D1 PATCH validates required fields non-empty |
| V6 Cryptography | YES — handled by library | `next-firebase-auth-edge` uses Web Crypto API for JWT verification; cookie signed with HMAC; never hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session token theft via XSS | Information Disclosure | HttpOnly cookie — JS cannot read; prevents token extraction |
| CSRF on session creation/deletion | Tampering | SameSite=Lax on cookie; POST body requires Content-Type application/json |
| Admin route access by non-admin | Elevation of Privilege | Middleware reads `admin` claim from signed JWT; claim is tamper-evident |
| Weak password brute force | Elevation of Privilege | Firebase Auth built-in rate limiting; password >= 8 chars |
| Firebase private key exposure | Information Disclosure | Store as Wrangler secret; never in `wrangler.toml [vars]` or git |
| Unverified email accessing dashboard | Elevation of Privilege | Check `email_verified === true` in session route before setting cookie |

**Critical:** The session route MUST verify `decodedToken.email_verified === true` before setting the HttpOnly cookie. Skipping this allows unverified users to bypass email confirmation.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Framework: Next.js App Router — no rewrite | All auth pages use App Router patterns (RSC + 'use client') |
| Auth: Firebase Auth — not Clerk/NextAuth/Supabase | Confirmed — this phase implements Firebase Auth |
| Database: Cloudflare D1 | Agent profile stored in D1 `agents` table |
| Deployment: Cloudflare Pages + Workers | `next-firebase-auth-edge` must work in Workers runtime |
| No file upload / no R2 in v1 | Profile photo is URL input only |
| Files under 500 lines | Auth form components, layout, and API routes must each stay under 500 lines |
| Validate input at system boundaries | Profile PATCH validates all fields; session route validates idToken presence |
| `try/catch` wrapping all handler logic | All API routes wrap in try/catch; return `{ success: boolean, message: string }` |
| Import alias `@/` for all internal imports | All imports use `@/lib/...`, `@/components/...` etc. |
| Named export + default export for reusable components | All dashboard/auth components follow this pattern |
| `console.error` for server errors only | No console.log in production code |
| Accessibility: 44px touch targets, aria-labels | Auth forms and sidebar nav use `.touch-target`, `aria-label` on all interactive elements |
| Double quotes for JSX string attributes | Enforced by existing ESLint config |
| NEVER commit secrets/credentials | `serviceAccountKey.json` and `.env.local` must be gitignored |

---

## Sources

### Primary (MEDIUM confidence)
- npm registry — `next-firebase-auth-edge@1.12.0`: version, downloads, repo, published date confirmed [VERIFIED: npm registry]
- npm registry — `firebase@12.14.0`: version, downloads, repo, published date confirmed [VERIFIED: npm registry]
- `package.json` — existing dependencies, scripts, Node version [VERIFIED: codebase]
- `wrangler.toml` — D1 binding name (`DB`), compatibility flags, service binding [VERIFIED: codebase]
- `db/migrations/0001_initial_schema.sql` — `agents` table schema (all profile fields) [VERIFIED: codebase]
- `.planning/phases/02-auth-agent-onboarding/02-CONTEXT.md` — locked decisions [VERIFIED: codebase]
- `.planning/phases/02-auth-agent-onboarding/02-UI-SPEC.md` — design system constraints [VERIFIED: codebase]
- `CLAUDE.md` — project conventions and constraints [VERIFIED: codebase]
- `STATE.md` — architectural decisions (firebase-admin blocked in Workers, next-firebase-auth-edge chosen) [VERIFIED: codebase]

### Tertiary (LOW confidence)
- Code examples tagged [ASSUMED] — derived from training knowledge of next-firebase-auth-edge API patterns; must be validated against v1.12.0 actual README during Plan 1 spike

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — packages verified on registry; API signatures assumed from training data
- Architecture: HIGH — tier mapping derived from locked decisions and verified codebase constraints
- Pitfalls: MEDIUM — runtime pitfalls verified from project constraints; cookie compat is a known open question
- Code examples: LOW — all tagged [ASSUMED]; must be validated against v1.12.0 library README during spike

**Research date:** 2026-06-13
**Valid until:** 2026-07-13

**Context note:** Context was near exhaustion when research was written. Context7 docs lookup was skipped to preserve context. All code examples are [ASSUMED] from training knowledge and MUST be validated against the actual next-firebase-auth-edge v1.12.0 README during the Plan 1 prototype spike before any auth UI is built.
