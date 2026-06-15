# v1.0 Production Setup Runbook

Houston Home Spotlight v1.0 is **code-complete** (1282 tests green) but no live service
has been validated. This runbook takes it from code → live, in order. Full per-feature
test scripts live in `.planning/milestones/v1.0-phases/<phase>/<phase>-UAT.md`.

Secrets template: `.dev.vars.example` (local) → copy to `.dev.vars`; for prod use
`wrangler secret put <NAME>`.

---

## Step 1 — Provision accounts & collect secrets

| Service | Create | Secrets → .dev.vars |
|---|---|---|
| **Firebase** | Project → Authentication → enable **Email/Password**. Project Settings → Service accounts → **Generate private key**. Copy the Web app config. | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; web config → `NEXT_PUBLIC_FIREBASE_*` (these go in `wrangler.toml [vars]`) |
| **Cookies** | `openssl rand -base64 32` ×2 | `COOKIE_SECRET_CURRENT`, `COOKIE_SECRET_PREVIOUS` |
| **Stripe** | Product catalog → add **$79/month recurring** Price. Settings → Billing → **enable Customer Portal**. Developers → Webhooks → add endpoint `…/api/stripe/webhook`. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` |
| **Resend** | Add + **DNS-verify a sending domain**. | `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, `ADMIN_NOTIFY_EMAIL` |
| **Kie.ai** | Get API key; Settings → set `webhookHmacKey`. | `KIE_API_KEY`, `KIE_WEBHOOK_SECRET` |
| **HiggsField** | Console → KEY_ID + KEY_SECRET. | `HIGGSFIELD_API_KEY=KEY_ID:KEY_SECRET` |
| **Cloudflare** | Account ID (for deploy / GitHub Actions). | `CLOUDFLARE_ACCOUNT_ID` (deploy env, not .dev.vars) |

> Production: replace every Stripe/Kie test key with live keys before public launch.

## Step 2 — Apply D1 migrations (ORDER MATTERS)

```bash
npx wrangler d1 migrations apply DB --local     # dev
# 0001 base, 0002 featured col, 0005 video_jobs apply cleanly now.
```

**Gotcha — migrations 0003 + 0004 need an admin agent row first:**

1. `npm run cf:preview`, register + verify Bernard's account once (creates his `agents` row).
2. Set the admin claim: `BERNARD_UID=<his-firebase-uid> npm run admin:set-claim`
   (UID: Firebase Console → Authentication → Users).
3. Re-run `npx wrangler d1 migrations apply DB --local` so **0003** (seed the 3 legacy
   listings under Bernard's admin id) and **0004** (backfill agent slugs) attach correctly.
4. Verify: `npx wrangler d1 execute DB --local --command "SELECT slug FROM listings;"`
   → expect `heights-bungalow-historic`, `riverside-terrace-modern-craftsman`, `sugarland-estate-pool`.

Repeat with `--remote` for production.

## Step 3 — Deploy

```bash
npm run build && npm test          # sanity (expect 1282 pass / 0 fail)
npm run cf:build && npm run cf:deploy
```

Uses `custom-worker.ts` as the Worker entry (fetch + the `*/5 * * * *` video-poller cron in `wrangler.toml`). For Stripe + Kie webhooks, point each provider's webhook URL at your deployed `…/api/stripe/webhook` and `…/api/video/callback`.

## Step 4 — Run UAT (44 scenarios)

Walk each phase's checklist in order; they're written as concrete click-throughs:

| Phase | File | Scenarios |
|---|---|---|
| Auth | `.planning/milestones/v1.0-phases/02-auth-agent-onboarding/02-UAT.md` | 11 |
| Billing | `…/03-subscription-billing/03-UAT.md` | 5 |
| Listings/Leads | `…/04-listings-migration-and-leads/04-UAT.md` | 10 |
| Admin/Profiles | `…/05-admin-panel-agent-profiles/05-UAT.md` | 9 |
| AI Video | `…/06-ai-video-generation/06-UAT.md` | 9 |

First live Kie.ai job: set `VIDEO_CALLBACK_DEBUG=true` once to confirm the callback's video-URL field shape (`data.video_url` vs `resultJson.resultUrls[0]` — code handles both).

## Step 5 — Product decisions (resolved in code; see commit log)

- **WR-05** — paused/lapsed listing inquiries: **Capture, do not block.** A buyer inquiry on a hidden (paused/lapsed/suspended) listing is still saved to D1 and emails the agent; the buyer still cannot view the listing (detail page 404s). Lead lookup resolves by slug without the visibility gate.
- **WR-06** — `invoice.paid` reactivating a lapsed agent: **Stay lapsed (unchanged).** A late `invoice.paid` does not reactivate a lapsed agent — reactivation requires a new subscription.

---

*Generated 2026-06-15 at v1.0 milestone completion. Audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.*
