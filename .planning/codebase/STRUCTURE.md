# Codebase Structure

**Analysis Date:** 2026-06-10

## Directory Layout

```
houston-home-spotlight-v2/
├── src/
│   ├── app/                      # Next.js App Router — routes, layouts, API
│   │   ├── layout.tsx            # Root layout: HTML shell, fonts, siteConfig
│   │   ├── page.tsx              # Home page (RSC)
│   │   ├── globals.css           # Global Tailwind CSS base styles
│   │   ├── favicon.ico           # Site favicon
│   │   ├── fonts/                # Self-hosted font files (GeistVF, GeistMonoVF)
│   │   ├── contact/
│   │   │   └── page.tsx          # Contact page
│   │   ├── listings/
│   │   │   ├── layout.tsx        # Listings section metadata
│   │   │   ├── page.tsx          # All listings page (client component)
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Listing detail page (RSC + SSG)
│   │   └── api/
│   │       └── leads/
│   │           └── route.ts      # POST /api/leads -> Perfex CRM
│   ├── components/               # Shared React components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── ListingCard.tsx       # Listing summary card
│   │   ├── PhotoGallery.tsx      # Image gallery (client)
│   │   ├── InquiryForm.tsx       # Lead capture form (client)
│   │   ├── FilterBar.tsx         # Composite filter UI (client)
│   │   ├── PriceFilter.tsx       # Price range filter
│   │   └── BedsFilter.tsx        # Bedroom count filter
│   ├── data/
│   │   └── listings/             # Listing content as JSON files
│   │       ├── riverside-terrace-modern-craftsman.json
│   │       ├── heights-bungalow-historic.json
│   │       └── sugarland-estate-pool.json
│   ├── lib/                      # Data access utilities
│   │   ├── data.ts               # Primary: getAllListings, getListingBySlug, etc.
│   │   └── listings.ts           # Duplicate of data.ts — do not use (see ARCHITECTURE.md)
│   ├── tests/                    # All test files (flat directory)
│   │   ├── data.test.ts
│   │   ├── listings.test.ts
│   │   ├── listing-card.test.ts
│   │   ├── listing-detail-page.test.ts
│   │   ├── listings-page.test.ts
│   │   ├── leads-api.test.ts
│   │   ├── inquiry-form.test.ts
│   │   ├── filter-components.test.ts
│   │   ├── home-page.test.ts
│   │   ├── contact.test.ts
│   │   ├── layout.test.ts
│   │   ├── photo-gallery.test.ts
│   │   ├── integration.test.ts
│   │   ├── cloudflare-deployment.test.ts
│   │   ├── project-setup.test.ts
│   │   ├── responsive-design.test.ts
│   │   ├── seo.test.ts
│   │   ├── tailwind-config.test.ts
│   │   └── types.test.ts
│   └── types/
│       └── index.ts              # All TypeScript interfaces
├── public/                       # Static assets served at root
│   └── manifest.json             # PWA manifest
├── dist/                         # Built static export output
├── docs/
│   └── superpowers/
│       ├── plans/                # Implementation phase plans
│       └── specs/                # Feature specs
├── .planning/
│   └── codebase/                 # Codebase map documents
├── .github/
│   └── workflows/
│       └── deploy.yml            # Cloudflare Pages CI/CD workflow
├── next.config.mjs               # Next.js config: output='export', distDir='dist'
├── package.json
├── package-lock.json
├── tsconfig.json                 # TypeScript config with @/ path alias
├── tailwind.config.ts            # Tailwind CSS config
├── postcss.config.mjs            # PostCSS config
└── .eslintrc.json                # ESLint config
```

## Directory Purposes

**`src/app/`:**
- Purpose: All Next.js routes — pages, layouts, and API handlers
- Contains: RSC pages, `'use client'` pages, `layout.tsx` files, `route.ts` API handlers
- Key files: `layout.tsx` (root shell + siteConfig export), `page.tsx` (home), `listings/page.tsx`, `listings/[slug]/page.tsx`, `api/leads/route.ts`

**`src/components/`:**
- Purpose: Reusable UI components used across pages
- Contains: Server-renderable components (Header, Footer, ListingCard) and client-only components (InquiryForm, FilterBar, PhotoGallery)
- Naming: PascalCase matching the exported component name

**`src/data/listings/`:**
- Purpose: Listing content storage as static JSON
- Contains: One `.json` file per listing, all conforming to the `Listing` interface in `src/types/index.ts`
- Constraint: Each new file must also be added to the import array in `src/lib/data.ts`

**`src/lib/`:**
- Purpose: Data access and utility functions (not components)
- Contains: `data.ts` — the primary listing data module with module-level caching
- Note: `listings.ts` is a duplicate and must not be used for new code

**`src/tests/`:**
- Purpose: All test files in a single flat directory
- Contains: Unit, integration, and smoke tests; one test file per module or feature
- Naming: `<subject>.test.ts` in kebab-case

**`src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: `index.ts` with all exported interfaces
- Rule: All application interfaces live here — do not define types inline in component or page files

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML shell — wraps every page
- `src/app/page.tsx`: Home page at `/`
- `src/app/listings/page.tsx`: Listings index at `/listings`
- `src/app/listings/[slug]/page.tsx`: Listing detail at `/listings/:slug`
- `src/app/api/leads/route.ts`: Lead submission API at `POST /api/leads`

**Configuration:**
- `next.config.mjs`: Static export mode, custom `dist/` output dir, image optimization disabled
- `tailwind.config.ts`: Custom `primary-*` and `accent-*` color scales, `container-custom` utility class
- `tsconfig.json`: Path alias `@/` maps to `./src/`
- `.github/workflows/deploy.yml`: Cloudflare Pages deploy pipeline

**Core Logic:**
- `src/lib/data.ts`: All listing data access functions — always import from here
- `src/types/index.ts`: All TypeScript interfaces (`Listing`, `LeadFormData`, `FilterOptions`, `LeadSubmissionResponse`, `ListingImage`)

**Testing:**
- `src/tests/`: All tests in flat directory

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js App Router requirement)
- Layouts: `layout.tsx`
- API routes: `route.ts`
- Components: PascalCase matching exported name — `ListingCard.tsx`, `InquiryForm.tsx`
- Utilities/lib: camelCase — `data.ts`
- Type barrel: `index.ts`
- Tests: `<subject>.test.ts` in kebab-case — `listing-card.test.ts`, `leads-api.test.ts`
- Data JSON: kebab-case descriptive slug — `heights-bungalow-historic.json`

**Directories:**
- Route segments: lowercase, kebab-case — `listings/`, `[slug]/`, `api/leads/`
- Feature groupings: lowercase singular — `components/`, `data/`, `lib/`, `types/`, `tests/`

**Exports:**
- Components use named exports (e.g., `export function ListingCard`) plus a default export for Next.js pages
- Types use named exports only
- No barrel `index.ts` files in `components/` — import directly by filename

## Where to Add New Code

**New listing:**
1. Create `src/data/listings/<kebab-slug>.json` conforming to the `Listing` interface
2. Add the import to the `listingFiles` array in `src/lib/data.ts`
3. Static params in `src/app/listings/[slug]/page.tsx` picks it up automatically

**New page route:**
- Implementation: `src/app/<route-name>/page.tsx`
- Metadata: Export `metadata` const from the page file, or create `src/app/<route-name>/layout.tsx`
- Tests: `src/tests/<route-name>-page.test.ts`

**New React component:**
- Implementation: `src/components/<ComponentName>.tsx`
- Add `'use client'` only when the component requires browser APIs, `useState`, or `useEffect`
- Tests: `src/tests/<component-name>.test.ts`

**New API route:**
- Implementation: `src/app/api/<resource>/route.ts`
- Export named HTTP method handlers (`GET`, `POST`, etc.)
- Tests: `src/tests/<resource>-api.test.ts`

**New TypeScript interface:**
- Add to `src/types/index.ts` — do not create additional type files

**New utility function:**
- Listing-related: Add to `src/lib/data.ts`
- Unrelated utilities: Create `src/lib/<utility-name>.ts`

## Special Directories

**`dist/`:**
- Purpose: Static export output from `next build`
- Generated: Yes (by `next build`)
- Committed: Yes (currently tracked in git)

**`.planning/codebase/`:**
- Purpose: Architecture and stack documentation consumed by GSD planning commands
- Generated: By mapper agents
- Committed: Yes

**`.worktrees/listing-automation/`:**
- Purpose: Git worktree for the `listing-automation` feature branch; contains an extended version with admin dashboard, Cloudflare D1 database, and ingestion workers
- Generated: No (manually created git worktree)
- Committed: No (`.worktrees` is in `.gitignore`)

**`.next/`:**
- Purpose: Next.js build cache
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-06-10*
