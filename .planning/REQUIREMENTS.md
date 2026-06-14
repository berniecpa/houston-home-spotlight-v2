# Requirements: Houston Home Spotlight — Real Estate Marketplace

**Defined:** 2026-06-10
**Core Value:** Agents can publish Houston listings in minutes and receive buyer inquiries directly — the platform earns recurring subscription revenue while buyers get a curated, always-current marketplace.

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: Platform deploys to Cloudflare Workers via `@opennextjs/cloudflare` (replaces archived `@cloudflare/next-on-pages`)
- [x] **INFRA-02**: `output: 'export'` is removed; dynamic API routes and middleware work at runtime
- [x] **INFRA-03**: Cloudflare D1 schema is applied (agents, listings, subscriptions, leads tables)
- [x] **INFRA-04**: Wrangler local dev workflow runs D1 locally via `initOpenNextCloudflareForDev()`
- [x] **INFRA-05**: GitHub Actions deploy pipeline updated to use OpenNext build + wrangler deploy

### Authentication

- [x] **AUTH-01**: Agent can register with email and password via Firebase Auth (email verification sent)
- [x] **AUTH-02**: Agent can log in and session persists via HttpOnly cookie (`next-firebase-auth-edge`)
- [x] **AUTH-03**: Agent can reset password via email link (Firebase built-in)
- [x] **AUTH-04**: Bernard's account has `admin: true` Firebase custom claim granting admin panel access
- [x] **AUTH-05**: Agent must complete profile before creating listings (name, photo URL, phone, brokerage, license #)

### Listings

- [ ] **LIST-01**: Agent can create a listing with title, address, price, beds, baths, sqft, description, and photo URLs
- [ ] **LIST-02**: Agent can edit any of their own listings
- [ ] **LIST-03**: Agent can delete their own listings
- [ ] **LIST-04**: Agent can paste multiple image URLs per listing
- [ ] **LIST-05**: Agent can toggle a listing between active and paused status
- [ ] **LIST-06**: Listings are hidden from public browse when agent's subscription lapses past 7-day grace period
- [ ] **LIST-07**: All listing data is stored in Cloudflare D1 (migrated from static JSON files)
- [ ] **LIST-08**: Existing public listing URLs (`/listings/[slug]`) are preserved after migration

### Billing

- [x] **BILL-01**: Agent can subscribe via Stripe Checkout ($79/month, single tier, no setup fee)
- [x] **BILL-02**: Agent can self-manage subscription via Stripe Customer Portal (update card, cancel, view invoices)
- [x] **BILL-03**: Platform handles Stripe webhooks: `customer.subscription.created`, `customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- [x] **BILL-04**: Agent's subscription status and 7-day grace period are stored on the D1 `agents` row and enforced in every listing SQL query
- [x] **BILL-05**: Stripe webhook events are idempotent (event log table prevents duplicate processing)

### Leads

- [ ] **LEAD-01**: Buyer can submit an inquiry on any listing detail page (name, email, phone, message)
- [ ] **LEAD-02**: Inquiry is saved to Cloudflare D1 `leads` table linked to the listing and agent
- [ ] **LEAD-03**: Agent receives an email notification via Resend for every new inquiry on their listing
- [ ] **LEAD-04**: Bernard receives a CC email on every inquiry regardless of which agent owns the listing
- [ ] **LEAD-05**: Agent can view all inquiries for their listings in a dashboard lead inbox

### Admin

- [ ] **ADMIN-01**: Bernard can view a list of all registered agents with account status
- [ ] **ADMIN-02**: Bernard can suspend or unsuspend any agent (suspended agents' listings are hidden)
- [ ] **ADMIN-03**: Bernard can view platform stats: total agents, active subscriptions, total listings, total leads
- [ ] **ADMIN-04**: Each agent has a public profile page at `/agents/[slug]` displaying their name, photo, brokerage, and active listings

### AI Video Generation

- [ ] **VIDEO-01**: Agent can trigger AI video generation from a listing's dashboard page
- [ ] **VIDEO-02**: Platform submits an async job to Kie.ai with the listing's photo URLs and returns a task ID immediately
- [ ] **VIDEO-03**: Platform polls Kie.ai for job completion and writes the `video_url` to the listing row in D1
- [ ] **VIDEO-04**: Listing detail page displays the generated video when `video_url` is present
- [ ] **VIDEO-05**: Platform retries or falls back to HiggsField/alternative provider on Kie.ai failure

## v2 Requirements

### Advanced Features

- **V2-01**: Annual subscription pricing option ($790/year — ~2 months free)
- **V2-02**: Second subscription tier ($129/month) with AI video generation included
- **V2-03**: Photo file upload to Cloudflare R2 (supplement to URL paste)
- **V2-04**: Listing performance analytics per listing (view count, inquiry count)
- **V2-05**: Houston neighborhood SEO pages (ISR; hyperlocal buyer search targeting)
- **V2-06**: SMS lead notifications to agent (Twilio or similar)
- **V2-07**: Stripe coupon/referral codes for early adopter discounts
- **V2-08**: Direct BytePlus/Seedance API integration (cost optimization from Kie.ai at scale)

### Platform Growth

- **V2-09**: Team/brokerage sub-accounts (multiple agents under one brokerage billing)
- **V2-10**: Built-in CRM lite (lead pipeline stages: new → contacted → showing → closed)
- **V2-11**: MLS/IDX data feed integration (requires data licensing negotiation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Buyer accounts / buyer dashboard | Anonymous browsing converts without auth complexity; adds no agent value in v1 |
| Photo file upload (R2) | URL paste avoids storage infra; agents already host photos via MLS, Google Drive, etc. |
| MLS/IDX integration | Expensive data licensing and legal complexity; manual entry is sufficient for launch |
| Map search / school district filter | Engineering-heavy; price+beds filter covers v1 buyer needs |
| SMS notifications | Email is sufficient for v1 lead notifications |
| Multi-tenancy white-labeling | All agents share one platform brand in v1 |
| Built-in CRM | Leads route to agents' existing tools; out of scope to build a CRM |
| OAuth login (Google/GitHub) | Email/password is sufficient; agents are professionals, not consumers |
| Blog / content management | Listings-only platform; no editorial content needed |
| International/multi-market listings | Houston area only; no geo-expansion in v1 |

## Traceability

Updated 2026-06-10 — roadmap created, all 37 v1 requirements mapped.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| BILL-01 | Phase 3 | Complete |
| BILL-02 | Phase 3 | Complete |
| BILL-03 | Phase 3 | Complete |
| BILL-04 | Phase 3 | Complete |
| BILL-05 | Phase 3 | Complete |
| LIST-01 | Phase 4 | Pending |
| LIST-02 | Phase 4 | Pending |
| LIST-03 | Phase 4 | Pending |
| LIST-04 | Phase 4 | Pending |
| LIST-05 | Phase 4 | Pending |
| LIST-06 | Phase 4 | Pending |
| LIST-07 | Phase 4 | Pending |
| LIST-08 | Phase 4 | Pending |
| LEAD-01 | Phase 4 | Pending |
| LEAD-02 | Phase 4 | Pending |
| LEAD-03 | Phase 4 | Pending |
| LEAD-04 | Phase 4 | Pending |
| LEAD-05 | Phase 4 | Pending |
| ADMIN-01 | Phase 5 | Pending |
| ADMIN-02 | Phase 5 | Pending |
| ADMIN-03 | Phase 5 | Pending |
| ADMIN-04 | Phase 5 | Pending |
| VIDEO-01 | Phase 6 | Pending |
| VIDEO-02 | Phase 6 | Pending |
| VIDEO-03 | Phase 6 | Pending |
| VIDEO-04 | Phase 6 | Pending |
| VIDEO-05 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-10*
*Last updated: 2026-06-10 after roadmap creation*
