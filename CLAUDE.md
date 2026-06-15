<!-- GSD:project-start source:PROJECT.md -->

## Project

**Houston Home Spotlight — Real Estate Marketplace**

A Houston-area real estate marketplace where licensed agents pay a monthly subscription to publish and manage property listings, and buyers browse those listings and submit inquiries. Bernard owns and administers the platform; agents self-serve via a dashboard (Firebase Auth + Stripe); listings are stored in Cloudflare D1. An AI video generation feature (Seedance + HiggsField/Kie) will let agents turn listing photos into property tour videos.

**Core Value:** Agents can publish Houston listings in minutes and receive buyer inquiries directly — the platform earns recurring subscription revenue while buyers get a curated, always-current marketplace.

### Constraints

- **Framework**: Next.js App Router — existing codebase; no rewrite
- **Auth**: Firebase Auth — Bernard's preference; not Clerk/NextAuth/Supabase Auth
- **Database**: Cloudflare D1 (SQLite) — must stay in Cloudflare ecosystem; not Postgres/Supabase/PlanetScale
- **Billing**: Stripe — subscriptions, webhooks, customer portal
- **Deployment**: Cloudflare Workers via `@opennextjs/cloudflare` (OpenNext) — runs on the Node.js/workerd runtime; do NOT add `runtime = 'edge'` exports
- **Photos v1**: URL paste only — no file upload, no R2; keeps complexity low
- **Public UX**: Existing buyer-facing listing browse/detail experience must not regress
- **Bernard's access**: Platform owner/admin — does not pay subscription; admin role via Firebase Auth custom claim

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x - All source files under `src/`
- TSX - React component files in `src/components/` and `src/app/`
- CSS (Tailwind utility classes) - `src/app/globals.css`
- JSON - Static listing data in `src/data/listings/`

## Runtime

- Node.js 20.11.0 (pinned via `.node-version`)
- npm
- Lockfile: `package-lock.json` present

## Frameworks

- Next.js ^15.5.2 - App Router, static export mode (`output: 'export'`)
- React ^18 - UI rendering
- React DOM ^18 - DOM bindings
- `next dev` - Development server
- `next build` - Production build
- `@opennextjs/cloudflare` ^1.19.11 - OpenNext Cloudflare adapter (used for `cf:build`)
- `wrangler` ^4.99.0 - Cloudflare Workers deployment (`cf:deploy`)

## Styling

- Tailwind CSS ^3.4.1 - Utility-first CSS
- Config: `tailwind.config.ts`
- Custom brand colors: `primary` (blue scale) and `accent` (amber scale)
- Custom breakpoints including `xs: 375px`
- PostCSS ^10.4.27 with autoprefixer ^10.4.27
- Config: `postcss.config.mjs`

## Fonts

- Inter (variable font via `next/font/google`) - sans-serif body font
- Merriweather (via `next/font/google`, weights 400/700) - serif heading font
- Local fallback fonts bundled: `src/app/fonts/GeistVF.woff`, `src/app/fonts/GeistMonoVF.woff`

## TypeScript Configuration

- Config: `tsconfig.json`
- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- Target: ES2017
- Module resolution: `bundler`
- Resolve JSON modules enabled (used for listing JSON files)

## Linting

- ESLint ^8
- Config: `.eslintrc.json`
- Extends: `next/core-web-vitals`, `next/typescript`
- eslint-config-next: 14.2.35

## Testing

- Node.js built-in test runner (`node --test`)
- Run command: `npm test`
- Test files: `src/tests/*.test.ts`
- No third-party test framework (Jest/Vitest) installed

## Key Scripts

## Build Output

- Output mode: `output: 'export'` (static HTML/CSS/JS)
- Output directory: `dist/` (custom via `distDir: 'dist'`)
- Images: unoptimized (required for static export)

## Configuration Files

- `next.config.mjs` - Next.js config (static export, distDir, unoptimized images)
- `tailwind.config.ts` - Tailwind theme extensions
- `postcss.config.mjs` - PostCSS plugins
- `tsconfig.json` - TypeScript compiler options
- `.eslintrc.json` - ESLint rules
- `.node-version` - Node version pin (20.11.0)

## Platform Requirements

- Node.js 20.11.0
- npm (no Yarn/pnpm lockfile present)
- Cloudflare Workers (via `@opennextjs/cloudflare`)
- Pages and API routes (`src/app/api/`) run on the Cloudflare Workers (Node.js/workerd) runtime; no `runtime = 'edge'` exports

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase `.tsx` — `ListingCard.tsx`, `PhotoGallery.tsx`, `FilterBar.tsx`
- Next.js route files: lowercase `page.tsx`, `layout.tsx`, `route.ts`
- Type definition files: lowercase `index.ts` under `src/types/`
- Data files: kebab-case `.json` or `.js` — `heights-bungalow-historic.json`
- Component functions: PascalCase — `export function ListingCard(...)`, `export default function Header()`
- Helper/utility functions: camelCase — `formatPrice`, `formatNumber`
- API route handlers: UPPERCASE HTTP verb — `export async function POST(...)`
- Event handlers: camelCase verb phrases — `setIsMenuOpen`
- Constants: camelCase for objects — `siteConfig`, `navLinks`
- State variables: camelCase — `isMenuOpen`
- Destructured props: camelCase — `{ listing }`, `{ children }`
- Interfaces: PascalCase — `ListingCardProps`, `Listing`, `LeadFormData`, `FilterOptions`
- Props interfaces: `[ComponentName]Props` suffix — `ListingCardProps`
- Imported types use `type` keyword in import — `import type { Listing, ... } from '../types/index.js'`

## Code Style

- No Prettier config detected — relies on editor defaults and ESLint
- Double quotes for JSX string attributes: `href="/listings"`
- Single quotes in non-JSX TypeScript: `'node:test'`, `'node:assert'`
- Trailing commas in objects and arrays (observed in component files)
- 2-space indentation throughout
- Tool: ESLint (`eslint ^8`) via `npm run lint` (`next lint`)
- Config: `.eslintrc.json` — `{ "extends": ["next/core-web-vitals", "next/typescript"] }`
- No custom rules beyond `next/core-web-vitals` and `next/typescript`

## TypeScript Configuration

- `strict: true` in `tsconfig.json` — all strict checks enabled
- `noEmit: true` — TypeScript used for type checking only, not compilation
- Path alias `@/*` maps to `src/*` — use `@/components/...`, `@/types`, etc.
- `resolveJsonModule: true` — JSON files can be imported directly
- `target: ES2017` with `module: esnext`
- Run type checking with: `npm run typecheck` (runs `tsc --noEmit`)

## Import Organization

- Use `@/` for all internal imports: `import { Listing } from "@/types"` not relative paths
- Exception: test files use relative paths with `.js` extension — `import type { ... } from '../types/index.js'`

## Component Patterns

- No `'use client'` directive — used for all pure-display components
- Examples: `src/components/ListingCard.tsx`, `src/components/Footer.tsx`
- Add `'use client'` at top of file when using hooks or browser APIs
- Examples with client directive: `src/components/Header.tsx` (uses `useState`), `src/components/InquiryForm.tsx`, `src/components/FilterBar.tsx`, `src/components/BedsFilter.tsx`, `src/components/PriceFilter.tsx`
- Named export AND default export for reusable components:
- Layout/page components: default export only
- Always define a `[Name]Props` interface for component props
- Define interface immediately before the component function
- Document prop fields with JSDoc inline comments:

## JSDoc Comments

- All exported functions (components, API handlers, utilities)
- All interfaces
- Module-level exports (`@module` tag at top of file)

## Tailwind CSS Conventions

- `.card` — `bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden` — use for all listing cards
- `.container-custom` — `mx-auto max-w-7xl` with responsive padding — use for all page wrappers
- `.btn-primary` — primary CTA button style
- `.btn-accent` — accent/secondary button style
- `.touch-target` — enforces `min-w-[44px] min-h-[44px]` for mobile accessibility
- `.gradient-primary` — brand gradient from `primary-900` to `primary-700`
- `primary-*` — brand blue palette (e.g., `text-primary-900`, `bg-primary-700`)
- `accent-*` — accent color (e.g., `bg-accent-500`, `text-accent-400`)
- `gray-*` — neutral grays for body text and borders

## Error Handling

- Wrap all handler logic in `try { } catch { }` blocks
- Return typed `NextResponse.json(...)` with explicit `{ status: N }` option
- Return `400` for validation errors, `500` for server/CRM errors
- Always return `{ success: boolean, message: string }` shape matching `LeadSubmissionResponse`

## Logging

- `console.error(...)` for server-side errors in API routes
- No structured logging library — plain `console.error` only

## Accessibility Standards

- All interactive elements have `aria-label` or visible label
- Images have descriptive `alt` text
- Touch targets meet 44px minimum (`.touch-target` utility class)
- Semantic HTML elements: `<article>`, `<header>`, `<nav>`, `<main>`, `<footer>`
- `aria-expanded` on toggle controls (e.g., mobile menu button in `src/components/Header.tsx`)

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- `output: 'export'` in `next.config.mjs` — generates fully static HTML in `dist/`
- Pages default to React Server Components; interactive pages use `'use client'` directive
- Data access is synchronous module-import based (no database, no runtime fetch for listings)
- Module-level `listingsCache` prevents redundant JSON re-imports at build time
- Lead submission is the only server-side runtime operation (API route)

## Layers

- Purpose: Route definitions and page-level data assembly
- Location: `src/app/`
- Contains: RSC pages, client pages, API routes, layouts, metadata exports
- Depends on: `src/lib/`, `src/components/`, `src/types/`
- Used by: Next.js router at build time
- Purpose: Reusable UI elements, both server and client components
- Location: `src/components/`
- Contains: Layout chrome (Header, Footer), display components, interactive forms and filters
- Depends on: `src/types/`, Tailwind CSS utility classes
- Used by: Pages in `src/app/`
- Purpose: Data access functions that abstract JSON imports behind an async API
- Location: `src/lib/data.ts` (primary), `src/lib/listings.ts` (duplicate — see Anti-Patterns)
- Contains: `getAllListings`, `getListingBySlug`, `getFeaturedListings`, `filterListings`, `clearListingsCache`
- Depends on: `src/data/listings/*.json`, `src/types/`
- Used by: Pages and API routes
- Purpose: Shared TypeScript interfaces for all layers
- Location: `src/types/index.ts`
- Contains: `Listing`, `LeadFormData`, `FilterOptions`, `LeadSubmissionResponse`, `ListingImage`
- Depends on: Nothing
- Used by: All layers
- Purpose: Listing content as committed JSON files
- Location: `src/data/listings/`
- Contains: One JSON file per listing, conforming to the `Listing` interface
- Note: Adding a listing requires a new JSON file AND editing the hardcoded import array in `src/lib/data.ts`

## Data Flow

### Home Page (Server Component)

### Listings Page (Client Component)

### Listing Detail Page (SSG)

### Lead Submission

- No global state store (no Redux, Zustand, or Context API)
- Filter state lives locally in `src/app/listings/page.tsx` via `useState`
- Form state lives locally in `src/components/InquiryForm.tsx` via `useState`

## Key Abstractions

- Purpose: Core data model for a property
- File: `src/types/index.ts`
- Key fields: `id` (string), `slug` (string), `price` (number), `beds` (number), `baths` (number), `sqft` (number), `images` (string[]), `featured` (boolean), `createdAt` (ISO 8601)
- Purpose: Price and bedroom filter criteria; all fields optional
- File: `src/types/index.ts`
- Used by: `filterListings()` in lib layer AND inline filter function in `src/app/listings/page.tsx`
- Purpose: Form fields for lead capture; field names match Perfex CRM API (`firstname`, `lastname`, `phonenumber`)
- File: `src/types/index.ts`
- Purpose: Site-wide constants (name, URL, author, OG image, Twitter handle)
- File: `src/app/layout.tsx` (exported named const)
- Used by: `src/app/listings/layout.tsx`, `src/app/listings/[slug]/page.tsx`

## Entry Points

- Location: `src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: HTML shell, Inter + Merriweather fonts, Header, Footer, analytics script, global metadata
- Location: `dist/` (generated by `npm run build`)
- Triggers: `next build` with `output: 'export'` config
- Location: `src/app/api/leads/route.ts`
- Triggers: POST `/api/leads`
- Responsibilities: Validate lead data, proxy to Perfex CRM

## Architectural Constraints

- **OpenNext Cloudflare adapter:** the app is built with `@opennextjs/cloudflare` (`cf:build`) and deployed to Cloudflare Workers (`cf:deploy`); pages and API routes (e.g. `/api/leads`) run on the Node.js/workerd runtime. Do NOT add `runtime = 'edge'` exports — OpenNext rejects edge-runtime functions during bundling.
- **Image optimization disabled:** `images: { unoptimized: true }` in `next.config.mjs` — no Next.js image optimization pipeline.
- **Global state:** Module-level `listingsCache` in `src/lib/data.ts` persists across requests in server/build context. Export `clearListingsCache()` is provided for test teardown.
- **Circular imports:** None detected.
- **Duplicate data layer:** `src/lib/listings.ts` mirrors `src/lib/data.ts`. Only `data.ts` is consumed by pages.

## Anti-Patterns

### Duplicate listing loader modules

### Listing imports duplicated in client page

## Error Handling

- `getAllListings()` wraps imports in try/catch, returns `[]` on failure
- `getListingBySlug()` returns `null` (not `undefined`) when slug not found
- Listing detail page calls `notFound()` from `next/navigation` when `listing === null`
- API route returns `{ success: false, message }` JSON with `400` or `500` HTTP status codes
- `InquiryForm` displays inline error banners; does not throw

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
