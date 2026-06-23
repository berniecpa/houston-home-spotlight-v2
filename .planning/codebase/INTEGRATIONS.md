# External Integrations

**Analysis Date:** 2026-06-10

## APIs & External Services

**CRM:**
- Perfex CRM - Lead/inquiry submission from contact and listing detail forms
  - SDK/Client: Native `fetch` API (no SDK)
  - Endpoint: `${PERFEX_RE_URL}/api/v1/leads` (POST)
  - Auth: `authtoken` header using `PERFEX_RE_KEY`
  - Implementation: `src/app/api/leads/route.ts`
  - Behavior: Falls back to console-log-only mode when env vars are absent (dev/test)

**Analytics:**
- Umami Analytics - Self-hosted page view tracking
  - Script: `https://siteanalytics.b3rni3vault.com/script.js`
  - Site ID: hardcoded in `src/app/layout.tsx` (inline `<script defer>` tag in `<head>`)
  - No env var — site ID and script URL are hardcoded in source

## Data Storage

**Databases:**
- None — listing data is stored as static JSON files in `src/data/listings/`

**File Storage:**
- Local filesystem only (static JSON + images served as static assets)

**Caching:**
- None — static export; CDN edge caching via Cloudflare Pages

## Authentication & Identity

**Auth Provider:**
- None — no user authentication implemented

## Fonts

**Google Fonts (via next/font):**
- Inter - loaded at build time via `next/font/google`
- Merriweather - loaded at build time via `next/font/google`
- No runtime Google Fonts CDN requests; fonts are inlined/self-hosted by Next.js

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages
  - Project name: `houston-home-spotlight-v2`
  - Branch: `main`
  - Deploy path: `.vercel/output/static`

**CI Pipeline:**
- GitHub Actions
  - Config: `.github/workflows/deploy.yml`
  - Trigger: push to `main`
  - Steps: checkout, Node 20 setup, `npm ci`, `npm run pages:build`, `wrangler pages deploy`

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token for wrangler deployment

## SEO & Social

**OpenGraph / Twitter Cards:**
- Configured in `src/app/layout.tsx` via Next.js `Metadata` API
- OG image URL hardcoded to `https://houstonhomespotlight.com/og-image.jpg`
- Twitter handle hardcoded to `@houstonhomespotlight`
- Site URL hardcoded to `https://houstonhomespotlight.com`

**Web App Manifest:**
- `public/manifest.json` - PWA manifest for mobile add-to-homescreen

**Google Search Console:**
- Verification code slot present in layout metadata (`verification.google`) but not yet populated

## Environment Configuration

**Required env vars (production):**
- `PERFEX_RE_URL` - Base URL of the Perfex CRM instance
- `PERFEX_RE_KEY` - Perfex CRM API auth token

**Optional env vars:**
- Neither Umami nor Cloudflare deployments use runtime env vars beyond build/CI secrets

**Secrets location:**
- CI/CD secrets stored in GitHub repository secrets
- Local development: no `.env` file detected in repo; set vars in shell or create `.env.local`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- POST to Perfex CRM leads endpoint — triggered by form submission via `src/app/api/leads/route.ts`

---

*Integration audit: 2026-06-10*
