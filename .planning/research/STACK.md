# Technology Stack

**Project:** Houston Home Spotlight — Real Estate Marketplace SaaS
**Researched:** 2026-06-10
**Mode:** Stack dimension for greenfield SaaS layer on existing Next.js static site

---

## Critical Pre-Flight: Adapter Migration

**@cloudflare/next-on-pages was archived on 2025-09-29 and is read-only.**

The existing project already uses `@cloudflare/next-on-pages@^1.13.12` in devDependencies. Before any SaaS work begins, the deployment adapter must be migrated. The replacement is `@opennextjs/cloudflare`, which deploys to Cloudflare Workers (not Pages Functions) and supports the full Node.js runtime rather than the stripped-down Edge runtime.

The current `output: 'export'` setting in `next.config.mjs` must be removed entirely — static export is incompatible with server-side rendering, Route Handlers, and middleware.

---

## Recommended Stack

### Deployment Adapter (BREAKING CHANGE — Do First)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@opennextjs/cloudflare` | `^1.19.11` | Next.js → Cloudflare Workers adapter | Replaces archived `@cloudflare/next-on-pages`; supports Node.js runtime (not just edge), full App Router feature set including SSR, ISR, middleware, and Route Handlers |
| `wrangler` | `^4.99.0` | Cloudflare CLI for deploy, D1 migrations, local dev | Required peer dep of `@opennextjs/cloudflare`; version 4.86.0 minimum per package requirements |

**What changes in `next.config.mjs`:**
```ts
// REMOVE: output: 'export'
// ADD: initOpenNextCloudflareForDev() call for local dev
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

const nextConfig = {
  images: { unoptimized: true },
};
export default nextConfig;
```

**New `open-next.config.ts`** (required at repo root):
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
```

**New `wrangler.jsonc`** (replaces current `wrangler.toml`):
```jsonc
{
  "name": "houston-home-spotlight-v2",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "houston-home-spotlight-v2" }],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "houston-home-spotlight",
    "database_id": "<YOUR_D1_ID>",
    "migrations_dir": "drizzle/migrations"
  }]
}
```

**Important:** Set `compatibility_date` to `2025-04-01` or later. Before that date, `nodejs_compat_populate_process_env` was not auto-enabled, so `process.env` would be empty at runtime.

**Remove from `package.json`:** `@cloudflare/next-on-pages`, any `pages:build` / `pages:deploy` scripts.
**Add to `.gitignore`:** `.open-next/`

**Confidence: HIGH** — Cloudflare's own docs and the OpenNext team actively recommend this path; `@cloudflare/next-on-pages` is read-only since 2025-09-29.

---

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | `^15.5.2` (existing) | Full-stack React framework | Already in codebase; satisfies `@opennextjs/cloudflare@1.19.11` peer dep (`>=15.5.18 <16`); App Router is the right choice for route-level auth, RSC data fetching from D1 |
| TypeScript | `^5` (existing) | Type safety | Already configured; Drizzle schema and Cloudflare env types are strongly typed |

**Note on Next.js version:** Confirm `package-lock.json` resolves to `>=15.5.18`. Run `npm install next@^15.5.18` if on an older patch. Do NOT upgrade to 16.x yet; the opennext peer dep jumps from `<16` to `>=16.2.6` with no middle ground.

**Confidence: HIGH**

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cloudflare D1 | managed | Primary database (listings, agents, subscriptions) | Required per project constraints; SQLite-compatible; zero-latency within Workers; no additional vendor |
| `drizzle-orm` | `^0.45.2` | ORM / query builder for D1 | Best-in-class D1 support; TypeScript-first; schema-as-code; generates SQL migrations consumed by wrangler; outperforms kysely for migration ergonomics in D1 context |
| `drizzle-kit` | `^0.31.10` | Schema migration generator | Generates `.sql` files in `drizzle/migrations/`; wrangler applies them — NOT drizzle-kit itself |

**D1 Binding Access Pattern (Route Handlers):**
```ts
// app/api/listings/route.ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

export async function GET() {
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB, { schema });
  const listings = await db.select().from(schema.listings).all();
  return Response.json(listings);
}
```

**For SSG/static pages that need data at build time:**
```ts
const { env } = await getCloudflareContext({ async: true });
```

**DO NOT use** `export const runtime = 'edge'` in any route file — `@opennextjs/cloudflare` uses the Node.js runtime throughout and the edge directive will break the build.

**Migrations workflow:**
```bash
# Generate SQL from schema changes
npx drizzle-kit generate

# Apply to local D1 (dev)
npx wrangler d1 migrations apply houston-home-spotlight --local

# Apply to production D1
npx wrangler d1 migrations apply houston-home-spotlight --remote
```

**drizzle.config.ts:**
```ts
import type { Config } from "drizzle-kit";
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  driver: "d1-http",
  dialect: "sqlite",
} satisfies Config;
```

**Confidence: HIGH** — drizzle-orm + D1 is the dominant 2025 pattern; official Cloudflare docs link to it; wrangler migration apply workflow confirmed.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Firebase Auth | Client SDK `^11.x` | Agent + admin auth (client-side sign-in) | Required per project constraints; Bernard already uses Firebase |
| `next-firebase-auth-edge` | `^1.12.0` | Server-side Firebase Auth for App Router + Workers | Verifies Firebase ID tokens using Web Crypto API; sets secure HttpOnly cookie sessions compatible with Cloudflare Workers; `getTokens()` in Server Components |

**Why NOT `firebase-admin` SDK directly:** `firebase-admin` requires Node.js crypto modules not available in the Workers runtime even with `nodejs_compat`. It will fail at runtime.

**Why NOT `firebase-auth-cloudflare-workers` (Code-Hex):** Lower-level JWT verification only; no Next.js middleware integration; requires manual cookie creation, rotation, and multi-cookie splitting.

**Middleware pattern (`src/middleware.ts`):**
```ts
import { authMiddleware } from "next-firebase-auth-edge";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: "AuthToken",
    cookieSignatureKeys: [
      process.env.COOKIE_SECRET_CURRENT!,
      process.env.COOKIE_SECRET_PREVIOUS!,
    ],
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: 12 * 60 * 60 * 24, // 12 days
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    },
    enableMultipleCookies: true, // required — avoids 4096-byte browser cookie limit
    handleValidToken: async ({ decodedToken }, headers) => {
      headers.set("X-User-Id", decodedToken.uid);
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () =>
      NextResponse.redirect(new URL("/login", request.url)),
    handleError: async () =>
      NextResponse.redirect(new URL("/login", request.url)),
  });
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/agent/:path*"],
};
```

**Server Component token access:**
```ts
import { getTokens } from "next-firebase-auth-edge/next/tokens";
import { cookies } from "next/headers";

const tokens = await getTokens(await cookies(), {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "AuthToken",
  cookieSignatureKeys: [process.env.COOKIE_SECRET_CURRENT!],
  serviceAccount: { projectId: "...", privateKey: "...", clientEmail: "..." },
});
if (!tokens) redirect("/login");
const { uid, admin } = tokens.decodedToken; // uid, email, custom claims
```

**Admin role:** Set Firebase custom claim `{ admin: true }` via a one-time Node.js script using `firebase-admin` SDK (run outside Workers, e.g. locally or in a one-off Cloud Function). Check `decodedToken.admin === true` in middleware and server components.

**Confidence: HIGH** — `next-firebase-auth-edge` is the canonical 2025 solution; actively maintained; explicitly supports Cloudflare Workers + Next.js App Router; v1.12.0 confirmed on npm.

---

### Billing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` | `^22.2.0` | Stripe SDK for subscription and webhook handling | Official SDK; native Cloudflare Workers support since 2024 announcement; use `createFetchHttpClient()` to avoid Node HTTP dependency |

**Subscription checkout (Route Handler):**
```ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  httpClient: Stripe.createFetchHttpClient(),
});

export async function POST(req: Request) {
  const { priceId, customerId } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.APP_URL}/pricing`,
  });
  return Response.json({ url: session.url });
}
```

**Webhook signature verification (Cloudflare Workers compatible):**
```ts
// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";

const webCrypto = Stripe.createSubtleCryptoProvider();

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await req.text(); // raw body — must NOT be parsed before this
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
      undefined,
      webCrypto, // WebCrypto provider — required for Workers
    );
  } catch {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": /* provision subscription */ break;
    case "invoice.paid": /* extend grace period */ break;
    case "invoice.payment_failed": /* start 7-day grace period */ break;
    case "customer.subscription.updated": /* sync plan changes */ break;
    case "customer.subscription.deleted": /* deactivate listings */ break;
  }

  return new Response("ok", { status: 200 });
}
```

**Critical:** Use `constructEventAsync` (async) not `constructEvent` (sync) — Workers uses Web Crypto which is async. Pass `Stripe.createSubtleCryptoProvider()` as the fifth argument. Do NOT parse body with `req.json()` before this call — raw bytes must match for HMAC verification.

**Customer portal:**
```ts
const portalSession = await stripe.billingPortal.sessions.create({
  customer: agent.stripeCustomerId,
  return_url: `${process.env.APP_URL}/dashboard/billing`,
});
return Response.json({ url: portalSession.url });
```

**Confidence: HIGH** — Cloudflare officially announced Stripe SDK support; `constructEventAsync` pattern documented by both Stripe and Cloudflare; v22.2.0 confirmed on npm.

---

### AI Video Generation

| Technology | Access | Purpose | Recommendation |
|------------|--------|---------|----------------|
| Kie.ai | REST API (single API key) | Aggregator: Kling 3.0, Veo 3.1, Runway, Seedance under one key | **Use for v1** — easiest onboarding; 30–50% below official API prices; 20 req/10s rate limit; async task model |
| Seedance 2.0 via BytePlus ModelArk | REST API (BytePlus account + real-name verification) | Direct ByteDance video model; image-to-video at 720p/1080p | **Use for v2** — lower per-video cost at scale; requires regional account setup |

**Recommendation: Start with Kie.ai in Phase 1 for rapid prototyping; migrate to direct BytePlus/Seedance API for production cost optimization at scale.**

**Kie.ai basic pattern (async task model):**
```ts
// Step 1: Submit generation task
const createRes = await fetch("https://api.kie.ai/api/kling/v1/videos/image2video", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.KIE_AI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    image_url: listing.primaryPhotoUrl,
    prompt: `${listing.address}, cinematic property tour`,
    duration: "5",
    mode: "std",
  }),
});
const { data: { task_id } } = await createRes.json();

// Step 2: Store task_id in D1, poll for completion in a background job
// Step 3: On completion, save video_url to listing record
```

**Higgsfield.ai** is a comparable aggregator (Seedance 2.0, Kling 3.0, Veo 3.1, 50+ camera movements) but has thinner API documentation and less community tooling than Kie.ai. Not recommended over Kie.ai for API-first integration.

**All three platforms are async** — do not try to return the video URL synchronously from a Route Handler.

**Confidence: MEDIUM** — Kie.ai and Seedance 2.0 APIs confirmed active and documented; pricing from search results may shift; BytePlus regional availability for US accounts unconfirmed. Phase-specific research needed before implementation.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@cloudflare/workers-types` | `^4` | TypeScript types for Cloudflare bindings (D1, KV, R2) | Add to devDependencies immediately; required for type-safe `env.DB` |
| `zod` | `^3.x` | Runtime schema validation | Validate all agent input at Route Handler boundaries |
| `resend` | `^4.x` | Transactional email | Lead notifications to agents; subscription event emails; simpler than SES at this scale |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Deployment adapter | `@opennextjs/cloudflare` | `@cloudflare/next-on-pages` | Archived 2025-09-29; edge-only runtime; incompatible with firebase-admin, stripe webhook verification |
| ORM | `drizzle-orm` | `kysely` | Both support D1; Drizzle has cleaner migration ergonomics and schema-as-code |
| Firebase Auth on Workers | `next-firebase-auth-edge` | `firebase-admin` SDK direct | firebase-admin uses Node.js crypto not available in Workers runtime |
| Firebase Auth on Workers | `next-firebase-auth-edge` | `firebase-auth-cloudflare-workers` | Lower-level; no Next.js middleware integration; manual cookie management required |
| Video generation | Kie.ai (aggregator) | Direct Seedance BytePlus | BytePlus requires real-name verification + regional setup; Kie.ai faster to integrate in v1 |
| Video generation | Kie.ai | Higgsfield.ai | Both are aggregators; Kie.ai has clearer API documentation |

---

## Installation

```bash
# Remove archived adapter
npm uninstall @cloudflare/next-on-pages

# Core deployment
npm install @opennextjs/cloudflare@latest
npm install -D wrangler@latest @cloudflare/workers-types

# Database
npm install drizzle-orm
npm install -D drizzle-kit

# Auth
npm install next-firebase-auth-edge firebase

# Billing
npm install stripe

# Validation + email
npm install zod resend
```

---

## Environment Variables Required

```bash
# Firebase (server-side — private, store in .dev.vars locally)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
COOKIE_SECRET_CURRENT=        # 32+ char random string
COOKIE_SECRET_PREVIOUS=       # for rotation

# Firebase (public — safe to expose via NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=

# AI Video
KIE_AI_API_KEY=

# App
APP_URL=

# Existing
PERFEX_RE_URL=
PERFEX_RE_KEY=
```

Store locally in `.dev.vars` (wrangler convention). Do NOT use `.env.local` — the Workers runtime does not read it.

---

## Known Limitations and Phase Research Flags

1. **`next-firebase-auth-edge` + `@opennextjs/cloudflare` middleware interaction** — `cookies()` from `next/headers` does not work in Next.js middleware on Workers; `next-firebase-auth-edge` accesses cookies from the raw request object in middleware (which does work). Verify with a working prototype before building auth-dependent routes. **Flag: deeper research in Phase 1 (Auth).**

2. **D1 local development** — Local D1 state lives in `.wrangler/state/v3/d1/`; separate from production. `initOpenNextCloudflareForDev()` in `next.config.ts` bridges D1 bindings for `next dev`. Run `npx wrangler dev` to test the full Worker build locally.

3. **Stripe webhook local testing** — Requires Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Install the CLI before Phase 2 (Billing).

4. **`@opennextjs/cloudflare` Node Middleware (Next.js 15.2+)** — Node Middleware is not yet supported in v1.19.11. Use only edge-compatible `middleware.ts`. `next-firebase-auth-edge` middleware is edge-compatible and works within this constraint.

5. **Next.js version pin** — Pin to `^15.5.18` within the 15.x line. Upgrading to `>=16.0.0` breaks the `@opennextjs/cloudflare` peer dep until `>=16.2.6` lands.

---

## Sources

- [OpenNext Cloudflare — Get Started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext Cloudflare — Bindings](https://opennext.js.org/cloudflare/bindings)
- [Cloudflare Workers: Deploying Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [next-firebase-auth-edge — Middleware Docs](https://next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware)
- [Drizzle ORM — Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Drizzle Migrations on Cloudflare D1](https://jilles.me/drizzle-migrations-on-cloudflare-d1-generate-sql-apply-with-wrangler/)
- [Cloudflare Blog: Stripe in Workers](https://blog.cloudflare.com/announcing-stripe-support-in-workers/)
- [Stripe Webhook Signature Verification on Cloudflare Workers](https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/)
- [Seedance 2.0 API Guide 2026](https://www.nxcode.io/resources/news/seedance-2-0-api-guide-pricing-setup-2026)
- [Kie.ai API Documentation](https://docs.kie.ai/)
- [firebase-auth-cloudflare-workers (Code-Hex)](https://github.com/Code-Hex/firebase-auth-cloudflare-workers)
- [Thomas Desmond: Next.js + Cloudflare Pages — Use OpenNext Instead](https://thomasdesmond.me/posts/nextjs-pages-cloudflare-pages/)
