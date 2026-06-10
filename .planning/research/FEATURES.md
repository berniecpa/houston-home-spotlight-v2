# Feature Landscape

**Domain:** Subscription-based real estate listing marketplace (agent-facing SaaS, buyer-facing public browse)
**Project:** Houston Home Spotlight v2
**Researched:** 2026-06-10
**Confidence:** HIGH (cross-referenced kvCORE/BoldTrail, AgentFire, Luxury Presence, BoldLeads, Homesnap Pro, Placester, RealEstateSites)

---

## Context

This is a two-sided platform: agents pay a monthly subscription to publish listings; buyers browse publicly for free. The operator (Bernard) is platform admin and also routes leads. This is a niche regional marketplace — Houston area only — not a full MLS replacement or agent website product. That scope distinction is critical: agents are buying **listing distribution + lead routing**, not a full CRM or IDX website. This keeps the feature set tractable.

---

## Table Stakes

Features agents expect. Missing any of these = agents churn or never sign up.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Agent self-registration + login | No agent will call to get an account; self-service is baseline SaaS | Low | Firebase Auth; email/password + email verification |
| Agent profile (name, photo, phone, brokerage, license #) | Buyers need to contact a real person; platforms without this feel anonymous | Low | Single profile form; stored in D1 |
| Create / edit / delete own listings | Core product value; without this the subscription has no delivery | Medium | CRUD form with validation; D1 backend |
| Listing detail: photos, price, beds/baths, address, description | Buyers expect at minimum what Zillow shows for a single listing | Low | Already partially exists in current codebase |
| Listing visibility tied to active subscription | Agents need to understand their listings go offline if they don't pay; this is the model | Low | Stripe webhook to D1 status column |
| Subscription checkout (Stripe) | Required to collect payment; Stripe is table stakes for SaaS | Medium | Stripe Checkout hosted page is fastest path |
| Subscription management (upgrade, cancel, update card) | Agents need self-service billing or they call Bernard constantly | Low | Stripe Customer Portal handles this entirely |
| Lead / inquiry notification to agent | If buyers submit inquiries and agents never hear about it, the product delivers no value | Low | Email via transactional provider (Resend/Postmark); no SMS required in v1 |
| Agent lead inbox in dashboard | Agents want to see all inquiries for their listings in one place | Medium | Query D1 leads table filtered by agent_id |
| 7-day grace period on payment failure | Hard cutoffs cause panic and churn; grace period is the professional standard | Low | Stripe webhook invoice.payment_failed sets grace status; cron job checks expiry |
| Public listing browse with price + bed filter | Buyers expect to filter; without this the public site is just a list | Low | Already exists; must survive architectural migration |
| Public listing detail page | Already exists; must not regress | Low | Already exists in current codebase |
| Bernard admin panel (manage agents, suspend, view stats) | Bernard must be able to moderate the platform and respond to complaints | Medium | Admin role via Firebase custom claim; agent list + suspension toggle |
| Password reset / account recovery | Agents lock themselves out; no reset = calls to Bernard | Low | Firebase Auth built-in; link in login UI |
| Subscription status visible on dashboard | Agents need to know their billing state (active, grace, suspended) | Low | Read Stripe status from D1 agents table |

---

## Differentiators

Features that set Houston Home Spotlight apart. Not universally expected, but create stickiness and competitive advantage when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI listing video (Seedance / HiggsField / Kie) | Agents on comparable platforms ($49-$149/mo) do not get video generation; this is a genuine differentiator vs. AgentFire, Placester, RealEstateSites | High | Phase TBD per PROJECT.md; requires API integration + generated video URL on listing detail |
| Houston-specific SEO (neighborhood / zip code pages) | Hyperlocal SEO is proven churn-reducer on AgentFire; area-guide pages for Houston neighborhoods drive organic buyer traffic | Medium | Static or ISR pages per neighborhood; targets "homes for sale in [Houston neighborhood]" queries |
| Listing performance analytics per agent | Views, inquiry count, days on market per listing — agents love data about their own listings | Medium | D1 query on listing_views + leads tables; simple chart |
| Agent public profile page (shareable URL) | Agents can share houstonhomespotlight.com/agents/[slug] and see all their active listings | Low | Public SSG/ISR page; doubles as SEO surface |
| Listings CC'd to Bernard for platform awareness | Platform owner stays informed of every lead; enables quality control and future feature ideas | Low | Already in requirements; trivial email copy |
| Fast listing creation (under 5 minutes) | kvCORE and full-stack platforms take 30-60 min to onboard; a focused tool wins on simplicity | Low | Streamlined form: 10-12 fields max, URL-paste photos, no file upload |
| Transparent pricing (one public page) | Agents are skeptical of "contact us for pricing"; clear pricing builds trust for a niche marketplace | Low | Single pricing page with one or two tiers |
| Graceful lapse UX (countdown banner before go-offline) | Better than silent takedown; agents who see "your listings go offline in 3 days" renew proactively | Low | Banner in dashboard when subscription is in grace period |

---

## Anti-Features

Features to explicitly NOT build in v1. These are the over-engineering traps that delay launch and add no validated value yet.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| MLS / IDX integration | Complex data licensing, expensive feed access ($200-$600/mo), legal liability; no buyer expects MLS data from a niche marketplace | Manual listing entry only; URL-paste photos |
| Photo file upload to R2 | Storage infra, file size limits, CDN config, malware scanning; agents already have photos hosted elsewhere | URL paste; document in onboarding that MLS photos, Google Drive links, or Dropbox links work |
| Buyer accounts / buyer dashboard | Adds auth complexity for a side of the market that converts without accounts; anonymous browse + inquiry form is proven | Anonymous browse; inquiry form captures email/phone naturally |
| Built-in CRM (contact management, pipeline, deals) | kvCORE charges $500+/mo for this; replicating it adds months of dev for zero subscription uplift at v1 prices | Deliver leads to agent email; they use their own CRM |
| SMS lead notifications | Twilio/AWS SNS integration adds carrier compliance (A2P 10DLC registration) and infra cost; email under 1 min is sufficient | Email-only lead notification in v1; revisit SMS if agents request it post-launch |
| Multi-tier subscription pricing | Pricing complexity increases support burden and Stripe integration complexity; one tier validates the model faster | Start with a single subscription price; add tiers after first 10 paying agents |
| Team / brokerage sub-accounts | Teams need seat management, permission hierarchies, billing split; none of that is tractable in v1 | One agent = one subscription; teams each subscribe individually |
| Map search / school district filter / neighborhood polygon | Engineering-heavy; Google Maps API costs scale with traffic; buyers in a niche regional site use price + bed filter | Price range + bedroom count filter; add map in v2 after validating demand |
| Blog / CMS | No content management value in v1; listing pages are the product | Listings only; no editorial layer |
| Saved searches / buyer alerts | Requires buyer accounts and email automation pipelines; high complexity, low v1 priority | Buyers browse manually; add saved searches only if retention data shows need |
| Automated social media syndication | OAuth flows, post scheduling, image formatting; not core listing value | Agents copy listing URL and post manually |
| White-label / multi-tenant | Adds routing complexity, per-tenant config, subdomain management; Bernard is the only operator | Single platform identity; no tenant layer |
| AI chatbot / virtual assistant | GPT integration for buyer Q&A adds hallucination risk on legal/financial questions | Standard inquiry form only |
| Per-listing pricing / credits | Complicates Stripe integration; creates agent behavior of gaming which listings to keep active | Flat subscription: unlimited listings while subscribed |
| In-app messaging / agent-buyer chat | Real-time chat requires WebSocket infrastructure, notification management; inquiry form email is enough | Email-based inquiry; no in-platform messaging |
| Document / contract storage | Legal risk, storage cost, e-signature compliance; not a listing marketplace feature | Out of scope entirely |

---

## Feature Dependencies

```
Firebase Auth (register/login)
    -> Agent Profile (create on first login)
        -> Stripe Subscription Checkout
            -> Listing CRUD (unlocked after subscription active)
                -> Listing Detail Page (public, from D1)
                    -> Inquiry Form -> Lead Notification Email -> Agent Lead Inbox
            -> Subscription Status (dashboard widget, grace period banner)
            -> 7-day Grace Period (Stripe webhook -> D1 status)

Bernard Admin Panel
    -> Firebase Custom Claim (admin role)
        -> Agent List / Suspend
        -> Platform Stats (listing count, agent count, lead count)
```

Key dependency: **subscription must be active before listing creation is unlocked**. This is the activation gate that makes the business model work. The onboarding flow enforces it.

---

## Ideal Onboarding Flow

Based on SaaS conversion research (hard paywalls convert at 12.1% vs 2.2% freemium; activation within 48 hours is critical) and real estate agent platform patterns:

```
1. Land on marketing/pricing page
2. Click "Get Started" / "List Your Properties"
3. Register: email + password (Firebase Auth)
   -> Verify email (Firebase sends link)
4. Profile setup: name, phone, brokerage, license # (required before proceeding)
5. Stripe Checkout: subscribe ($79/mo recommended)
   -> Success -> webhook creates agent record in D1 with status: active
6. Dashboard lands with "Create Your First Listing" CTA (prominent, no friction)
7. Listing form: address, price, beds, baths, description, photo URLs (5-10 min)
8. Listing published -> agent sees live preview link
9. (Background) Welcome email with tips, listing URL, support contact
```

Critical UX rules:
- Profile setup comes BEFORE payment; agents need to feel invested before the paywall
- Payment comes BEFORE listing creation; no trial listings (simplifies billing logic)
- First listing CTA is the activation event; measure time-to-first-listing as primary activation metric
- Keep the listing form under 12 fields; every extra field increases drop-off

---

## Subscription Pricing Reference

Comparable platforms and their pricing:

| Platform | Model | Price Point | Notes |
|----------|-------|-------------|-------|
| AgentFire | Monthly + setup fee | $129-$299/mo + $199-$2,499 setup | WordPress-based; full website product |
| Luxury Presence | Monthly + setup | $300-$1,500/mo + $3,500-$5,000 setup | Premium brand positioning |
| Placester | Monthly subscription | $64-$119/mo | IDX website builder |
| RealEstateSites | Monthly subscription | $49-$149/mo | Simple listing-focused; closest analog to this project |
| BoldLeads | Monthly + ad spend | $269/mo + $250/mo leads | Lead gen product; not pure marketplace |
| Homesnap Pro+ | Annual subscription | ~$49.99/mo billed annually | MLS-backed; free at many MLSs; different value prop |
| kvCORE/BoldTrail | Per-brokerage | $500-$1,200+/mo | Full brokerage platform; different category |

Recommendation for Houston Home Spotlight v1:
- **Single tier: $79/month** — above the commodity floor ($49) but below mid-market ($129+); positions as a focused tool, not a budget option
- No setup fee — removes friction; the subscription IS the commitment
- Annual option (v2): $699/year (~26% discount; 2 months free) — improves LTV and reduces churn; add after validating monthly model
- No free trial — hard paywall with clear pricing; real estate agents are decisive professionals who respond to clarity
- Future tier (v2): $129/month with AI video generation included — natural upgrade path once Seedance integration ships

---

## MVP Recommendation

**Phase 1 — Auth + Billing Foundation:**
- Firebase Auth (register, login, email verify, password reset)
- Agent profile form (name, photo URL, phone, brokerage, license #)
- Stripe subscription checkout (single tier, $79/mo)
- Stripe Customer Portal (billing self-service)
- Stripe webhooks (created, renewed, cancelled, payment_failed, grace period)
- Subscription status widget in agent dashboard

**Phase 2 — Listings + Leads:**
- Listing CRUD (create, edit, delete, status toggle)
- D1 schema: agents, listings, leads tables
- Listing visibility gate (active subscription required)
- Public listing browse + detail pages (migrated from static JSON to D1)
- Inquiry form -> email notification to agent + Bernard
- Agent lead inbox (dashboard view, filtered by agent_id)

**Phase 3 — Admin + Polish:**
- Bernard admin panel (agent list, suspend, platform stats)
- Agent public profile page (shareable URL)
- Graceful lapse UI (countdown banner, listings-offline state)
- Listing performance analytics (views + inquiry count per listing)
- Houston neighborhood SEO pages (static or ISR)

**Phase 4+ (Post-validation):**
- AI video generation (Seedance / HiggsField)
- Annual pricing option
- SMS notifications (only if agents request post-launch)
- Saved searches / buyer alerts
- Enhanced analytics and reporting

---

## Sources

- [kvCORE Review: Pricing, Features, Pros & Cons — The Close](https://theclose.com/kvcore-review/)
- [BoldTrail Platform — Inside Real Estate](https://boldtrail.com/platform/)
- [AgentFire Review 2026 — Luxury Presence](https://www.luxurypresence.com/blogs/agentfire-review/)
- [Luxury Presence Pricing Plans](https://www.luxurypresence.com/pricing-plans/)
- [AgentFire vs. Luxury Presence Comparison](https://www.luxurypresence.com/comparison/luxury-presence-vs-agentfire/)
- [Homesnap Pro+ Overview](https://support.homesnap.com/hc/en-us/articles/360010896853-Homesnap-Pro-Overview)
- [BoldLeads Review — UnifyRealEstate](https://unifyrealestate.com/leads/boldleads/)
- [PropTech SaaS Benchmarks: Churn Rate — Qubit Capital](https://qubit.capital/blog/proptech-saas-kpi-benchmarks)
- [Smart Lead Routing for Real Estate Agents — iHomefinder](https://www.ihomefinder.com/blog/agent-and-broker-resources/lead-routing-for-real-estate/)
- [How to Build a Real Estate Marketplace Platform — LowCode Agency](https://www.lowcode.agency/blog/how-to-build-a-real-estate-marketplace-platform)
- [Hard Paywall vs. Freemium Conversion — INSART Case Study](https://insart.com/case-study-insart-saas-paywalls-free-trial-conversion/)
- [RealEstateSites Pricing](https://www.realestatesites.com/pricing/)
- [Placester Pricing](https://placester.com/pricing)
- [15 SaaS Ideas for Real Estate Agents — Medium](https://medium.com/@urano10/15-saas-ideas-for-real-estate-agents-5k-mrr-potential-aa67587e41ad)
