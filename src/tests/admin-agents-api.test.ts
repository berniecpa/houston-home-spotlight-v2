/**
 * admin-agents-api.test.ts
 *
 * Source-grep style tests for src/lib/admin.ts.
 *
 * Verifies:
 *   - All four required exports exist (requireAdmin, listAgentsPaginated,
 *     setAgentSuspended, getPlatformStats)
 *   - requireAdmin reads decodedToken.admin and calls getTokens
 *   - listAgentsPaginated uses parameterized LIMIT/OFFSET and COUNT(*)
 *   - setAgentSuspended uses parameterized UPDATE with is_suspended and updated_at
 *   - getPlatformStats issues four COUNT queries (total agents, active subscriptions,
 *     total listings, total leads)
 *   - AdminAgentRow interface exported from admin.ts
 *   - No profile-edit or account-deletion helpers (out of scope v1)
 *
 * These run with the Node.js built-in test runner (node --test).
 *
 * @module tests/admin-agents-api
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const ADMIN_LIB = join(PROJECT_ROOT, 'src', 'lib', 'admin.ts');

/** Read admin.ts source once for all assertions */
let adminSrc: string;
try {
  adminSrc = readFileSync(ADMIN_LIB, 'utf-8');
} catch {
  adminSrc = '';
}

// ────────────────────────────────────────────────────────────────────────────
// File existence
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — file existence', () => {
  it('admin.ts exists at src/lib/admin.ts', () => {
    assert.ok(
      adminSrc.length > 0,
      'src/lib/admin.ts does not exist or is empty — required for admin helpers'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — required exports', () => {
  it('exports requireAdmin function', () => {
    assert.ok(
      adminSrc.includes('export') && adminSrc.includes('requireAdmin'),
      'admin.ts must export requireAdmin'
    );
  });

  it('exports listAgentsPaginated function', () => {
    assert.ok(
      adminSrc.includes('export') && adminSrc.includes('listAgentsPaginated'),
      'admin.ts must export listAgentsPaginated'
    );
  });

  it('exports setAgentSuspended function', () => {
    assert.ok(
      adminSrc.includes('export') && adminSrc.includes('setAgentSuspended'),
      'admin.ts must export setAgentSuspended'
    );
  });

  it('exports getPlatformStats function', () => {
    assert.ok(
      adminSrc.includes('export') && adminSrc.includes('getPlatformStats'),
      'admin.ts must export getPlatformStats'
    );
  });

  it('exports AdminAgentRow interface', () => {
    assert.ok(
      adminSrc.includes('AdminAgentRow'),
      'admin.ts must export AdminAgentRow interface'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// requireAdmin — admin-claim verification
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — requireAdmin admin-claim check', () => {
  it('requireAdmin calls getTokens for session verification', () => {
    assert.ok(
      adminSrc.includes('getTokens'),
      'requireAdmin must call getTokens to verify the session cookie'
    );
  });

  it('requireAdmin checks decodedToken.admin claim', () => {
    assert.ok(
      adminSrc.includes('decodedToken.admin') || adminSrc.includes("claims['admin']"),
      'requireAdmin must gate on the admin claim (not a body-supplied flag)'
    );
  });

  it('requireAdmin uses STRICT equality on the admin claim (WR-01)', () => {
    assert.ok(
      adminSrc.includes("claims['admin'] !== true") ||
        adminSrc.includes('claims["admin"] !== true'),
      'requireAdmin must use strict !== true on the admin claim — a truthy non-boolean must NOT grant admin (WR-01)'
    );
  });

  it('requireAdmin does NOT use a loose truthy admin check (WR-01)', () => {
    assert.ok(
      !adminSrc.includes("if (!claims['admin'])") &&
        !adminSrc.includes('if (!claims["admin"])'),
      'requireAdmin must NOT gate on a loose truthy !claims[admin] check (WR-01)'
    );
  });

  it('requireAdmin references authEdgeConfig', () => {
    assert.ok(
      adminSrc.includes('authEdgeConfig'),
      'requireAdmin must pass authEdgeConfig to getTokens (mirrors existing session pattern)'
    );
  });

  it('requireAdmin signals a 401 path for missing token', () => {
    assert.ok(
      adminSrc.includes('401'),
      'requireAdmin must signal 401 when no token is present'
    );
  });

  it('requireAdmin signals a 403 path for non-admin token', () => {
    assert.ok(
      adminSrc.includes('403'),
      'requireAdmin must signal 403 when the token lacks the admin claim'
    );
  });

  it('requireAdmin never trusts request body for the admin decision', () => {
    // Must NOT read `admin` from the request body. We check that body/req
    // is NOT a parameter of requireAdmin. This is a structural check that
    // the helper derives admin status purely from the session token.
    // The function signature should accept cookies only (no NextRequest body).
    const fnMatch = adminSrc.match(/export\s+(?:async\s+)?function\s+requireAdmin\s*\(([^)]*)\)/);
    if (fnMatch) {
      const params = fnMatch[1];
      // requireAdmin should NOT take a NextRequest or body parameter
      assert.ok(
        !params.includes('request') && !params.includes('body'),
        'requireAdmin must not accept a request/body parameter — admin identity from session only'
      );
    } else {
      // Arrow function or other export form — just ensure no body read
      assert.ok(
        !adminSrc.includes('request.json()'),
        'requireAdmin must not read request.json() — admin identity from session only'
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// listAgentsPaginated — query structure
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — listAgentsPaginated query structure', () => {
  it('listAgentsPaginated uses LIMIT in the query', () => {
    assert.ok(
      adminSrc.includes('LIMIT'),
      'listAgentsPaginated must use LIMIT for server-side pagination (T-05-14)'
    );
  });

  it('listAgentsPaginated uses OFFSET in the query', () => {
    assert.ok(
      adminSrc.includes('OFFSET'),
      'listAgentsPaginated must use OFFSET for server-side pagination'
    );
  });

  it('listAgentsPaginated uses COUNT(*) for total count', () => {
    assert.ok(
      adminSrc.includes('COUNT(*)'),
      'listAgentsPaginated must issue a COUNT(*) query to return the total agent count'
    );
  });

  it('listAgentsPaginated uses prepare().bind() for parameterization', () => {
    assert.ok(
      adminSrc.includes('.bind('),
      'listAgentsPaginated must use prepare().bind() to prevent SQL injection (T-05-12)'
    );
  });

  it('listAgentsPaginated selects display_name, email, subscription_status, is_suspended', () => {
    assert.ok(
      adminSrc.includes('display_name') &&
        adminSrc.includes('email') &&
        adminSrc.includes('subscription_status') &&
        adminSrc.includes('is_suspended'),
      'listAgentsPaginated must select display_name, email, subscription_status, is_suspended'
    );
  });

  it('listAgentsPaginated orders by created_at DESC', () => {
    assert.ok(
      adminSrc.includes('created_at') && adminSrc.includes('DESC'),
      'listAgentsPaginated must ORDER BY created_at DESC for consistent pagination'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// setAgentSuspended — UPDATE structure
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — setAgentSuspended UPDATE structure', () => {
  it('setAgentSuspended issues an UPDATE statement', () => {
    assert.ok(
      adminSrc.includes('UPDATE agents'),
      'setAgentSuspended must UPDATE the agents table'
    );
  });

  it('setAgentSuspended sets is_suspended in the UPDATE', () => {
    assert.ok(
      adminSrc.includes('is_suspended'),
      'setAgentSuspended must update the is_suspended column'
    );
  });

  it('setAgentSuspended updates updated_at via unixepoch()', () => {
    assert.ok(
      adminSrc.includes('updated_at') && adminSrc.includes('unixepoch()'),
      'setAgentSuspended must set updated_at = unixepoch() to track the change time'
    );
  });

  it('setAgentSuspended uses parameterized query (T-05-12)', () => {
    // Verify parameterized via .bind() calls near the UPDATE
    assert.ok(
      adminSrc.includes('.bind('),
      'setAgentSuspended must use prepare().bind() — no string concatenation (T-05-12)'
    );
  });

  it('setAgentSuspended targets agentId from the route segment (not body identity)', () => {
    // The function signature must accept an agentId parameter
    const fnMatch = adminSrc.match(
      /export\s+(?:async\s+)?function\s+setAgentSuspended\s*\(([^)]*)\)/
    );
    if (fnMatch) {
      assert.ok(
        fnMatch[1].includes('agentId') || fnMatch[1].includes('id'),
        'setAgentSuspended must accept an agentId parameter (target from route, not body identity)'
      );
    } else {
      // Arrow or other form — check the source for agentId usage
      assert.ok(
        adminSrc.includes('agentId'),
        'setAgentSuspended must use agentId parameter to target the correct agent row'
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getPlatformStats — four COUNT queries
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — getPlatformStats COUNT queries', () => {
  it('getPlatformStats returns totalAgents', () => {
    assert.ok(
      adminSrc.includes('totalAgents'),
      'getPlatformStats must return totalAgents count'
    );
  });

  it('getPlatformStats returns activeSubscriptions', () => {
    assert.ok(
      adminSrc.includes('activeSubscriptions'),
      "getPlatformStats must return activeSubscriptions (WHERE subscription_status='active')"
    );
  });

  it('getPlatformStats returns totalListings', () => {
    assert.ok(
      adminSrc.includes('totalListings'),
      'getPlatformStats must return totalListings count'
    );
  });

  it('getPlatformStats returns totalLeads', () => {
    assert.ok(
      adminSrc.includes('totalLeads'),
      'getPlatformStats must return totalLeads count'
    );
  });

  it('getPlatformStats filters active subscriptions by subscription_status', () => {
    assert.ok(
      adminSrc.includes("subscription_status = 'active'") ||
        adminSrc.includes("subscription_status='active'"),
      "getPlatformStats must filter active subscriptions via subscription_status = 'active'"
    );
  });

  it('getPlatformStats queries the listings table for total listings', () => {
    assert.ok(
      adminSrc.includes('FROM listings'),
      'getPlatformStats must query the listings table for totalListings'
    );
  });

  it('getPlatformStats queries the leads table for total leads', () => {
    assert.ok(
      adminSrc.includes('FROM leads'),
      'getPlatformStats must query the leads table for totalLeads'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Out-of-scope enforcement — no profile-edit or delete helpers
// ────────────────────────────────────────────────────────────────────────────

describe('src/lib/admin.ts — out-of-scope enforcement (v1)', () => {
  it('admin.ts does not export a deleteAgent helper (out of scope v1)', () => {
    assert.ok(
      !adminSrc.includes('deleteAgent'),
      'admin.ts must NOT export deleteAgent — account deletion is out of scope for v1'
    );
  });

  it('admin.ts does not export an updateAgentProfile helper (out of scope v1)', () => {
    assert.ok(
      !adminSrc.includes('updateAgentProfile'),
      'admin.ts must NOT export updateAgentProfile — profile editing by admin is out of scope for v1'
    );
  });
});
