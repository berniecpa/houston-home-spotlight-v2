# Roadmap: Houston Home Spotlight v2 — Real Estate Marketplace

## Overview

Starting from a fully-static Next.js export, this roadmap transitions Houston Home Spotlight into a live SaaS marketplace in six sequential phases. Each phase is an architectural gate for the next: the Cloudflare Workers migration unlocks auth, auth unlocks billing, billing unlocks listing CRUD, listing CRUD unlocks admin polish, and admin polish unlocks AI video — the differentiating revenue multiplier. Every phase ends with a coherent, demonstrable capability that could ship independently.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Migration** - Migrate from static export to Cloudflare Workers with D1 schema applied (completed 2026-06-13)
- [x] **Phase 2: Auth + Agent Onboarding** - Agents can register, log in, and complete their profiles (completed 2026-06-13)
- [x] **Phase 3: Subscription Billing** - Agents can subscribe via Stripe and manage their billing (completed 2026-06-14)
- [ ] **Phase 4: Listings, Migration, and Leads** - Full listing CRUD, public page migration from JSON to D1, and buyer lead routing
- [ ] **Phase 5: Admin Panel + Agent Profiles** - Bernard admin tools and public agent profile pages
- [ ] **Phase 6: AI Video Generation** - Agents can generate listing videos via Kie.ai async job pipeline

## Phase Details

### Phase 1: Infrastructure Migration

**Goal**: The platform deploys to Cloudflare Workers with dynamic routes working, D1 schema applied, and local dev running against D1 — unblocking all subsequent feature work
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):

  1. `npm run build && wrangler deploy` succeeds and the production site serves the existing public listing pages without regression
  2. A test API route (`/api/health`) returns a JSON response from the Cloudflare Worker runtime (confirming `output: 'export'` is removed and dynamic routes work)
  3. `wrangler d1 migrations apply` applies the schema and all four tables (agents, listings, subscriptions, leads) exist in both local and remote D1
  4. `wrangler dev` starts locally with D1 bindings resolved via `initOpenNextCloudflareForDev()` — no "D1 binding not found" errors
  5. GitHub Actions deploy workflow runs the OpenNext build and wrangler deploy steps, and the pipeline passes on push to main

**Plans**: 3 plans
Plans:

- [x] 01-01-PLAN.md — Install @opennextjs/cloudflare adapter; rewrite wrangler.toml; update package.json and next.config.mjs; fix /api/leads env vars; rewrite deployment tests
- [x] 01-02-PLAN.md — Create D1 migration SQL (6 tables); create /api/health route; generate CloudflareEnv types; provision D1 and apply schema locally
- [x] 01-03-PLAN.md — Rewrite GitHub Actions deploy workflow for Workers; verify CI pipeline passes end-to-end

### Phase 2: Auth + Agent Onboarding

**Goal**: Agents can register, verify their email, log in with a persistent session, reset their password, and complete their profile — and Bernard's account has admin access
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):

  1. An agent can register with email and password, receive a verification email, and land on the dashboard after verifying
  2. An agent who closes and reopens the browser remains logged in (HttpOnly cookie session persists)
  3. An agent can request a password reset email and use the link to set a new password
  4. Bernard can access `/admin` routes; an unregistered or standard-agent account receives a 403 when attempting the same
  5. An agent who has not filled in name, phone, brokerage, and license number is blocked from creating listings and redirected to their profile form

**Plans**: 4 plansPlans:
**Wave 1**

- [x] 02-01-PLAN.md — Spike: install next-firebase-auth-edge + firebase, wire middleware + shared authEdgeConfig + client init + /api/auth/session, validate HttpOnly cookie round-trip in wrangler dev (AUTH-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Auth UI vertical slice: register + email verification, login with persistent session, password reset; standalone auth cards + Firebase error mapping (AUTH-01, AUTH-02, AUTH-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Dashboard shell + AUTH-05 profile-completion gate: sidebar, profile form + PATCH /api/agent/profile, welcome card, placeholder pages (AUTH-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Admin claim script (Node-only firebase-admin) + guarded /admin shell with red theme; non-admin gets 403 (AUTH-04)

**UI hint**: yes

### Phase 3: Subscription Billing

**Goal**: Agents can subscribe to the platform via Stripe Checkout and self-manage their billing, and the platform correctly tracks subscription state (including grace periods) in D1 via webhooks
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05
**Success Criteria** (what must be TRUE):

  1. An agent can complete Stripe Checkout for the $79/month plan and their D1 `agents` row reflects `subscription_status = active` within seconds of payment
  2. An agent can open the Stripe Customer Portal from their dashboard, update their card, and cancel their subscription — all without contacting Bernard
  3. When a test Stripe webhook fires `invoice.payment_failed`, the agent's `subscription_status` transitions to `grace` with `subscription_grace_until` set 7 days out; a second webhook for `customer.subscription.deleted` transitions it to `lapsed`
  4. Resending the same Stripe webhook event twice does not create a duplicate processing record (idempotency log prevents double-processing)
  5. An agent dashboard widget shows current subscription status and renewal date drawn from D1

**Plans**: TBD

### Phase 4: Listings, Migration, and Leads

**Goal**: Agents with active subscriptions can create, edit, and delete listings stored in D1; the three existing static JSON listings are migrated and all public URLs preserved; buyers can submit inquiries that route to both the listing agent and Bernard via email
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06, LIST-07, LIST-08, LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05
**Success Criteria** (what must be TRUE):

  1. An agent with an active subscription can create a listing with all required fields and multiple photo URLs; the listing appears on the public `/listings` page within one ISR revalidation cycle
  2. An agent can edit and delete only their own listings; attempting to edit another agent's listing returns a 403
  3. A listing owned by an agent whose subscription has lapsed beyond the 7-day grace period does not appear on the public `/listings` browse page or respond to direct slug URLs
  4. The three existing listings (`heights-bungalow-historic`, `riverside-terrace-modern-craftsman`, `sugarland-estate-pool`) are accessible at their original `/listings/[slug]` URLs and served from D1 with no visual regression
  5. A buyer submits an inquiry on any listing detail page; the inquiry is saved to D1; the listing agent receives an email via Resend; Bernard receives a CC email on the same inquiry
  6. The listing agent can view all their received inquiries in a dashboard lead inbox, including the buyer's name, email, phone, and message

**Plans**: TBD
**UI hint**: yes

### Phase 5: Admin Panel + Agent Profiles

**Goal**: Bernard can manage all agents and view platform health from an admin panel, and every agent has a public profile page with their active listings
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):

  1. Bernard can view a paginated list of all registered agents showing their name, email, subscription status, and account status
  2. Bernard can suspend an agent and that agent's listings immediately disappear from the public browse page; unsuspending the agent restores their listings
  3. Bernard can view a platform stats page showing total agents, active subscriptions, total listings, and total leads
  4. Every agent has a public profile page at `/agents/[slug]` displaying their name, photo, brokerage, and all their active listings — accessible without login

**Plans**: TBD
**UI hint**: yes

### Phase 6: AI Video Generation

**Goal**: Agents can trigger AI video generation for a listing; the platform submits an async job to Kie.ai, polls for completion, and surfaces the video on the listing detail page — with retry and fallback on failure
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: VIDEO-01, VIDEO-02, VIDEO-03, VIDEO-04, VIDEO-05
**Success Criteria** (what must be TRUE):

  1. An agent can click "Generate Video" on a listing dashboard page and immediately receive confirmation that the job was submitted (no spinner longer than 2 seconds — job is async)
  2. After Kie.ai completes processing (30-90s), the listing's D1 row has a non-null `video_url` and the listing detail page displays the video without a manual page refresh
  3. When Kie.ai returns a failure status, the platform retries or falls back to HiggsField, and the agent sees a "generation failed — retrying" status rather than a silent error
  4. Submitting duplicate "Generate Video" requests for the same listing does not spawn multiple concurrent jobs

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Migration | 3/3 | Complete    | 2026-06-13 |
| 2. Auth + Agent Onboarding | 4/4 | Complete    | 2026-06-13 |
| 3. Subscription Billing | 3/3 | Complete    | 2026-06-14 |
| 4. Listings, Migration, and Leads | 0/TBD | Not started | - |
| 5. Admin Panel + Agent Profiles | 0/TBD | Not started | - |
| 6. AI Video Generation | 0/TBD | Not started | - |
