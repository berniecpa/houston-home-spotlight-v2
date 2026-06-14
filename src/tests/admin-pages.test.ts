/**
 * admin-pages.test.ts
 *
 * Source-grep style tests for the admin panel pages and components:
 *   - src/app/(admin)/admin/agents/page.tsx     (paginated agent list + toggle)
 *   - src/app/(admin)/admin/stats/page.tsx      (platform stats cards)
 *   - src/app/(admin)/layout.tsx                (sidebar nav links)
 *   - src/components/admin/AgentRow.tsx          ('use client' suspend toggle)
 *
 * Verifies:
 *   - agents/page.tsx is force-dynamic, renders the four columns (display_name,
 *     email, subscription_status, account status), pagination controls, AgentRow
 *   - agents/page.tsx has robots noindex metadata
 *   - AgentRow.tsx is 'use client', PATCHes /api/admin/agents/[id] with { suspended }
 *     and calls router.refresh(); reflects is_suspended; shows pending/disabled state
 *   - stats/page.tsx is force-dynamic, renders four stat cards, robots noindex
 *   - layout.tsx sidebar includes links to /admin/agents and /admin/stats
 *
 * These run with the Node.js built-in test runner (node --test).
 *
 * @module tests/admin-pages
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

const agentsPageSrc = readSrc('src/app/(admin)/admin/agents/page.tsx');
const statsPageSrc = readSrc('src/app/(admin)/admin/stats/page.tsx');
const layoutSrc = readSrc('src/app/(admin)/layout.tsx');
const agentRowSrc = readSrc('src/components/admin/AgentRow.tsx');

// ────────────────────────────────────────────────────────────────────────────
// File existence
// ────────────────────────────────────────────────────────────────────────────

describe('admin pages — file existence', () => {
  it('src/app/(admin)/admin/agents/page.tsx exists', () => {
    assert.ok(
      agentsPageSrc.length > 0,
      'src/app/(admin)/admin/agents/page.tsx does not exist — required for admin agent list'
    );
  });

  it('src/app/(admin)/admin/stats/page.tsx exists', () => {
    assert.ok(
      statsPageSrc.length > 0,
      'src/app/(admin)/admin/stats/page.tsx does not exist — required for admin stats'
    );
  });

  it('src/components/admin/AgentRow.tsx exists', () => {
    assert.ok(
      agentRowSrc.length > 0,
      'src/components/admin/AgentRow.tsx does not exist — required for suspend toggle'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// agents/page.tsx — force-dynamic + noindex
// ────────────────────────────────────────────────────────────────────────────

describe('agents page — force-dynamic + robots noindex', () => {
  it("agents/page.tsx exports dynamic = 'force-dynamic'", () => {
    assert.ok(
      agentsPageSrc.includes("dynamic = 'force-dynamic'") ||
        agentsPageSrc.includes('dynamic="force-dynamic"'),
      "agents/page.tsx must export dynamic = 'force-dynamic' (no runtime='edge' on pages)"
    );
  });

  it('agents/page.tsx does NOT set runtime edge (pages must be force-dynamic only)', () => {
    assert.ok(
      !agentsPageSrc.includes("runtime = 'edge'") && !agentsPageSrc.includes('runtime="edge"'),
      "agents/page.tsx must NOT set runtime='edge' — admin pages use force-dynamic, not edge runtime"
    );
  });

  it('agents/page.tsx has robots noindex metadata', () => {
    assert.ok(
      agentsPageSrc.includes('noindex') ||
        agentsPageSrc.includes('robots') ||
        agentsPageSrc.includes('index: false'),
      'agents/page.tsx must include robots noindex metadata (T-05-13: no search engine indexing)'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// agents/page.tsx — four-column table
// ────────────────────────────────────────────────────────────────────────────

describe('agents page — four-column agent table', () => {
  it('agents/page.tsx renders display_name column', () => {
    assert.ok(
      agentsPageSrc.includes('display_name') || agentsPageSrc.includes('Name'),
      'agents/page.tsx must render the display_name column (ADMIN-01)'
    );
  });

  it('agents/page.tsx renders email column', () => {
    assert.ok(
      agentsPageSrc.includes('email') || agentsPageSrc.includes('Email'),
      'agents/page.tsx must render the email column (ADMIN-01)'
    );
  });

  it('agents/page.tsx renders subscription_status column', () => {
    assert.ok(
      agentsPageSrc.includes('subscription_status') || agentsPageSrc.includes('Subscription'),
      'agents/page.tsx must render the subscription_status column (ADMIN-01)'
    );
  });

  it('agents/page.tsx renders account status (Active/Suspended)', () => {
    assert.ok(
      agentsPageSrc.includes('Suspended') || agentsPageSrc.includes('is_suspended'),
      'agents/page.tsx must render the account status (Active/Suspended) column (ADMIN-01)'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// agents/page.tsx — pagination
// ────────────────────────────────────────────────────────────────────────────

describe('agents page — pagination controls', () => {
  it('agents/page.tsx renders Prev/Previous pagination control', () => {
    assert.ok(
      agentsPageSrc.includes('Prev') || agentsPageSrc.includes('Previous'),
      'agents/page.tsx must render a Prev/Previous pagination control'
    );
  });

  it('agents/page.tsx renders Next pagination control', () => {
    assert.ok(
      agentsPageSrc.includes('Next'),
      'agents/page.tsx must render a Next pagination control'
    );
  });

  it('agents/page.tsx reads the ?page searchParam', () => {
    assert.ok(
      agentsPageSrc.includes('page') && agentsPageSrc.includes('searchParams'),
      'agents/page.tsx must read the ?page searchParam for pagination'
    );
  });

  it('agents/page.tsx references total for pagination math', () => {
    assert.ok(
      agentsPageSrc.includes('total'),
      'agents/page.tsx must reference total for Prev/Next pagination logic'
    );
  });

  it('agents/page.tsx clamps the page param to sane bounds (WR-03)', () => {
    assert.ok(
      agentsPageSrc.includes('Math.min') &&
        (agentsPageSrc.includes('MAX_PAGE') || agentsPageSrc.includes('totalPages')),
      'agents/page.tsx must clamp the ?page param (Math.min against MAX_PAGE / totalPages) so a huge value cannot produce an absurd OFFSET (WR-03)'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// agents/page.tsx — AgentRow component used
// ────────────────────────────────────────────────────────────────────────────

describe('agents page — AgentRow component', () => {
  it('agents/page.tsx imports or uses AgentRow', () => {
    assert.ok(
      agentsPageSrc.includes('AgentRow'),
      'agents/page.tsx must render AgentRow per agent row for the suspend toggle'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AgentRow.tsx — 'use client' + suspend PATCH
// ────────────────────────────────────────────────────────────────────────────

describe('AgentRow component — use client + suspend PATCH', () => {
  it("AgentRow.tsx has 'use client' directive", () => {
    assert.ok(
      agentRowSrc.includes("'use client'") || agentRowSrc.includes('"use client"'),
      "AgentRow.tsx must have 'use client' directive — it uses hooks and browser fetch"
    );
  });

  it('AgentRow.tsx PATCHes /api/admin/agents/[id] endpoint', () => {
    assert.ok(
      agentRowSrc.includes('/api/admin/agents/') && agentRowSrc.includes('PATCH'),
      'AgentRow.tsx must PATCH /api/admin/agents/[id] for the suspend toggle'
    );
  });

  it('AgentRow.tsx sends { suspended } in the PATCH body', () => {
    assert.ok(
      agentRowSrc.includes('suspended'),
      'AgentRow.tsx must send { suspended } in the PATCH request body'
    );
  });

  it('AgentRow.tsx calls router.refresh() after toggle', () => {
    assert.ok(
      agentRowSrc.includes('router.refresh') || agentRowSrc.includes('refresh()'),
      'AgentRow.tsx must call router.refresh() after a successful toggle to re-fetch server data'
    );
  });

  it('AgentRow.tsx reflects is_suspended state via a prop or parameter', () => {
    assert.ok(
      agentRowSrc.includes('is_suspended') || agentRowSrc.includes('isSuspended'),
      'AgentRow.tsx must reflect the current is_suspended value from the agent row'
    );
  });

  it('AgentRow.tsx shows a pending/disabled state during the request', () => {
    assert.ok(
      agentRowSrc.includes('pending') ||
        agentRowSrc.includes('disabled') ||
        agentRowSrc.includes('loading') ||
        agentRowSrc.includes('isPending') ||
        agentRowSrc.includes('isLoading'),
      'AgentRow.tsx must show a pending/disabled state while the PATCH is in flight'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// stats/page.tsx — force-dynamic + noindex + four counts
// ────────────────────────────────────────────────────────────────────────────

describe('stats page — force-dynamic + robots noindex', () => {
  it("stats/page.tsx exports dynamic = 'force-dynamic'", () => {
    assert.ok(
      statsPageSrc.includes("dynamic = 'force-dynamic'") ||
        statsPageSrc.includes('dynamic="force-dynamic"'),
      "stats/page.tsx must export dynamic = 'force-dynamic'"
    );
  });

  it('stats/page.tsx does NOT set runtime edge', () => {
    assert.ok(
      !statsPageSrc.includes("runtime = 'edge'") && !statsPageSrc.includes('runtime="edge"'),
      "stats/page.tsx must NOT set runtime='edge' — admin pages use force-dynamic only"
    );
  });

  it('stats/page.tsx has robots noindex metadata', () => {
    assert.ok(
      statsPageSrc.includes('noindex') ||
        statsPageSrc.includes('robots') ||
        statsPageSrc.includes('index: false'),
      'stats/page.tsx must include robots noindex metadata (T-05-13)'
    );
  });
});

describe('stats page — four stat counts rendered', () => {
  it('stats/page.tsx renders totalAgents or Total Agents', () => {
    assert.ok(
      statsPageSrc.includes('totalAgents') || statsPageSrc.includes('Total Agents'),
      'stats/page.tsx must render the totalAgents count (ADMIN-03)'
    );
  });

  it('stats/page.tsx renders activeSubscriptions or Active Subscriptions', () => {
    assert.ok(
      statsPageSrc.includes('activeSubscriptions') ||
        statsPageSrc.includes('Active Subscriptions'),
      'stats/page.tsx must render the activeSubscriptions count (ADMIN-03)'
    );
  });

  it('stats/page.tsx renders totalListings or Total Listings', () => {
    assert.ok(
      statsPageSrc.includes('totalListings') || statsPageSrc.includes('Total Listings'),
      'stats/page.tsx must render the totalListings count (ADMIN-03)'
    );
  });

  it('stats/page.tsx renders totalLeads or Total Leads', () => {
    assert.ok(
      statsPageSrc.includes('totalLeads') || statsPageSrc.includes('Total Leads'),
      'stats/page.tsx must render the totalLeads count (ADMIN-03)'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// layout.tsx — sidebar nav links
// ────────────────────────────────────────────────────────────────────────────

describe('admin layout — sidebar nav links', () => {
  it('layout.tsx links to /admin/agents', () => {
    assert.ok(
      layoutSrc.includes('/admin/agents'),
      'layout.tsx sidebar must include a link to /admin/agents (Agents page)'
    );
  });

  it('layout.tsx links to /admin/stats', () => {
    assert.ok(
      layoutSrc.includes('/admin/stats'),
      'layout.tsx sidebar must include a link to /admin/stats (Platform Stats page)'
    );
  });

  it('layout.tsx preserves red-800 sidebar theme', () => {
    assert.ok(
      layoutSrc.includes('red-800'),
      'layout.tsx must preserve the red-800 sidebar background from the Phase 2 admin shell'
    );
  });

  it('layout.tsx preserves ADMIN badge', () => {
    assert.ok(
      layoutSrc.includes('ADMIN'),
      'layout.tsx must preserve the ADMIN badge from the Phase 2 admin shell'
    );
  });

  it('layout.tsx has nav link text for Agents', () => {
    assert.ok(
      layoutSrc.includes('Agents'),
      'layout.tsx sidebar must have a visible "Agents" link label'
    );
  });

  it('layout.tsx has nav link text for Stats or Platform Stats', () => {
    assert.ok(
      layoutSrc.includes('Stats') || layoutSrc.includes('Platform'),
      'layout.tsx sidebar must have a visible "Stats" or "Platform Stats" link label'
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// layout.tsx — server-side requireAdmin gate (BL-01 defense in depth)
// ────────────────────────────────────────────────────────────────────────────

describe('admin layout — server-side requireAdmin gate (BL-01)', () => {
  it('layout.tsx calls requireAdmin() server-side (does not rely solely on middleware)', () => {
    assert.ok(
      layoutSrc.includes('requireAdmin'),
      'layout.tsx must call requireAdmin() as a server-side choke point for all admin pages (BL-01)'
    );
  });

  it('layout.tsx rejects non-admins via isAdminRejection + notFound', () => {
    assert.ok(
      layoutSrc.includes('isAdminRejection') && layoutSrc.includes('notFound'),
      'layout.tsx must reject non-admins (isAdminRejection → notFound) before rendering admin pages (BL-01)'
    );
  });

  it('layout.tsx is an async component (so it can await requireAdmin)', () => {
    assert.ok(
      layoutSrc.includes('export default async function'),
      'layout.tsx must be an async component to await the requireAdmin() session check (BL-01)'
    );
  });
});
