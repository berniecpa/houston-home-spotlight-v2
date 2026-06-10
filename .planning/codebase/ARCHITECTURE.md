<!-- refreshed: 2026-06-10 -->
# Architecture

**Analysis Date:** 2026-06-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js App Router (SSG)                   │
├──────────────────┬──────────────────┬───────────────────────────┤
│   Pages (RSC)    │  Pages (Client)  │      API Routes           │
│  `src/app/`      │  `src/app/`      │  `src/app/api/`           │
│  page.tsx (home) │  listings/page   │  leads/route.ts           │
│  listings/[slug] │  contact/page    │                           │
└────────┬─────────┴────────┬─────────┴──────────┬────────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Component Layer                               │
│  `src/components/`                                               │
│  Header, Footer, ListingCard, PhotoGallery                       │
│  InquiryForm (client), FilterBar, PriceFilter, BedsFilter        │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data / Library Layer                          │
│  `src/lib/data.ts`                                               │
│  getAllListings(), getListingBySlug()                            │
│  getFeaturedListings(), filterListings()                         │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Static JSON Data                              │
│  `src/data/listings/*.json`                                      │
│  3 listing files, hardcoded import list in lib layer             │
└─────────────────────────────────────────────────────────────────┘
         │ (API route only)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External: Perfex CRM                          │
│  POST /api/v1/leads (env: PERFEX_RE_URL, PERFEX_RE_KEY)          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| RootLayout | HTML shell, fonts, Header/Footer, analytics script, siteConfig | `src/app/layout.tsx` |
| Home (RSC) | Hero section, featured listings grid, CTA sections | `src/app/page.tsx` |
| ListingsPage | Client-side filter state, load listings, render grid | `src/app/listings/page.tsx` |
| ListingDetailPage | SSG detail view, photo gallery, inquiry form, JSON-LD | `src/app/listings/[slug]/page.tsx` |
| ContactPage | General contact form page | `src/app/contact/page.tsx` |
| ListingsLayout | Metadata export for /listings section | `src/app/listings/layout.tsx` |
| leads route | Validate form data, proxy to Perfex CRM | `src/app/api/leads/route.ts` |
| Header | Site-wide navigation | `src/components/Header.tsx` |
| Footer | Site-wide footer | `src/components/Footer.tsx` |
| ListingCard | Single listing summary card | `src/components/ListingCard.tsx` |
| PhotoGallery | Image gallery viewer (client) | `src/components/PhotoGallery.tsx` |
| InquiryForm | Lead capture form, POSTs to /api/leads (client) | `src/components/InquiryForm.tsx` |
| FilterBar | Composes PriceFilter + BedsFilter (client) | `src/components/FilterBar.tsx` |
| PriceFilter | Price range inputs | `src/components/PriceFilter.tsx` |
| BedsFilter | Bedroom count selector | `src/components/BedsFilter.tsx` |

## Pattern Overview

**Overall:** Next.js App Router with static export (SSG), no runtime server for page rendering

**Key Characteristics:**
- `output: 'export'` in `next.config.mjs` — generates fully static HTML in `dist/`
- Pages default to React Server Components; interactive pages use `'use client'` directive
- Data access is synchronous module-import based (no database, no runtime fetch for listings)
- Module-level `listingsCache` prevents redundant JSON re-imports at build time
- Lead submission is the only server-side runtime operation (API route)

## Layers

**Pages (App Router):**
- Purpose: Route definitions and page-level data assembly
- Location: `src/app/`
- Contains: RSC pages, client pages, API routes, layouts, metadata exports
- Depends on: `src/lib/`, `src/components/`, `src/types/`
- Used by: Next.js router at build time

**Component Layer:**
- Purpose: Reusable UI elements, both server and client components
- Location: `src/components/`
- Contains: Layout chrome (Header, Footer), display components, interactive forms and filters
- Depends on: `src/types/`, Tailwind CSS utility classes
- Used by: Pages in `src/app/`

**Library / Data Layer:**
- Purpose: Data access functions that abstract JSON imports behind an async API
- Location: `src/lib/data.ts` (primary), `src/lib/listings.ts` (duplicate — see Anti-Patterns)
- Contains: `getAllListings`, `getListingBySlug`, `getFeaturedListings`, `filterListings`, `clearListingsCache`
- Depends on: `src/data/listings/*.json`, `src/types/`
- Used by: Pages and API routes

**Type Definitions:**
- Purpose: Shared TypeScript interfaces for all layers
- Location: `src/types/index.ts`
- Contains: `Listing`, `LeadFormData`, `FilterOptions`, `LeadSubmissionResponse`, `ListingImage`
- Depends on: Nothing
- Used by: All layers

**Static Data:**
- Purpose: Listing content as committed JSON files
- Location: `src/data/listings/`
- Contains: One JSON file per listing, conforming to the `Listing` interface
- Note: Adding a listing requires a new JSON file AND editing the hardcoded import array in `src/lib/data.ts`

## Data Flow

### Home Page (Server Component)

1. Next.js renders `src/app/page.tsx` as RSC at build time
2. `getFeaturedListings()` called from `src/lib/data.ts`
3. `getAllListings()` dynamically imports the three JSON files via `Promise.all`
4. Results cached in module-level `listingsCache`
5. Featured listings (where `featured: true`) rendered as `<ListingCard>` grid

### Listings Page (Client Component)

1. Page mounts with `'use client'` directive (`src/app/listings/page.tsx`)
2. `useEffect` runs the same dynamic JSON imports on the client
3. `useState` holds `allListings`, `filters`, `isLoading`, `error`
4. `useMemo` computes `filteredListings` when `allListings` or `filters` change
5. `FilterBar` calls `onFiltersChange` callback → updates `filters` state → re-renders grid
6. No API call; all filtering is in-memory client-side

### Listing Detail Page (SSG)

1. `generateStaticParams()` runs at build time → one route per listing slug
2. `ListingDetailPage` renders as RSC with `params: Promise<{ slug: string }>`
3. `getListingBySlug(slug)` resolves from cache or imports JSON
4. JSON-LD structured data (`schema.org/RealEstateListing`) injected via `<script type="application/ld+json">`
5. `InquiryForm` is a `'use client'` component embedded in the RSC page

### Lead Submission

1. User submits `InquiryForm` (`src/components/InquiryForm.tsx`)
2. Client POSTs `LeadFormData` JSON to `/api/leads`
3. `src/app/api/leads/route.ts` validates required fields and email format
4. If `PERFEX_RE_URL` + `PERFEX_RE_KEY` env vars are present, proxies to Perfex CRM `POST /api/v1/leads` with `authtoken` header
5. Returns `LeadSubmissionResponse` — `{ success, message, leadId? }`
6. Form shows success or error banner based on response

**State Management:**
- No global state store (no Redux, Zustand, or Context API)
- Filter state lives locally in `src/app/listings/page.tsx` via `useState`
- Form state lives locally in `src/components/InquiryForm.tsx` via `useState`

## Key Abstractions

**Listing interface:**
- Purpose: Core data model for a property
- File: `src/types/index.ts`
- Key fields: `id` (string), `slug` (string), `price` (number), `beds` (number), `baths` (number), `sqft` (number), `images` (string[]), `featured` (boolean), `createdAt` (ISO 8601)

**FilterOptions interface:**
- Purpose: Price and bedroom filter criteria; all fields optional
- File: `src/types/index.ts`
- Used by: `filterListings()` in lib layer AND inline filter function in `src/app/listings/page.tsx`

**LeadFormData interface:**
- Purpose: Form fields for lead capture; field names match Perfex CRM API (`firstname`, `lastname`, `phonenumber`)
- File: `src/types/index.ts`

**siteConfig object:**
- Purpose: Site-wide constants (name, URL, author, OG image, Twitter handle)
- File: `src/app/layout.tsx` (exported named const)
- Used by: `src/app/listings/layout.tsx`, `src/app/listings/[slug]/page.tsx`

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: HTML shell, Inter + Merriweather fonts, Header, Footer, analytics script, global metadata

**Static Export:**
- Location: `dist/` (generated by `npm run build`)
- Triggers: `next build` with `output: 'export'` config

**Leads API Route:**
- Location: `src/app/api/leads/route.ts`
- Triggers: POST `/api/leads`
- Responsibilities: Validate lead data, proxy to Perfex CRM

## Architectural Constraints

- **Static export:** `output: 'export'` means no SSR at request time. The `/api/leads` route only functions when deployed to a platform with edge/serverless support (Cloudflare Pages via `@cloudflare/next-on-pages`). Raw static hosting cannot serve API routes.
- **Image optimization disabled:** `images: { unoptimized: true }` in `next.config.mjs` — no Next.js image optimization pipeline.
- **Global state:** Module-level `listingsCache` in `src/lib/data.ts` persists across requests in server/build context. Export `clearListingsCache()` is provided for test teardown.
- **Circular imports:** None detected.
- **Duplicate data layer:** `src/lib/listings.ts` mirrors `src/lib/data.ts`. Only `data.ts` is consumed by pages.

## Anti-Patterns

### Duplicate listing loader modules

**What happens:** Both `src/lib/data.ts` and `src/lib/listings.ts` define the same functions (`getAllListings`/`loadListings`, `getListingBySlug`, `getFeaturedListings`, `filterListings`) with near-identical implementations.
**Why it's wrong:** Updates to one file will not propagate to the other, causing divergence.
**Do this instead:** Delete `src/lib/listings.ts`. Import only from `src/lib/data.ts`.

### Listing imports duplicated in client page

**What happens:** `src/app/listings/page.tsx` contains its own `import('@/data/listings/...')` array inside `useEffect`, mirroring the same list in `src/lib/data.ts`.
**Why it's wrong:** Adding a new listing requires edits in at least two places.
**Do this instead:** Expose a `getAllListings()` function from `src/lib/data.ts` that the client page calls (wrap with a fetch or re-export as a client-importable async function), or accept the static import list existing only in the lib module.

## Error Handling

**Strategy:** Each data function catches errors and returns empty arrays or `null`. Pages handle empty/null returns with conditional rendering or `notFound()`.

**Patterns:**
- `getAllListings()` wraps imports in try/catch, returns `[]` on failure
- `getListingBySlug()` returns `null` (not `undefined`) when slug not found
- Listing detail page calls `notFound()` from `next/navigation` when `listing === null`
- API route returns `{ success: false, message }` JSON with `400` or `500` HTTP status codes
- `InquiryForm` displays inline error banners; does not throw

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.log` only — no structured logging framework.
**Validation:** Duplicated — client-side in `InquiryForm` (immediate UX feedback) and server-side in `leads/route.ts` (authoritative gate). Both use the same regex patterns.
**SEO:** Each route exports `Metadata`. Detail pages generate per-listing OpenGraph, Twitter card, and Schema.org `RealEstateListing` JSON-LD.
**Analytics:** Umami analytics via `<script defer>` tag in `src/app/layout.tsx`, self-hosted at `siteanalytics.b3rni3vault.com`.
**Fonts:** Inter (sans-serif body) and Merriweather (serif headings) loaded via `next/font/google` with CSS variable injection (`--font-inter`, `--font-merriweather`).

---

*Architecture analysis: 2026-06-10*
