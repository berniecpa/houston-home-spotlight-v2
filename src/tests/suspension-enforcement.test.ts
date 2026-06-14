/**
 * Suspension Enforcement Tests — Plan 05-01, Task 3
 *
 * Source-grep assertions verifying that suspended agents are blocked from
 * listing mutations (403) and that the dashboard shows a read-only banner
 * (ADMIN-02, T-05-03).
 *
 * Coverage:
 *   - listings/route.ts POST: is_suspended → 403 after publishability gate
 *   - listings/[id]/route.ts PUT/DELETE/PATCH: is_suspended → 403 via checkSuspended
 *   - listings/[id]/route.ts GET: still allowed (read-only for suspended agents)
 *   - dashboard/layout.tsx: selects is_suspended + renders suspension banner
 *
 * These are structural tests that do not require a live D1 connection —
 * they assert presence of required patterns in implementation files,
 * consistent with the existing test suite style (source-grep).
 *
 * @module tests/suspension-enforcement
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const listingsRoutePath = join(root, 'src/app/api/agent/listings/route.ts');
const idRoutePath       = join(root, 'src/app/api/agent/listings/[id]/route.ts');
const dashboardPath     = join(root, 'src/app/(dashboard)/layout.tsx');

const listingsRoute = readFileSync(listingsRoutePath, 'utf-8');
const idRoute       = readFileSync(idRoutePath, 'utf-8');
const dashboard     = readFileSync(dashboardPath, 'utf-8');

// ---------------------------------------------------------------------------
// listings/route.ts — POST suspension gate
// ---------------------------------------------------------------------------
describe('listings/route.ts — POST suspension gate (T-05-03)', () => {
  it('POST reads is_suspended from agents for the session uid', () => {
    assert.ok(
      listingsRoute.includes('is_suspended'),
      'listings/route.ts POST must read is_suspended from the agents table'
    );
  });

  it('POST returns 403 when is_suspended = 1', () => {
    assert.ok(
      listingsRoute.includes('is_suspended === 1') || listingsRoute.includes('is_suspended == 1'),
      'listings/route.ts POST must check is_suspended === 1 to trigger 403'
    );
  });

  it('POST returns suspended message', () => {
    assert.ok(
      listingsRoute.includes('Account suspended — contact the administrator.'),
      'listings/route.ts POST must return "Account suspended — contact the administrator." message'
    );
  });

  it('suspension gate appears after publishability gate (ordering)', () => {
    const pubIdx = listingsRoute.indexOf('isAgentPublishable');
    const suspIdx = listingsRoute.indexOf('is_suspended');
    assert.ok(
      pubIdx !== -1 && suspIdx !== -1 && suspIdx > pubIdx,
      'Suspension gate must appear after the publishability gate in POST handler'
    );
  });

  it('GET handler does not contain suspension block (read-only access allowed)', () => {
    // GET must NOT have a suspension check — suspended agents can view their own listings
    const getStart = listingsRoute.indexOf('export async function GET');
    const postStart = listingsRoute.indexOf('export async function POST');
    const getBlock = listingsRoute.slice(getStart, postStart);
    assert.ok(
      !getBlock.includes('Account suspended'),
      'GET handler must NOT block suspended agents — they can still view their listings (read-only)'
    );
  });
});

// ---------------------------------------------------------------------------
// listings/[id]/route.ts — PUT/DELETE/PATCH suspension gate
// ---------------------------------------------------------------------------
describe('listings/[id]/route.ts — mutation suspension gates (T-05-03)', () => {
  it('defines checkSuspended helper that checks is_suspended', () => {
    assert.ok(
      idRoute.includes('checkSuspended') && idRoute.includes('is_suspended'),
      '[id]/route.ts must define a checkSuspended helper that reads is_suspended from agents'
    );
  });

  it('checkSuspended returns 403 with suspended message', () => {
    assert.ok(
      idRoute.includes('Account suspended — contact the administrator.'),
      '[id]/route.ts checkSuspended must return 403 with "Account suspended — contact the administrator."'
    );
  });

  it('PUT calls checkSuspended before mutation', () => {
    const putStart = idRoute.indexOf('export async function PUT');
    const deleteStart = idRoute.indexOf('export async function DELETE');
    const putBlock = idRoute.slice(putStart, deleteStart);
    assert.ok(
      putBlock.includes('checkSuspended'),
      'PUT handler must call checkSuspended before mutating the listing'
    );
  });

  it('DELETE calls checkSuspended before mutation', () => {
    const deleteStart = idRoute.indexOf('export async function DELETE');
    const patchStart = idRoute.indexOf('export async function PATCH');
    const deleteBlock = idRoute.slice(deleteStart, patchStart);
    assert.ok(
      deleteBlock.includes('checkSuspended'),
      'DELETE handler must call checkSuspended before mutating the listing'
    );
  });

  it('PATCH calls checkSuspended before mutation', () => {
    const patchStart = idRoute.indexOf('export async function PATCH');
    const patchBlock = idRoute.slice(patchStart);
    assert.ok(
      patchBlock.includes('checkSuspended'),
      'PATCH handler must call checkSuspended before toggling listing status'
    );
  });

  it('GET handler does not call checkSuspended (read-only access allowed)', () => {
    const getStart = idRoute.indexOf('export async function GET');
    const putStart = idRoute.indexOf('export async function PUT');
    const getBlock = idRoute.slice(getStart, putStart);
    assert.ok(
      !getBlock.includes('checkSuspended'),
      'GET handler must NOT call checkSuspended — suspended agents can view their listing details'
    );
  });

  it('suspension check uses session-derived uid (not body)', () => {
    assert.ok(
      idRoute.includes('checkSuspended(db, uid)'),
      'checkSuspended must be called with session uid (T-04-08: uid never from request body)'
    );
  });

  it('checkSuspended uses parameterized SELECT on agents', () => {
    assert.ok(
      idRoute.includes('SELECT is_suspended FROM agents WHERE id = ?'),
      'checkSuspended must use parameterized SELECT on agents to read is_suspended (T-04-06)'
    );
  });
});

// ---------------------------------------------------------------------------
// dashboard/layout.tsx — suspension banner
// ---------------------------------------------------------------------------
describe('dashboard/layout.tsx — suspension banner (ADMIN-02, T-05-03)', () => {
  it('AgentGateRow SELECT includes is_suspended', () => {
    assert.ok(
      dashboard.includes('is_suspended'),
      'dashboard/layout.tsx must select is_suspended from the agents D1 row'
    );
  });

  it('renders Account suspended banner text', () => {
    assert.ok(
      dashboard.includes('Account suspended'),
      'dashboard/layout.tsx must render "Account suspended" banner when agent is suspended'
    );
  });

  it('banner is conditional on isSuspended flag', () => {
    assert.ok(
      dashboard.includes('isSuspended'),
      'dashboard/layout.tsx must derive isSuspended and conditionally render the banner'
    );
  });

  it('banner has role=alert for accessibility', () => {
    assert.ok(
      dashboard.includes('role="alert"'),
      'Suspension banner must have role="alert" for screen reader accessibility'
    );
  });

  it('existing session gate is preserved', () => {
    assert.ok(
      dashboard.includes('getTokens') && dashboard.includes("redirect('/login"),
      'Session gate must still redirect unauthenticated users to /login'
    );
  });

  it('existing profile gate is preserved', () => {
    assert.ok(
      dashboard.includes('isProfileComplete') && dashboard.includes("redirect('/dashboard/profile"),
      'Profile gate must still redirect to /dashboard/profile when profile is incomplete'
    );
  });

  it('fail-closed D1 error handling preserved', () => {
    assert.ok(
      dashboard.includes('readFailed'),
      'Fail-closed D1 read error path must be preserved (readFailed flag)'
    );
  });
});
