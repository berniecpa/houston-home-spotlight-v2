---
phase: 05-admin-panel-agent-profiles
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/lib/admin.ts
  - src/lib/subscription.ts
  - src/lib/data.ts
  - src/app/api/admin/agents/route.ts
  - src/app/api/admin/agents/[id]/route.ts
  - src/app/api/admin/stats/route.ts
  - src/app/api/agent/profile/route.ts
  - src/app/api/agent/listings/route.ts
  - src/app/api/agent/listings/[id]/route.ts
  - src/app/(admin)/admin/agents/page.tsx
  - src/app/(admin)/admin/stats/page.tsx
  - src/components/admin/AgentRow.tsx
  - src/app/agents/[slug]/page.tsx
  - src/components/AgentProfileHeader.tsx
  - src/app/(dashboard)/layout.tsx
  - db/migrations/0004_backfill_agent_slugs.sql
findings:
  critical: 1
  blocker: 1
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 5 admin panel, agent-profile, and suspension-enforcement
surface against the stated security priorities (admin authZ, suspension
visibility gate, PII exposure, suspend-toggle integrity, pagination, D1 safety,
runtime mode).

The implementation is strong on most axes: the `AGENT_VISIBLE_SQL` gate is
applied consistently across `getAllListings`, `getListingBySlug`,
`getAgentProfileBySlug`'s listings query, and the `/api/leads` listing lookup;
the public profile path selects no email/phone and the header component has no
PII fields; the suspend toggle targets the route-segment id and never body
identity; all D1 queries are parameterized; admin API routes correctly
distinguish 401 vs 403 via `requireAdmin()`; admin pages set `force-dynamic`
without `runtime='edge'`; agent listing-mutation routes 403 on suspension using
the session uid (never body identity).

However, there is **one BLOCKER**: the admin **pages** (`/admin/agents`,
`/admin/stats`, and the `(admin)` layout) query D1 and render agent PII /
platform stats **without calling `requireAdmin()`** — they depend entirely on
middleware, directly contradicting the phase's explicit "every admin API route
AND admin page" defense-in-depth requirement. There is also a CRITICAL
availability issue in the profile slug-collision loop, plus several warnings.

## Critical Issues

### CR-01: Unbounded slug-collision loop is an attacker-driven resource-exhaustion vector

**File:** `src/app/api/agent/profile/route.ts:188-201`
**Issue:** The slug-collision resolver is an unbounded `while (true)` loop that
issues one D1 query per iteration with no maximum-iteration cap:

```ts
let resolvedSlug = baseSlug;
let suffix = 2;
while (true) {
  const collision = await env.DB.prepare(
    'SELECT id FROM agents WHERE slug = ? AND id != ?'
  ).bind(resolvedSlug, uid).first<{ id: string }>();
  if (!collision) break;
  resolvedSlug = `${baseSlug}-${suffix}`;
  suffix += 1;
}
```

`baseSlug` is derived from attacker-controlled `display_name`. Many agents with
the same human name (e.g. "John Smith") all collapse to the same `baseSlug`, so
each new save walks the chain `john-smith`, `john-smith-2`, … `john-smith-N`,
issuing N sequential D1 subrequests. On Cloudflare Workers each `.first()` is a
subrequest (capped per invocation) and counts against the CPU-time limit, so a
crafted/duplicated name turns one profile save into an unbounded work amplifier
that can hit subrequest/CPU limits and fail or degrade the worker.
**Fix:** Bound the loop and fall back to a random suffix; let the
`agents.slug UNIQUE` constraint be the real backstop:

```ts
let resolvedSlug = baseSlug;
for (let suffix = 2; ; suffix++) {
  const collision = await env.DB.prepare(
    'SELECT id FROM agents WHERE slug = ? AND id != ?'
  ).bind(resolvedSlug, uid).first<{ id: string }>();
  if (!collision) break;
  if (suffix > 50) {                              // hard cap on D1 round-trips
    resolvedSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    break;
  }
  resolvedSlug = `${baseSlug}-${suffix}`;
}
```

Better: attempt the `UPDATE` directly and catch the UNIQUE-constraint error,
retrying once with a random suffix — turning N queries into 1.

## BLOCKER

### BL-01: Admin pages read D1 and render agent PII / platform stats without calling `requireAdmin()`

**File:** `src/app/(admin)/admin/agents/page.tsx:53-64`, `src/app/(admin)/admin/stats/page.tsx:71-75`, `src/app/(admin)/layout.tsx:44`
**Issue:** The phase brief requires `requireAdmin()` to verify the admin claim
server-side **on EVERY admin API route AND admin page**. The admin API routes
were built explicitly as "defense in depth beyond middleware.ts"
(`src/lib/admin.ts:100-117` and every admin `route.ts` header). The admin
**pages**, however, query D1 and render sensitive data with **no** server-side
claim check:

```ts
// src/app/(admin)/admin/agents/page.tsx
export default async function AgentsPage({ searchParams }: ...) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB as unknown as D1Database;
  // ...no requireAdmin() — straight to D1
  const { agents, total } = await listAgentsPaginated(db, pageSize, offset);
  // renders agent.email for every agent (PII) via AgentRow.tsx:82
```

`(admin)/layout.tsx` explicitly disclaims any check ("middleware is the single
enforcement point"). That makes middleware a **single point of failure**: any
matcher regression, middleware misconfiguration, or adapter quirk that lets a
request reach the RSC exposes **every agent's email** (`AgentRow.tsx:82`) and
full platform stats to any authenticated non-admin. The team already distrusts
middleware/header reliability under this exact adapter — see the elaborate
header fallback logic in `(dashboard)/layout.tsx:118-130` — yet the admin pages
have no fallback at all. This is precisely the gap the brief flags ("Check for
any admin route that forgets to call requireAdmin"): the page routes forgot.
**Fix:** Call `requireAdmin()` at the top of each admin page (or once in
`(admin)/layout.tsx`) and reject on failure:

```ts
import { requireAdmin, isAdminRejection } from '@/lib/admin';
import { notFound } from 'next/navigation';

export default async function AgentsPage({ searchParams }: ...) {
  const adminResult = await requireAdmin();
  if (isAdminRejection(adminResult)) notFound(); // 404 — don't reveal /admin
  // ...proceed to D1
}
```

Guarding `(admin)/layout.tsx` once covers `/admin`, `/admin/agents`, and
`/admin/stats`.

## Warnings

### WR-01: `requireAdmin` admin-claim check is truthy, not strict — non-boolean claim grants access

**File:** `src/lib/admin.ts:131-134` (and `middleware.ts:44`)
**Issue:** The guard is `if (!claims['admin'])`. A custom claim accidentally set
to the string `"false"` (truthy) would **grant** admin. The documented contract
types `admin: boolean`, but the runtime check accepts any truthy value. Custom
claims are set out-of-band via `setCustomUserClaims`; a typo there silently
becomes an authZ grant.
**Fix:** Use strict equality:

```ts
if (claims['admin'] !== true) {
  return { status: 403, message: 'Forbidden: admin access required' };
}
```

Apply the same `=== true` check in `middleware.ts:44`.

### WR-02: Suspend toggle never checks affected-row count — toggling a missing agent "succeeds"

**File:** `src/app/api/admin/agents/[id]/route.ts:115-121`, `src/lib/admin.ts:210-224`
**Issue:** `setAgentSuspended` runs `UPDATE agents ... WHERE id = ?` and ignores
`result.meta.changes`. If `agentId` matches no row (deleted agent, stale id from
a long-open admin tab, fabricated id), the UPDATE affects 0 rows but the route
still returns `{ success: true, message: 'Agent suspended successfully.' }` —
telling the admin an action worked when it did not. The agent-profile route
(`agent/profile/route.ts:228`) already does this check correctly (409 on 0
changes); the admin path should be at least as rigorous.
**Fix:** Return the changed-row count from `setAgentSuspended` and 404 when 0:

```ts
const res = await db.prepare(`UPDATE agents SET is_suspended = ?, updated_at = unixepoch() WHERE id = ?`)
  .bind(suspended ? 1 : 0, agentId).run();
return res.meta?.changes ?? 0;
// route: if (changed === 0) return NextResponse.json({ success:false, message:'Agent not found.' }, { status:404 });
```

### WR-03: Pagination `page` param accepts huge values producing an absurd OFFSET/UI

**File:** `src/app/api/admin/agents/route.ts:59`, `src/app/(admin)/admin/agents/page.tsx:60`
**Issue:** `const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)`. This
correctly floors at 1 (no negative OFFSET) and is not injectable (bound via
`.bind()`). But `parseInt('999999999999999', 10)` is a valid huge integer, so
`offset = (page-1)*pageSize` becomes enormous; D1 returns an empty page and the
UI renders "Page 999999999999999 of N" with nonsensical Prev links. `page` is
never clamped against `totalPages`.
**Fix:** After computing `totalPages`, clamp `page` to `[1, max(1, totalPages)]`
(or cap the raw parse, e.g. `Math.min(parsed, 1_000_000)`), and redirect/clamp
out-of-range pages to the last valid page.

### WR-04: `listAgentsPaginated` returns `rowsResult.results` without a null-guard

**File:** `src/lib/admin.ts:188`
**Issue:** `return { agents: rowsResult.results, total: ... }`. The COUNT result
is defensively guarded (`countResult?.total ?? 0`), but `rowsResult.results` is
returned raw and asymmetrically. `AgentsPage` immediately calls `agents.length`
(`agents/page.tsx:84`) and `agents.map(...)` (line 111); if a future binding
returns an unexpected shape this throws and 500s the whole admin page. The
data layer uses `?? []` defensively elsewhere (`data.ts:138,339`).
**Fix:** `agents: rowsResult.results ?? []`.

## Info

### IN-01: `0004_backfill_agent_slugs.sql` can produce duplicate or divergent slugs

**File:** `db/migrations/0004_backfill_agent_slugs.sql:28-47`
**Issue:** The backfill approximates `slugifyName` with chained `replace()` but
(a) does not strip arbitrary punctuation (only spaces and double-hyphens), so
output diverges from the app's `slugifyName` (e.g. apostrophes/ampersands
survive), and (b) two agents named "John Smith" both backfill to `john-smith`
with no numeric-suffix resolution. If `agents.slug` is UNIQUE the migration may
abort on the first duplicate; if not, two agents share a slug and
`getAgentProfileBySlug` resolves only the first row. The file acknowledges
SQLite lacks regex but ships anyway.
**Fix:** Either document this as best-effort (agents re-save to fix) or run the
backfill in app code reusing `slugifyName` + the collision loop. Confirm whether
`agents.slug` is UNIQUE and that the migration cannot abort mid-run on a
duplicate.

### IN-02: Suspension banner fails to `false` on D1 read error (advisory-only, harmless)

**File:** `src/app/(dashboard)/layout.tsx:111`
**Issue:** `isSuspended` is derived as `false` on a D1 read error, so a suspended
agent during a transient D1 blip sees no banner. Enforcement is correctly
server-side at the mutation routes (403), so this is cosmetic, but the banner's
"actions are disabled" message can momentarily mislead. No action required;
documenting the fail-open-banner behavior.

### IN-03: `isAdminRejection` type guard is structurally fragile for an authZ decision

**File:** `src/lib/admin.ts:92-94`
**Issue:** `'status' in result && 'message' in result && !('uid' in result)`
works for the current two shapes, but a future success shape carrying `message`,
or a rejection gaining `uid`, would misclassify and flip an authZ decision.
Structural `in`-probing is risky for a security-relevant guard.
**Fix:** Add an explicit discriminant (`kind: 'ok' | 'reject'`) to
`AdminTokenResult` / `AdminTokenRejection` and switch on it.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
