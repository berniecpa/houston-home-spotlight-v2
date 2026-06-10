# Coding Conventions

**Analysis Date:** 2026-06-10

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `ListingCard.tsx`, `PhotoGallery.tsx`, `FilterBar.tsx`
- Next.js route files: lowercase `page.tsx`, `layout.tsx`, `route.ts`
- Type definition files: lowercase `index.ts` under `src/types/`
- Data files: kebab-case `.json` or `.js` — `heights-bungalow-historic.json`

**Functions:**
- Component functions: PascalCase — `export function ListingCard(...)`, `export default function Header()`
- Helper/utility functions: camelCase — `formatPrice`, `formatNumber`
- API route handlers: UPPERCASE HTTP verb — `export async function POST(...)`
- Event handlers: camelCase verb phrases — `setIsMenuOpen`

**Variables:**
- Constants: camelCase for objects — `siteConfig`, `navLinks`
- State variables: camelCase — `isMenuOpen`
- Destructured props: camelCase — `{ listing }`, `{ children }`

**Types/Interfaces:**
- Interfaces: PascalCase — `ListingCardProps`, `Listing`, `LeadFormData`, `FilterOptions`
- Props interfaces: `[ComponentName]Props` suffix — `ListingCardProps`
- Imported types use `type` keyword in import — `import type { Listing, ... } from '../types/index.js'`

## Code Style

**Formatting:**
- No Prettier config detected — relies on editor defaults and ESLint
- Double quotes for JSX string attributes: `href="/listings"`
- Single quotes in non-JSX TypeScript: `'node:test'`, `'node:assert'`
- Trailing commas in objects and arrays (observed in component files)
- 2-space indentation throughout

**Linting:**
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

**Order (observed pattern):**
1. Next.js framework imports — `import Link from "next/link"`, `import Image from "next/image"`
2. React imports (only when needed for hooks) — `import { useState } from 'react'`
3. Internal type imports — `import { Listing } from "@/types"`
4. Internal component imports — `import Header from "@/components/Header"`
5. CSS imports — `import "./globals.css"`

**Path Aliases:**
- Use `@/` for all internal imports: `import { Listing } from "@/types"` not relative paths
- Exception: test files use relative paths with `.js` extension — `import type { ... } from '../types/index.js'`

## Component Patterns

**Server Components (default):**
- No `'use client'` directive — used for all pure-display components
- Examples: `src/components/ListingCard.tsx`, `src/components/Footer.tsx`

**Client Components:**
- Add `'use client'` at top of file when using hooks or browser APIs
- Examples with client directive: `src/components/Header.tsx` (uses `useState`), `src/components/InquiryForm.tsx`, `src/components/FilterBar.tsx`, `src/components/BedsFilter.tsx`, `src/components/PriceFilter.tsx`

**Component Export Pattern:**
- Named export AND default export for reusable components:
  ```typescript
  export function ListingCard({ listing }: ListingCardProps): JSX.Element { ... }
  export default ListingCard;
  ```
- Layout/page components: default export only

**Props Definition:**
- Always define a `[Name]Props` interface for component props
- Define interface immediately before the component function
- Document prop fields with JSDoc inline comments:
  ```typescript
  interface ListingCardProps {
    /** The listing data to display */
    listing: Listing;
  }
  ```

## JSDoc Comments

**Required on:**
- All exported functions (components, API handlers, utilities)
- All interfaces
- Module-level exports (`@module` tag at top of file)

**Pattern:**
```typescript
/**
 * Component description
 *
 * Features:
 * - Feature one
 * - Feature two
 *
 * @param {ComponentProps} props - Component props
 * @returns {JSX.Element} The component
 */
```

Helper functions also get JSDoc with `@param` and `@returns`:
```typescript
/**
 * Format price as currency string
 * @param price - Price in USD
 * @returns Formatted price string (e.g., "$785,000")
 */
function formatPrice(price: number): string { ... }
```

## Tailwind CSS Conventions

**Custom utility classes defined in `src/app/globals.css`:**
- `.card` — `bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden` — use for all listing cards
- `.container-custom` — `mx-auto max-w-7xl` with responsive padding — use for all page wrappers
- `.btn-primary` — primary CTA button style
- `.btn-accent` — accent/secondary button style
- `.touch-target` — enforces `min-w-[44px] min-h-[44px]` for mobile accessibility
- `.gradient-primary` — brand gradient from `primary-900` to `primary-700`

**Color system:**
- `primary-*` — brand blue palette (e.g., `text-primary-900`, `bg-primary-700`)
- `accent-*` — accent color (e.g., `bg-accent-500`, `text-accent-400`)
- `gray-*` — neutral grays for body text and borders

**Responsive pattern:** Mobile-first. Common: `p-4 sm:p-5`, `text-sm sm:text-base`, `hidden md:flex`

**Hover/transition pattern:**
```tsx
// Parent gets group, child uses group-hover:
<Link className="group block">
  <Image className="transition-transform duration-500 group-hover:scale-105" />
</Link>
```

## Error Handling

**API routes:**
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

---

*Convention analysis: 2026-06-10*
