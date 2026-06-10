# Codebase Concerns

**Analysis Date:** 2026-06-10

## Tech Debt

**Duplicate data-loading modules:**
- Issue: Two nearly identical modules implement the same listing-loading logic with the same in-memory cache pattern, function signatures, and JSON import list. They diverge only in function name (`loadListings` vs `getAllListings`) and `getListingBySlug` return type (`Listing | undefined` vs `Listing | null`).
- Files: `src/lib/listings.ts`, `src/lib/data.ts`
- Impact: Any change to listing loading (adding a file, changing cache logic) must be made in two places. Callers import from different modules (`src/app/page.tsx` uses `@/lib/data`, `src/app/listings/[slug]/page.tsx` uses `@/lib/data`, `src/app/listings/page.tsx` bypasses both and imports JSON directly). Consistency is impossible to maintain.
- Fix approach: Delete `src/lib/listings.ts` and migrate all consumers to `src/lib/data.ts`. Standardize `getListingBySlug` return type to `Listing | null`.

**Listings page bypasses the shared data library:**
- Issue: `src/app/listings/page.tsx` (lines 73-77) directly imports the three JSON files via dynamic `import()` instead of calling `getAllListings()` from either lib module. This duplicates the hardcoded file list a third time.
- Files: `src/app/listings/page.tsx`
- Impact: Adding a new listing JSON file requires updating three separate locations: `src/lib/data.ts`, `src/lib/listings.ts`, and `src/app/listings/page.tsx`.
- Fix approach: Replace the inline dynamic imports in `src/app/listings/page.tsx` with a call to `getAllListings()` from `@/lib/data`.

**Hardcoded listing file manifest in three places:**
- Issue: All three data modules maintain a hardcoded array of import paths. There is no dynamic discovery — every new listing requires a code change in multiple files.
- Files: `src/lib/data.ts` (lines 23-27), `src/lib/listings.ts` (lines 23-27), `src/app/listings/page.tsx` (lines 74-76)
- Impact: Adding a listing is a developer task, not a content task. Prone to omission errors.
- Fix approach: Create a central `src/data/listings/index.ts` barrel that re-exports all listings as an array, so there is a single place to add entries.

**Module-level mutable cache as global state:**
- Issue: Both `src/lib/data.ts` and `src/lib/listings.ts` use a module-level `let listingsCache` variable. In a server-rendered or edge runtime context this can leak data between requests.
- Files: `src/lib/data.ts` (line 9), `src/lib/listings.ts` (line 9)
- Impact: For static export (`output: 'export'`) this is benign, but if SSR or additional API routes are added that call these helpers, the cache becomes a shared-state bug.
- Fix approach: Document the static-export assumption explicitly in the module. If SSR is ever added, replace with a request-scoped cache or `unstable_cache`.

## Security Considerations

**No rate limiting on the leads API:**
- Risk: `POST /api/leads` performs no rate limiting. Any caller can submit unlimited lead forms, flooding both application logs and the Perfex CRM.
- Files: `src/app/api/leads/route.ts`
- Current mitigation: None. Cloudflare Pages may provide basic DDoS protection at the network layer only.
- Recommendations: Add Cloudflare rate limiting rules for `/api/leads`, or implement a server-side token bucket using a KV store.

**No input length validation on API fields:**
- Risk: The leads API validates presence and email format but enforces no maximum lengths on `firstname`, `lastname`, `phonenumber`, or `description`. Arbitrarily large payloads pass through to Perfex CRM.
- Files: `src/app/api/leads/route.ts` (lines 27-50)
- Current mitigation: None.
- Recommendations: Add `maxLength` checks (e.g., 100 chars for name fields, 2000 for description) before the CRM call. Add corresponding `maxLength` HTML attributes to inputs in `src/components/InquiryForm.tsx`.

**Phone number validated only on the client:**
- Risk: `isValidPhone()` in `src/components/InquiryForm.tsx` (line 70) validates phone format client-side. The API treats `phonenumber` as required but performs no format validation server-side. Any string passes through to the CRM.
- Files: `src/app/api/leads/route.ts`, `src/components/InquiryForm.tsx`
- Current mitigation: Client-side validation only (bypassable).
- Recommendations: Mirror the phone format check server-side in the API route.

**`dangerouslySetInnerHTML` for JSON-LD structured data:**
- Risk: `src/app/listings/[slug]/page.tsx` (line 201) injects structured data using `dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}`. If any listing field contains `</script>`, the injected JSON can break out of the script tag.
- Files: `src/app/listings/[slug]/page.tsx` (line 201)
- Current mitigation: Data comes from local JSON files (controlled), so risk is low for current content.
- Recommendations: Replace `JSON.stringify` with a serializer that escapes `</` to `<\/` to prevent script injection if listing data ever comes from user-controlled sources.

**Silent success when CRM is not configured:**
- Risk: When `PERFEX_RE_URL` and `PERFEX_RE_KEY` are absent, the API returns a `200 success` response and only logs lead data to stdout. In a production deployment without env vars set, leads are silently dropped.
- Files: `src/app/api/leads/route.ts` (lines 119-136)
- Current mitigation: `console.log` output visible only in Cloudflare Pages logs.
- Recommendations: Add a startup check or monitoring alert for missing CRM config. Consider routing to an email fallback or returning `503 Service Unavailable` to make the failure visible.

## Performance Bottlenecks

**In-memory cache ineffective in Cloudflare Workers:**
- Problem: The module-level `listingsCache` in both lib files is populated on first load. Cloudflare Workers spin up fresh isolates per request, so the cache provides no benefit in production — each worker invocation re-runs all three dynamic JSON imports.
- Files: `src/lib/data.ts` (line 9), `src/lib/listings.ts` (line 9)
- Cause: Module-level state in serverless/edge is not persistent across invocations.
- Improvement path: Given `output: 'export'` in `next.config.mjs`, the site is static HTML/JS and the cache comment in both lib modules is misleading. Document that caching is effective only during the static build phase, not at runtime.

## Fragile Areas

**Version mismatch: Next.js 15 with eslint-config-next 14:**
- Files: `package.json` (lines 17, 28)
- Why fragile: `next` is pinned at `^15.5.2` but `eslint-config-next` is pinned at `14.2.35`. ESLint rules specific to Next.js 15 App Router patterns are absent or incorrect, leading to false negatives in linting.
- Safe modification: Run `npm install eslint-config-next@15` to align versions.
- Test coverage: ESLint errors only surface during `npm run lint`, not in tests.

**Tests are source-inspection tests, not behavioral tests:**
- Files: `src/tests/` (all test files)
- Why fragile: Many tests assert that source files contain certain strings rather than running code and verifying behavior. For example, `src/tests/listings-page.test.ts` (line 339) asserts `content.includes("import(\"@/data/listings/sugarland-estate-pool.json\")")`. These tests break on legitimate refactors and provide no protection against runtime regressions.
- Safe modification: Consolidating JSON imports into a barrel file will break multiple passing tests even if runtime behavior is unchanged.
- Test coverage: High file count, low behavioral coverage.

**`src/components/InquiryForm.tsx` exceeds 500-line limit:**
- Files: `src/components/InquiryForm.tsx` (531 lines)
- Why fragile: Single component handles form state, all validation logic, submission, error display, and accessibility in one file. Exceeds the project's 500-line guideline.
- Safe modification: Extract validation functions to `src/lib/validation.ts` and submission handler to a custom hook.

**`src/app/listings/[slug]/page.tsx` approaching limit:**
- Files: `src/app/listings/[slug]/page.tsx` (429 lines)
- Why fragile: Contains the full detail page render, metadata generation, structured data generation, and `generateStaticParams` in one file.
- Safe modification: Extract `generateListingStructuredData` to `src/lib/seo.ts`.

## Missing Critical Features

**No email fallback for lead submissions:**
- Problem: If Perfex CRM is down or misconfigured, leads are logged to stdout and permanently lost. There is no email notification, webhook, or secondary storage fallback.
- Blocks: A prospect inquiry during a CRM outage is unrecoverable.

**No CAPTCHA or bot-protection on the inquiry form:**
- Problem: The contact form at `src/app/contact/page.tsx` and the inquiry form in `src/components/InquiryForm.tsx` have no bot protection of any kind.
- Blocks: Spam campaigns can flood the CRM with fake leads at zero cost.

**No environment variable validation at startup:**
- Problem: Neither `src/lib/data.ts`, `src/app/api/leads/route.ts`, nor `next.config.mjs` validate that required env vars (`PERFEX_RE_URL`, `PERFEX_RE_KEY`) are present at deploy time.
- Blocks: Production deployments can fail silently without clear diagnostics.

## Test Coverage Gaps

**API route not tested with a real or mocked HTTP handler:**
- What's not tested: The actual HTTP behavior of `POST /api/leads` — status codes, response shapes, rejection of malformed payloads — is tested only via source-string inspection.
- Files: `src/tests/leads-api.test.ts`
- Risk: A logic error in the route handler would not be caught by the current test suite.
- Priority: High

**No behavioral tests for data lib functions:**
- What's not tested: `getAllListings()`, `filterListings()`, `getListingBySlug()` are not tested against actual data loading. `src/tests/data.test.ts` checks source content strings, not function return values.
- Files: `src/tests/data.test.ts`, `src/lib/data.ts`, `src/lib/listings.ts`
- Risk: A JSON schema change in a listing file could break data loading silently.
- Priority: High

**No E2E tests:**
- What's not tested: Full user flows — browsing listings, filtering, submitting the inquiry form — are not covered by any end-to-end test. No Playwright or Cypress config is present.
- Files: None (absent)
- Risk: UI regressions in critical conversion flows go undetected before deployment.
- Priority: Medium

---

*Concerns audit: 2026-06-10*
