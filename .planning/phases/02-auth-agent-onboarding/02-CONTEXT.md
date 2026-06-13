# Phase 2: Auth + Agent Onboarding - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the complete agent identity layer: registration, email verification, persistent session login, password reset, profile completion, and admin access for Bernard. After this phase, agents can authenticate and complete their profile — the precondition for all subsequent agent-facing features (listings, billing, leads).

The phase covers:
- Firebase Auth integration (email/password, email verification, password reset)
- `next-firebase-auth-edge` middleware for HttpOnly cookie sessions on Cloudflare Workers
- Protected route structure (`/dashboard/*`, `/admin/*`)
- Agent profile form (name, photo URL, phone, brokerage, license number)
- Bernard's admin custom claim and admin route protection
- Dashboard shell with left sidebar navigation

</domain>

<decisions>
## Implementation Decisions

### Auth Page Layout & Flow
- Auth pages (register/login/reset-password) use a standalone centered card layout — no site Header/Footer; cleaner auth UX, avoids nav distraction
- After registration, agent lands on a "Check your email" confirmation page with a resend button (clear next step before dashboard access)
- After successful login, agent lands at `/dashboard` if profile complete; `/dashboard/profile` if required fields missing — enforced in dashboard layout
- Client-side instant feedback for form validation (email format, password ≥ 8 chars) plus server error banner on Firebase rejection

### Session & Route Protection
- Middleware protects `/dashboard/*` and `/admin/*` — all other routes remain public
- Unauthenticated access to protected routes redirects to `/login?redirect=/original-path` (preserves intent)
- Profile completeness gate enforced in `/dashboard/layout.tsx` server component — reads D1 agent row, redirects to `/dashboard/profile` if name/phone/brokerage/license missing
- Middleware reads Firebase token `admin` claim and blocks `/admin/*` routes with 403 before page renders

### Agent Dashboard Shell Design
- Left sidebar navigation: Listings, Leads, Profile, Billing — standard SaaS pattern with room for growth
- Dashboard has its own layout (no public Header/Footer) — clean separation between public marketplace and agent app
- New agent landing: Welcome card + profile completion progress (% complete) + "Create your first listing" CTA (CTA disabled until profile complete)
- Responsive sidebar: hamburger-toggled drawer on mobile, persistent on desktop

### Claude's Discretion
- Specific color/spacing for auth card and dashboard sidebar — use existing Tailwind `primary-*` / `accent-*` / `gray-*` palette from globals.css
- Dashboard page content for Listings, Leads, Billing — Phase 2 only scaffolds shells; content comes in later phases
- Firebase Admin SDK setup (for custom claims script) — run in Node.js environment, not in Workers runtime

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tailwind utility classes: `.card`, `.container-custom`, `.btn-primary`, `.btn-accent`, `.touch-target`, `primary-*`, `accent-*`, `gray-*` — use throughout auth pages and dashboard
- `src/app/globals.css` — all custom utilities and brand palette defined here
- `src/app/layout.tsx` — RootLayout with fonts, Header, Footer, analytics; dashboard layout will be separate
- `src/components/InquiryForm.tsx` — client form pattern with useState, error state, submit handler — reference for auth forms
- `src/components/Header.tsx` — `'use client'` + useState for mobile menu — pattern for dashboard sidebar toggle

### Established Patterns
- `'use client'` directive for interactive components (forms, state); RSC default for display components
- Named export + default export for reusable components; default only for pages/layouts
- `[ComponentName]Props` interface defined immediately before the component
- `try/catch` wrapping all handler logic; `{ success: boolean, message: string }` API response shape
- `console.error` for server-side errors; inline error banners in client components (no toast library)
- Imports use `@/` alias for all internal paths

### Integration Points
- `src/app/layout.tsx` — RootLayout is the public shell; dashboard layout will not use it (separate layout file)
- `src/app/api/leads/route.ts` — existing API route pattern; auth API routes follow same structure
- `src/lib/data.ts` — D1 queries for agents table will follow same try/catch pattern
- Cloudflare Worker binding `env.DB` — D1 client access in API routes and server components
- `middleware.ts` at project root — Next.js middleware entry point for `next-firebase-auth-edge`

</code_context>

<specifics>
## Specific Ideas

- The STATE.md blocker notes: "`next-firebase-auth-edge` + `@opennextjs/cloudflare` middleware cookie interaction needs prototype validation before building all auth-dependent routes." The planning phase should treat Phase 2, Plan 1 as a spike/prototype: install `next-firebase-auth-edge`, wire middleware, verify cookie round-trip in wrangler dev — then build the full auth UI on confirmed foundation.
- Bernard's admin custom claim is set via a one-time Node.js script (`scripts/set-admin-claim.ts`) using Firebase Admin SDK — not deployed to Workers runtime (firebase-admin is incompatible with Workers edge runtime).
- Dashboard sidebar nav items for Phase 2: Listings (placeholder), Leads (placeholder), Profile (active — form), Billing (placeholder). Placeholder pages show "Coming soon" — Phase 2 only delivers the shell + profile.

</specifics>

<deferred>
## Deferred Ideas

- Dashboard listing management UI — Phase 4 (after billing gates listing creation)
- Lead inbox UI — Phase 4
- Billing management page with Stripe portal link — Phase 3
- Agent profile photo upload — stays as URL input per project constraints (no R2 in v1)
- OAuth (Google/GitHub) — explicitly out of scope per REQUIREMENTS.md

</deferred>
