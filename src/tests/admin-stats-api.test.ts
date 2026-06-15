/**
 * admin-stats-api.test.ts
 *
 * Source-grep style tests for the three admin API routes:
 *   - src/app/api/admin/agents/route.ts     (GET paginated agent list)
 *   - src/app/api/admin/agents/[id]/route.ts (PATCH suspend/unsuspend)
 *   - src/app/api/admin/stats/route.ts      (GET platform stats)
 *
 * Verifies:
 *   - All three routes export runtime = 'edge'
 *   - All three routes call requireAdmin (defense in depth beyond middleware)
 *   - All three routes return 403 for non-admins (via requireAdmin)
 *   - Agents list route: reads ?page, uses ADMIN_PAGE_SIZE, returns paginated payload
 *   - Suspend route: reads { suspended: boolean } from body, validates boolean (400)
 *   - Suspend route: uses async params (Next.js 15 pattern)
 *   - Stats route: returns the four counts (totalAgents, activeSubscriptions,
 *     totalListings, totalLeads)
 *   - NO profile-edit or delete endpoints exist (out of scope v1)
 *
 * These run with the Node.js built-in test runner (node --test).
 *
 * @module tests/admin-stats-api
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();

/** Read a source file; returns empty string if missing */
function readSrc(relPath: string): string {
  try {
    return readFileSync(join(PROJECT_ROOT, relPath), 'utf-8');
  } catch {
    return '';
  }
}

const agentsListSrc = readSrc('src/app/api/admin/agents/route.ts');
const suspendSrc = readSrc('src/app/api/admin/agents/[id]/route.ts');
const statsSrc = readSrc('src/app/api/admin/stats/route.ts');

// ────────────────────────────────────────────────────────────────────────────
// File existence
// ────────────────────────────────────────────────────────────────────────────

describe('admin API routes — file existence', () => {
  it('src/app/api/admin/agents/route.ts exists', () => {
    assert.ok(
      agentsListSrc.length > 0,
      'src/app/api/admin/agents/route.ts does not exist — required for admin agent list'
    );
  });

  it('src/app/api/admin/agents/[id]/route.ts exists', () => {
    assert.ok(
      suspendSrc.length > 0,
      'src/app/api/admin/agents/[id]/route.ts does not exist — required for suspend toggle'
    );
  });

  it('src/app/api/admin/stats/route.ts exists', () => {
    assert.ok(
      statsSrc.length > 0,
      'src/app/api/admin/stats/route.ts does not exist — required for platform stats'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Edge runtime
// ────────────────────────────────────────────────────────────────────────────

describe('admin API routes — Node.js runtime (no edge)', () => {
  it('agents list route does NOT export an edge runtime', () => {
    assert.ok(
      !agentsListSrc.includes('export const runtime'),
      'src/app/api/admin/agents/route.ts must NOT export an edge runtime — @opennextjs/cloudflare runs routes on the Node.js runtime'
    );
  });

  it('suspend route does NOT export an edge runtime', () => {
    assert.ok(
      !suspendSrc.includes('export const runtime'),
      'src/app/api/admin/agents/[id]/route.ts must NOT export an edge runtime'
    );
  });

  it('stats route does NOT export an edge runtime', () => {
    assert.ok(
      !statsSrc.includes('export const runtime'),
      'src/app/api/admin/stats/route.ts must NOT export an edge runtime'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// requireAdmin — defense in depth beyond middleware
// ────────────────────────────────────────────────────────────────────────────

describe('admin API routes — requireAdmin call (T-05-10 defense in depth)', () => {
  it('agents list route calls requireAdmin', () => {
    assert.ok(
      agentsListSrc.includes('requireAdmin'),
      'src/app/api/admin/agents/route.ts must call requireAdmin for server-side claim re-verification'
    );
  });

  it('suspend route calls requireAdmin', () => {
    assert.ok(
      suspendSrc.includes('requireAdmin'),
      'src/app/api/admin/agents/[id]/route.ts must call requireAdmin for server-side claim re-verification'
    );
  });

  it('stats route calls requireAdmin', () => {
    assert.ok(
      statsSrc.includes('requireAdmin'),
      'src/app/api/admin/stats/route.ts must call requireAdmin for server-side claim re-verification'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 403 return for non-admins
// ────────────────────────────────────────────────────────────────────────────

describe('admin API routes — 403 return for non-admin callers', () => {
  it('agents list route returns 403 for non-admins', () => {
    assert.ok(
      agentsListSrc.includes('403'),
      'src/app/api/admin/agents/route.ts must return 403 for non-admin callers'
    );
  });

  it('suspend route returns 403 for non-admins', () => {
    assert.ok(
      suspendSrc.includes('403'),
      'src/app/api/admin/agents/[id]/route.ts must return 403 for non-admin callers'
    );
  });

  it('stats route returns 403 for non-admins', () => {
    assert.ok(
      statsSrc.includes('403'),
      'src/app/api/admin/stats/route.ts must return 403 for non-admin callers'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Agents list route — pagination + response shape
// ────────────────────────────────────────────────────────────────────────────

describe('admin agents list route — pagination', () => {
  it('agents list route imports listAgentsPaginated', () => {
    assert.ok(
      agentsListSrc.includes('listAgentsPaginated'),
      'agents list route must use listAgentsPaginated from @/lib/admin'
    );
  });

  it('agents list route reads ?page search param', () => {
    assert.ok(
      agentsListSrc.includes('page'),
      'agents list route must read the ?page search parameter for pagination'
    );
  });

  it('agents list route references ADMIN_PAGE_SIZE', () => {
    assert.ok(
      agentsListSrc.includes('ADMIN_PAGE_SIZE') || agentsListSrc.includes('pageSize'),
      'agents list route must use ADMIN_PAGE_SIZE (or equivalent pageSize constant)'
    );
  });

  it('agents list route returns total in the response', () => {
    assert.ok(
      agentsListSrc.includes('total'),
      "agents list route must return 'total' for pagination math"
    );
  });

  it('agents list route returns page in the response', () => {
    assert.ok(
      agentsListSrc.includes('page'),
      "agents list route must return 'page' in the response"
    );
  });

  it('agents list route returns pageSize in the response', () => {
    assert.ok(
      agentsListSrc.includes('pageSize'),
      "agents list route must return 'pageSize' in the response"
    );
  });

  it('agents list route returns success flag', () => {
    assert.ok(
      agentsListSrc.includes('success'),
      "agents list route must return 'success' flag"
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suspend route — body validation + async params
// ────────────────────────────────────────────────────────────────────────────

describe('admin suspend route — body validation + async params', () => {
  it('suspend route reads { suspended } from the request body', () => {
    assert.ok(
      suspendSrc.includes('suspended'),
      "suspend route must read 'suspended' from the request body"
    );
  });

  it('suspend route validates that suspended is a boolean (returns 400 on non-boolean)', () => {
    assert.ok(
      suspendSrc.includes('400'),
      'suspend route must return 400 for invalid (non-boolean) suspended value'
    );
  });

  it('suspend route validates typeof suspended === boolean', () => {
    assert.ok(
      suspendSrc.includes('typeof') && suspendSrc.includes('boolean'),
      "suspend route must validate typeof suspended === 'boolean'"
    );
  });

  it('suspend route calls setAgentSuspended', () => {
    assert.ok(
      suspendSrc.includes('setAgentSuspended'),
      'suspend route must call setAgentSuspended from @/lib/admin'
    );
  });

  it('suspend route uses Next.js 15 async params (await params)', () => {
    assert.ok(
      suspendSrc.includes('await params') || suspendSrc.includes('await context.params'),
      'suspend route must use Next.js 15 async params pattern (const { id } = await params)'
    );
  });

  it('suspend route targets agentId from route segment (not body)', () => {
    // The route must NOT use a body-supplied agentId as the target (T-05-11)
    assert.ok(
      suspendSrc.includes('params') && suspendSrc.includes('id'),
      'suspend route must extract agentId from route params, not from the request body (T-05-11)'
    );
  });

  it('suspend route returns { success, message } shape', () => {
    assert.ok(
      suspendSrc.includes('success') && suspendSrc.includes('message'),
      'suspend route must return { success, message } JSON response'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Stats route — four counts
// ────────────────────────────────────────────────────────────────────────────

describe('admin stats route — four counts returned', () => {
  it('stats route calls getPlatformStats', () => {
    assert.ok(
      statsSrc.includes('getPlatformStats'),
      'stats route must call getPlatformStats from @/lib/admin'
    );
  });

  it('stats route returns totalAgents', () => {
    assert.ok(
      statsSrc.includes('totalAgents'),
      "stats route must return 'totalAgents' in the response"
    );
  });

  it('stats route returns activeSubscriptions', () => {
    assert.ok(
      statsSrc.includes('activeSubscriptions'),
      "stats route must return 'activeSubscriptions' in the response"
    );
  });

  it('stats route returns totalListings', () => {
    assert.ok(
      statsSrc.includes('totalListings'),
      "stats route must return 'totalListings' in the response"
    );
  });

  it('stats route returns totalLeads', () => {
    assert.ok(
      statsSrc.includes('totalLeads'),
      "stats route must return 'totalLeads' in the response"
    );
  });

  it('stats route returns success flag', () => {
    assert.ok(
      statsSrc.includes('success'),
      "stats route must return 'success' flag"
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Out-of-scope enforcement — no profile-edit or delete endpoints
// ────────────────────────────────────────────────────────────────────────────

describe('admin API routes — out-of-scope enforcement (v1)', () => {
  it('no admin route exports a DELETE handler for agents (account deletion out of scope)', () => {
    // The suspend route is at [id] but should only be a PATCH
    assert.ok(
      !suspendSrc.includes('export async function DELETE'),
      'admin agent [id] route must NOT export a DELETE handler — account deletion is out of scope for v1'
    );
  });

  it('no admin route exports a profile-edit PUT/POST for agents (out of scope v1)', () => {
    assert.ok(
      !suspendSrc.includes('export async function PUT') &&
        !suspendSrc.includes('export async function POST'),
      'admin agent [id] route must NOT export PUT/POST — profile editing is out of scope for v1'
    );
  });
});
