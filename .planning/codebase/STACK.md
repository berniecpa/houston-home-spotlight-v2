# Technology Stack

**Analysis Date:** 2026-06-10

## Languages

**Primary:**
- TypeScript 5.x - All source files under `src/`
- TSX - React component files in `src/components/` and `src/app/`

**Secondary:**
- CSS (Tailwind utility classes) - `src/app/globals.css`
- JSON - Static listing data in `src/data/listings/`

## Runtime

**Environment:**
- Node.js 20.11.0 (pinned via `.node-version`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js ^15.5.2 - App Router, static export mode (`output: 'export'`)
- React ^18 - UI rendering
- React DOM ^18 - DOM bindings

**Build/Dev:**
- `next dev` - Development server
- `next build` - Production build
- `@cloudflare/next-on-pages` ^1.13.12 - Cloudflare Pages adapter (used for `pages:build`)
- `wrangler` (via npx) - Cloudflare Pages deployment

## Styling

**Framework:**
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

```bash
npm run dev           # Start Next.js dev server
npm run build         # Production build (static export to dist/)
npm run lint          # ESLint check
npm run typecheck     # tsc --noEmit type check
npm run pages:build   # Cloudflare Pages build via @cloudflare/next-on-pages
npm run pages:deploy  # Build + wrangler deploy to Cloudflare Pages
npm run pages:preview # Build + local wrangler preview
```

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

**Development:**
- Node.js 20.11.0
- npm (no Yarn/pnpm lockfile present)

**Production:**
- Cloudflare Pages (static hosting)
- No server-side runtime required for pages (static export)
- API routes (`src/app/api/`) run as Cloudflare Workers via `@cloudflare/next-on-pages`

---

*Stack analysis: 2026-06-10*
