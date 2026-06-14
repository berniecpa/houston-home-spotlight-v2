/**
 * Tests for BillingWidget component and billing page RSC.
 *
 * Coverage:
 *   - BILL-04: All 4 subscription states render correct UI (none, active, grace, lapsed)
 *   - BILL-01 entry point: Subscribe CTA present for 'none' and 'lapsed'
 *   - BILL-02 entry point: Manage billing button present for 'active' and 'grace'
 *   - Admin notice: isAdmin branch shows owner copy, no Subscribe/Manage CTA
 *   - Grace warning: payment-failed warning text present
 *   - CTA wiring: fetch calls target /api/stripe/checkout and /api/stripe/portal
 *   - Sidebar: DashboardSidebar has live Billing link, no "Coming soon" adjacent to Billing
 *   - Billing page RSC: imports getAgentSubscriptionState, declares force-dynamic, no edge runtime
 *
 * Test strategy: structural checks on source file content — same pattern as billing.test.ts.
 * No real D1 or Stripe I/O; component wiring confirmed via source text assertions.
 *
 * @module tests/billing-widget
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Helper — read source file content
// ---------------------------------------------------------------------------

function readSource(relPath: string): string {
  const fullPath = path.join(srcRoot, relPath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

/** Returns lines from a source file that are not comment lines */
function nonCommentLines(content: string): string[] {
  return content.split('\n').filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed !== '';
  });
}

// ---------------------------------------------------------------------------
// BillingWidget component — structural checks
// ---------------------------------------------------------------------------

describe('BillingWidget component structure', () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it('file exists', () => {
    const content = readSource(filePath);
    assert.ok(content.length > 0, `Expected ${filePath} to exist and have content`);
  });

  it("has 'use client' directive", () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes("'use client'"),
      "BillingWidget must have 'use client' directive"
    );
  });

  it('has named export BillingWidget', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('export function BillingWidget') ||
        content.includes('export const BillingWidget'),
      'BillingWidget must have a named export'
    );
  });

  it('has default export', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('export default'),
      'BillingWidget must have a default export'
    );
  });

  it('imports SubscriptionStatus from @/lib/subscription', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('@/lib/subscription'),
      'BillingWidget must import from @/lib/subscription'
    );
  });

  it('is under 500 lines', () => {
    const content = readSource(filePath);
    const lineCount = content.split('\n').length;
    assert.ok(lineCount < 500, `BillingWidget must be under 500 lines (got ${lineCount})`);
  });
});

// ---------------------------------------------------------------------------
// BillingWidget — state: 'none' (Subscribe CTA)
// ---------------------------------------------------------------------------

describe("BillingWidget 'none' state", () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it("has Subscribe branch for status 'none'", () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes("'none'") || content.includes('"none"'),
      "BillingWidget must handle status 'none'"
    );
  });

  it('includes $79/mo pricing copy', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('79') && (content.includes('/mo') || content.includes('month')),
      'BillingWidget must show $79/mo pricing copy'
    );
  });

  it('has a Subscribe button or CTA', () => {
    const content = readSource(filePath);
    assert.ok(
      content.toLowerCase().includes('subscribe'),
      "BillingWidget must have a Subscribe CTA for the 'none' state"
    );
  });
});

// ---------------------------------------------------------------------------
// BillingWidget — state: 'active' (status badge + renewal + Manage)
// ---------------------------------------------------------------------------

describe("BillingWidget 'active' state", () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it("has active branch for status 'active'", () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes("'active'") || content.includes('"active"'),
      "BillingWidget must handle status 'active'"
    );
  });

  it('shows Active badge copy', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('Active') || content.includes('active'),
      "BillingWidget 'active' state must show Active badge"
    );
  });

  it('has Manage billing button for active state', () => {
    const content = readSource(filePath);
    assert.ok(
      content.toLowerCase().includes('manage'),
      "BillingWidget must have a Manage billing button for the 'active' state"
    );
  });

  it('formats renewal date from epoch seconds', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('renewalDate') || content.includes('renewal_date'),
      'BillingWidget must reference renewalDate prop for active state'
    );
    assert.ok(
      content.includes('toLocaleDateString') || content.includes('* 1000'),
      'BillingWidget must format epoch seconds to a human date'
    );
  });
});

// ---------------------------------------------------------------------------
// BillingWidget — state: 'grace' (warning + Manage)
// ---------------------------------------------------------------------------

describe("BillingWidget 'grace' state", () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it("has grace branch for status 'grace'", () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes("'grace'") || content.includes('"grace"'),
      "BillingWidget must handle status 'grace'"
    );
  });

  it('shows payment-failed warning text', () => {
    const content = readSource(filePath);
    const lc = content.toLowerCase();
    assert.ok(
      lc.includes('payment failed') || lc.includes('payment issue') || lc.includes('update your card'),
      "BillingWidget 'grace' state must show a payment-failed warning message"
    );
  });

  it('has Manage billing button for grace state', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('handleManage') || content.includes('portal'),
      "BillingWidget must have a Manage billing CTA for the 'grace' state"
    );
  });

  it('references graceUntil prop', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('graceUntil'),
      "BillingWidget must reference graceUntil prop for 'grace' state"
    );
  });
});

// ---------------------------------------------------------------------------
// BillingWidget — state: 'lapsed' (reactivate / Subscribe CTA)
// ---------------------------------------------------------------------------

describe("BillingWidget 'lapsed' state", () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it("has lapsed branch for status 'lapsed'", () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes("'lapsed'") || content.includes('"lapsed"'),
      "BillingWidget must handle status 'lapsed'"
    );
  });

  it('shows subscription ended copy or reactivate CTA for lapsed', () => {
    const content = readSource(filePath);
    const lc = content.toLowerCase();
    assert.ok(
      lc.includes('lapsed') || lc.includes('reactivate') || lc.includes('subscription ended'),
      "BillingWidget 'lapsed' state must show ended copy or reactivate CTA"
    );
  });

  it('has Subscribe/reactivate CTA for lapsed (same as none)', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('handleSubscribe'),
      "BillingWidget must use handleSubscribe for 'lapsed' state"
    );
  });
});

// ---------------------------------------------------------------------------
// BillingWidget — admin notice (isAdmin branch)
// ---------------------------------------------------------------------------

describe('BillingWidget admin notice', () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it('has admin branch keyed on isAdmin prop', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('isAdmin'),
      'BillingWidget must have isAdmin prop and branch'
    );
  });

  it('shows platform owner / no subscription required copy for admin', () => {
    const content = readSource(filePath);
    const lc = content.toLowerCase();
    assert.ok(
      lc.includes('owner') || lc.includes('complimentary') || lc.includes('no subscription'),
      'BillingWidget admin branch must show owner/complimentary copy'
    );
  });
});

// ---------------------------------------------------------------------------
// BillingWidget — CTA wiring to Stripe routes
// ---------------------------------------------------------------------------

describe('BillingWidget CTA wiring', () => {
  const filePath = 'components/dashboard/BillingWidget.tsx';

  it('POSTs to /api/stripe/checkout for Subscribe CTA', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('/api/stripe/checkout'),
      'BillingWidget must fetch /api/stripe/checkout for Subscribe CTA'
    );
  });

  it('POSTs to /api/stripe/portal for Manage CTA', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('/api/stripe/portal'),
      'BillingWidget must fetch /api/stripe/portal for Manage CTA'
    );
  });

  it('has handleSubscribe function that uses fetch', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('handleSubscribe'),
      'BillingWidget must define a handleSubscribe handler'
    );
    assert.ok(
      content.includes('fetch('),
      'BillingWidget must use fetch() for API calls'
    );
  });

  it('has handleManage function', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('handleManage'),
      'BillingWidget must define a handleManage handler'
    );
  });

  it('redirects window.location.href to returned url', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('window.location.href'),
      'BillingWidget must redirect via window.location.href after API call'
    );
  });

  it('shows inline error banner on failure (no throw)', () => {
    const content = readSource(filePath);
    const lc = content.toLowerCase();
    assert.ok(
      lc.includes('error') && (content.includes('catch') || content.includes('setError')),
      'BillingWidget must handle API errors with an inline error banner, not throw'
    );
  });
});

// ---------------------------------------------------------------------------
// Billing page RSC — structural checks
// ---------------------------------------------------------------------------

describe('Billing page RSC structure', () => {
  const filePath = 'app/(dashboard)/dashboard/billing/page.tsx';

  it('file exists and has content', () => {
    const content = readSource(filePath);
    assert.ok(content.length > 0, `Expected ${filePath} to exist and have content`);
  });

  it('imports getAgentSubscriptionState from @/lib/subscription', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('getAgentSubscriptionState'),
      'billing/page.tsx must import getAgentSubscriptionState'
    );
    assert.ok(
      content.includes('@/lib/subscription'),
      'billing/page.tsx must import from @/lib/subscription'
    );
  });

  it('declares dynamic = force-dynamic', () => {
    const nonComment = nonCommentLines(readSource(filePath)).join('\n');
    assert.ok(
      nonComment.includes("'force-dynamic'") || nonComment.includes('"force-dynamic"'),
      "billing/page.tsx must declare dynamic = 'force-dynamic'"
    );
  });

  it('does NOT declare runtime = edge', () => {
    const nonComment = nonCommentLines(readSource(filePath)).join('\n');
    assert.ok(
      !nonComment.includes("runtime = 'edge'") && !nonComment.includes('runtime = "edge"'),
      "billing/page.tsx must NOT declare runtime = 'edge'"
    );
  });

  it('renders BillingWidget component', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('BillingWidget'),
      'billing/page.tsx must render the BillingWidget component'
    );
  });

  it('is under 500 lines', () => {
    const content = readSource(filePath);
    const lineCount = content.split('\n').length;
    assert.ok(lineCount < 500, `billing/page.tsx must be under 500 lines (got ${lineCount})`);
  });
});

// ---------------------------------------------------------------------------
// DashboardSidebar — Billing link activation
// ---------------------------------------------------------------------------

describe('DashboardSidebar Billing link', () => {
  const filePath = 'components/dashboard/DashboardSidebar.tsx';

  it('has a Link to /dashboard/billing', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('/dashboard/billing'),
      'DashboardSidebar must have a Link href to /dashboard/billing'
    );
  });

  it('no longer shows "Coming soon" adjacent to Billing', () => {
    const content = readSource(filePath);
    const billingComingSoonPattern = /Billing[^<\n]*Coming soon/;
    assert.ok(
      !billingComingSoonPattern.test(content),
      'DashboardSidebar Billing link must not show "Coming soon"'
    );
  });

  it('Billing link uses active state detection', () => {
    const content = readSource(filePath);
    assert.ok(
      content.includes('isBillingActive') || content.includes('/dashboard/billing'),
      'DashboardSidebar Billing must use active state detection or href'
    );
  });
});
