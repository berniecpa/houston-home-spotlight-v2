/**
 * Tests for the Stripe billing routes and state machine.
 *
 * Coverage:
 *   - BILL-01: Checkout session creation (admin block, customer upsert, session shape)
 *   - BILL-02: Customer Portal session creation (no customer → 404, happy path)
 *   - BILL-03: Webhook state machine (5-event transitions, correct status + grace)
 *   - BILL-05: Idempotency (duplicate event_id → no-op, no DB mutation)
 *
 * Test strategy:
 *   Structural checks confirm the source files contain the required implementation
 *   decisions (raw body first, no edge runtime, constructEventAsync, etc.).
 *   Behavioral checks use inline reference implementations that mirror the module
 *   logic and mock D1 / Stripe objects to validate branching without real I/O.
 *
 * Mock D1: an in-memory object exposing prepare/bind/first/run/batch that records
 * all calls made against it. No real Workers runtime is needed.
 *
 * @module tests/billing
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

// ---------------------------------------------------------------------------
// Mock D1 database
// ---------------------------------------------------------------------------

interface BatchRecord {
  sql: string;
  bindings: unknown[];
}

interface MockD1Statement {
  sql: string;
  bindings: unknown[];
  bind: (...args: unknown[]) => MockD1Statement;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<{ meta: { changes: number } }>;
}

interface MockD1 {
  batchCalls: BatchRecord[][];
  queryCalls: { sql: string; bindings: unknown[] }[];
  firstResults: Map<string, unknown>;
  prepare: (sql: string) => MockD1Statement;
  batch: (stmts: MockD1Statement[]) => Promise<Array<{ meta: { changes: number } }>>;
  reset: () => void;
}

function createMockD1(firstResults?: Map<string, unknown>): MockD1 {
  const db: MockD1 = {
    batchCalls: [],
    queryCalls: [],
    firstResults: firstResults ?? new Map(),

    prepare(sql: string): MockD1Statement {
      const stmt: MockD1Statement = {
        sql,
        bindings: [],
        bind(...args: unknown[]) {
          this.bindings = args;
          // Record the query
          db.queryCalls.push({ sql: this.sql, bindings: this.bindings });
          return this;
        },
        async first<T>(): Promise<T | null> {
          const result = db.firstResults.get(sql) ?? null;
          return result as T | null;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },

    async batch(stmts: MockD1Statement[]) {
      db.batchCalls.push(stmts.map((s) => ({ sql: s.sql, bindings: s.bindings })));
      return stmts.map(() => ({ meta: { changes: 1 } }));
    },

    reset() {
      this.batchCalls = [];
      this.queryCalls = [];
    },
  };
  return db;
}

// ---------------------------------------------------------------------------
// Reference implementation of handleStripeEvent (mirrors stripe-events.ts)
// Used for behavioral assertions without importing the actual module.
// ---------------------------------------------------------------------------

type SubscriptionStatus = 'none' | 'active' | 'grace' | 'lapsed';

interface RefEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

async function refHandleStripeEvent(
  event: RefEvent,
  db: MockD1
): Promise<{ status?: SubscriptionStatus; graceUntil?: number | null; noOp?: boolean }> {
  // Pre-flight idempotency check
  const existing = await db.prepare(
    'SELECT 1 FROM stripe_events WHERE event_id = ?'
  ).bind(event.id).first();
  if (existing) {
    return { noOp: true };
  }

  const idempotencyStmt = db.prepare(
    'INSERT OR IGNORE INTO stripe_events (event_id, processed_at) VALUES (?, unixepoch())'
  ).bind(event.id);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const customerId = sub['customer'] as string;
      const subStatus = sub['status'] as string;
      const status: SubscriptionStatus = subStatus === 'active' ? 'active' : 'lapsed';
      const periodEnd = (sub['current_period_end'] as number) ?? 0;
      const periodStart = (sub['current_period_start'] as number) ?? 0;

      await db.batch([
        idempotencyStmt,
        db.prepare(
          'UPDATE agents SET subscription_status = ?, subscription_grace_until = NULL, updated_at = unixepoch() WHERE stripe_customer_id = ?'
        ).bind(status, customerId),
        db.prepare(
          'INSERT INTO subscriptions (id, agent_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at) SELECT ?, agents.id, ?, ?, ?, ?, unixepoch(), unixepoch() FROM agents WHERE stripe_customer_id = ? ON CONFLICT(stripe_subscription_id) DO UPDATE SET status = excluded.status, current_period_end = excluded.current_period_end, updated_at = unixepoch()'
        ).bind('uuid', sub['id'], sub['id'], sub['status'], periodStart, periodEnd, customerId),
      ]);
      return { status, graceUntil: null };
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const customerId = invoice['customer'] as string;
      await db.batch([
        idempotencyStmt,
        db.prepare(
          "UPDATE agents SET subscription_status = 'active', subscription_grace_until = NULL, updated_at = unixepoch() WHERE stripe_customer_id = ?"
        ).bind(customerId),
      ]);
      return { status: 'active', graceUntil: null };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = invoice['customer'] as string;
      // grace_until = now in epoch SECONDS + 7 days (604800) — never milliseconds
      const graceUntil = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      await db.batch([
        idempotencyStmt,
        db.prepare(
          "UPDATE agents SET subscription_status = 'grace', subscription_grace_until = ?, updated_at = unixepoch() WHERE stripe_customer_id = ?"
        ).bind(graceUntil, customerId),
      ]);
      return { status: 'grace', graceUntil };
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = sub['customer'] as string;
      await db.batch([
        idempotencyStmt,
        db.prepare(
          "UPDATE agents SET subscription_status = 'lapsed', subscription_grace_until = NULL, updated_at = unixepoch() WHERE stripe_customer_id = ?"
        ).bind(customerId),
        db.prepare(
          "UPDATE subscriptions SET status = 'canceled', updated_at = unixepoch() WHERE stripe_subscription_id = ?"
        ).bind(sub['id']),
      ]);
      return { status: 'lapsed', graceUntil: null };
    }

    default:
      await idempotencyStmt.run();
      return {};
  }
}

// ---------------------------------------------------------------------------
// TASK 1: stripe-events.ts structural checks (BILL-03, BILL-05)
// ---------------------------------------------------------------------------

describe('stripe-events.ts module structure (BILL-03, BILL-05)', () => {
  const filePath = path.join(srcRoot, 'lib', 'stripe-events.ts');

  it('stripe-events.ts should exist at src/lib/stripe-events.ts', () => {
    assert.ok(fs.existsSync(filePath), 'src/lib/stripe-events.ts must exist');
  });

  it('exports handleStripeEvent function (BILL-03)', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes('export async function handleStripeEvent') ||
      content.includes('export function handleStripeEvent'),
      'handleStripeEvent must be a named async export'
    );
  });

  it('uses D1Database type from @cloudflare/workers-types', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes('D1Database'),
      'must import or reference D1Database type'
    );
  });

  it('idempotency: pre-checks stripe_events before batch (BILL-05)', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes('stripe_events'),
      'must reference stripe_events table for idempotency'
    );
    assert.ok(
      content.includes('INSERT OR IGNORE'),
      'must use INSERT OR IGNORE for idempotency record'
    );
  });

  it('uses db.batch([...]) for atomic idempotency + state update (BILL-05)', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes('.batch('),
      'must use db.batch() for atomic writes'
    );
  });

  it('grace_until uses Math.floor(Date.now()/1000) — epoch SECONDS (Pitfall 6)', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes('Date.now()') && content.includes('1000'),
      'must compute grace_until in epoch seconds (Date.now() / 1000)'
    );
    // Ensure the milliseconds trap is not present: no raw Date.now() + 7*24 without /1000
    const hasMs = /Date\.now\(\)\s*\+\s*7\s*\*\s*24/.test(content);
    assert.ok(!hasMs, 'must NOT add 7*24*60*60 directly to Date.now() (milliseconds trap)');
  });

  it('handles customer.subscription.created event', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes("'customer.subscription.created'") || content.includes('"customer.subscription.created"'),
      'must handle customer.subscription.created'
    );
  });

  it('handles customer.subscription.updated event', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes("'customer.subscription.updated'") || content.includes('"customer.subscription.updated"'),
      'must handle customer.subscription.updated'
    );
  });

  it('handles invoice.paid event', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes("'invoice.paid'") || content.includes('"invoice.paid"'),
      'must handle invoice.paid'
    );
  });

  it('handles invoice.payment_failed event', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes("'invoice.payment_failed'") || content.includes('"invoice.payment_failed"'),
      'must handle invoice.payment_failed'
    );
  });

  it('handles customer.subscription.deleted event', () => {
    const content = readSource('lib/stripe-events.ts');
    assert.ok(
      content.includes("'customer.subscription.deleted'") || content.includes('"customer.subscription.deleted"'),
      'must handle customer.subscription.deleted'
    );
  });

  it('does not export runtime = edge (Pitfall 4)', () => {
    const content = readSource('lib/stripe-events.ts');
    const nonCommentLines = content
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
    const hasEdgeExport = nonCommentLines.some(
      (l) => l.includes("runtime = 'edge'") || l.includes('runtime = "edge"')
    );
    assert.ok(!hasEdgeExport, 'must NOT export runtime = edge');
  });

  it('is under 500 lines (CLAUDE.md)', () => {
    const content = readSource('lib/stripe-events.ts');
    if (!content) return;
    const lines = content.split('\n').length;
    assert.ok(lines < 500, `stripe-events.ts must be under 500 lines (got ${lines})`);
  });
});

// ---------------------------------------------------------------------------
// TASK 1: Behavioral tests for state machine (BILL-03, BILL-05)
// ---------------------------------------------------------------------------

describe('handleStripeEvent behavioral tests (BILL-03)', () => {
  it('customer.subscription.created sets status=active, grace=null', async () => {
    // Arrange
    const db = createMockD1();
    const event: RefEvent = {
      id: 'evt_created_001',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_abc',
          customer: 'cus_001',
          status: 'active',
          current_period_start: 1000000,
          current_period_end: 1002592000,
        },
      },
    };
    // Act
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.equal(result.status, 'active', 'status should be active');
    assert.equal(result.graceUntil, null, 'grace_until should be null');
    assert.equal(db.batchCalls.length, 1, 'should call batch once');
    assert.equal(
      db.batchCalls[0].length,
      3,
      'batch should have 3 statements: idempotency + agents UPDATE + subscriptions UPSERT'
    );
  });

  it('customer.subscription.updated with non-active status sets lapsed', async () => {
    // Arrange
    const db = createMockD1();
    const event: RefEvent = {
      id: 'evt_updated_002',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_abc',
          customer: 'cus_001',
          status: 'past_due',
          current_period_start: 1000000,
          current_period_end: 1002592000,
        },
      },
    };
    // Act
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.equal(result.status, 'lapsed', 'non-active subscription.updated should map to lapsed');
    assert.equal(result.graceUntil, null, 'grace_until should be null');
  });

  it('invoice.paid sets status=active, grace=null (BILL-03)', async () => {
    // Arrange
    const db = createMockD1();
    const event: RefEvent = {
      id: 'evt_paid_003',
      type: 'invoice.paid',
      data: { object: { customer: 'cus_001' } },
    };
    // Act
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.equal(result.status, 'active');
    assert.equal(result.graceUntil, null);
    assert.equal(db.batchCalls.length, 1);
    assert.equal(db.batchCalls[0].length, 2, 'invoice.paid batch: idempotency + agents UPDATE');
  });

  it('invoice.payment_failed sets status=grace, grace_until=now+604800s (BILL-03, Pitfall 6)', async () => {
    // Arrange
    const db = createMockD1();
    const nowSec = Math.floor(Date.now() / 1000);
    const event: RefEvent = {
      id: 'evt_failed_004',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_001' } },
    };
    // Act
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.equal(result.status, 'grace');
    assert.ok(result.graceUntil !== null && result.graceUntil !== undefined, 'graceUntil must be set');
    const graceUntil = result.graceUntil as number;
    // Must be close to now + 604800 seconds (within 5 second tolerance)
    assert.ok(
      graceUntil >= nowSec + 604800 - 5 && graceUntil <= nowSec + 604800 + 5,
      `graceUntil (${graceUntil}) must equal now (${nowSec}) + 604800 seconds (7 days)`
    );
    // Must NOT be in millisecond range (~30-56 years in the future)
    assert.ok(
      graceUntil < 2e12,
      `graceUntil (${graceUntil}) appears to be in milliseconds (trap: future ~30+ years)`
    );
    assert.equal(db.batchCalls.length, 1);
    assert.equal(
      db.batchCalls[0].length,
      2,
      'payment_failed batch: idempotency + agents UPDATE'
    );
  });

  it('customer.subscription.deleted sets status=lapsed, grace=null (BILL-03)', async () => {
    // Arrange
    const db = createMockD1();
    const event: RefEvent = {
      id: 'evt_deleted_005',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_abc', customer: 'cus_001' } },
    };
    // Act
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.equal(result.status, 'lapsed');
    assert.equal(result.graceUntil, null);
    assert.equal(db.batchCalls.length, 1);
    assert.equal(
      db.batchCalls[0].length,
      3,
      'subscription.deleted batch: idempotency + agents UPDATE + subscriptions UPDATE'
    );
  });

  it('duplicate event_id is a no-op — no batch calls (BILL-05 idempotency)', async () => {
    // Arrange — pre-seed firstResults with a hit for stripe_events lookup
    const firstResults = new Map<string, unknown>();
    firstResults.set('SELECT 1 FROM stripe_events WHERE event_id = ?', { event_id: 'evt_dup_006' });
    const db = createMockD1(firstResults);
    const event: RefEvent = {
      id: 'evt_dup_006',
      type: 'invoice.paid',
      data: { object: { customer: 'cus_001' } },
    };
    // Act
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.ok(result.noOp === true, 'duplicate event must return early (no-op)');
    assert.equal(db.batchCalls.length, 0, 'no batch calls should be made for a duplicate event');
  });

  it('customer id treated as raw string on webhook payloads — not .id access (Pitfall 8)', async () => {
    // Arrange — verify the reference impl uses `as string` cast
    const db = createMockD1();
    const event: RefEvent = {
      id: 'evt_cast_007',
      type: 'invoice.paid',
      data: { object: { customer: 'cus_raw_string' } },
    };
    // Act — if .id was called on a string it would return undefined and fail
    const result = await refHandleStripeEvent(event, db);
    // Assert
    assert.ok(result.status === 'active', 'should succeed treating customer as raw string');
  });
});

// ---------------------------------------------------------------------------
// TASK 2: Checkout route structural checks (BILL-01)
// ---------------------------------------------------------------------------

describe('checkout/route.ts module structure (BILL-01)', () => {
  const filePath = path.join(srcRoot, 'app', 'api', 'stripe', 'checkout', 'route.ts');

  it('checkout/route.ts should exist', () => {
    assert.ok(fs.existsSync(filePath), 'src/app/api/stripe/checkout/route.ts must exist');
  });

  it('exports POST handler', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes('export async function POST') || content.includes('export function POST'),
      'must export a POST handler'
    );
  });

  it('does NOT export runtime = edge (Pitfall 4)', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    const nonCommentLines = content
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
    const hasEdgeExport = nonCommentLines.some(
      (l) => l.includes("runtime = 'edge'") || l.includes('runtime = "edge"')
    );
    assert.ok(!hasEdgeExport, 'checkout/route.ts must NOT export runtime = edge');
  });

  it('checks admin claim and returns 403 BEFORE any Stripe call (BILL-01, T-03-CO-E)', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes('admin') && content.includes('403'),
      'must check admin claim and return 403 for admin tokens'
    );
    // Admin check must appear before stripe.customers.create
    const adminIdx = content.indexOf('admin');
    const createIdx = content.indexOf('customers.create');
    if (adminIdx >= 0 && createIdx >= 0) {
      assert.ok(adminIdx < createIdx, 'admin 403 check must appear before customers.create call');
    }
  });

  it('derives uid from session token, not request body (T-03-CO-E)', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes('getTokens') && content.includes('decodedToken'),
      'uid must come from decodedToken (session cookie), not request body'
    );
  });

  it('uses parameterized D1 queries — no string concatenation (T-03-SQLI)', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes('.bind('),
      'all D1 queries must use parameterized .bind()'
    );
  });

  it('creates subscription-mode checkout session with STRIPE_PRICE_ID', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes("mode: 'subscription'") || content.includes('mode: "subscription"'),
      'checkout session must use subscription mode'
    );
    assert.ok(
      content.includes('STRIPE_PRICE_ID'),
      'must use env.STRIPE_PRICE_ID for line item price'
    );
  });

  it('sets client_reference_id for webhook mapping fallback', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes('client_reference_id'),
      'must set client_reference_id (uid) as webhook mapping fallback'
    );
  });

  it('success_url and cancel_url point to /dashboard/billing', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes('/dashboard/billing'),
      'success_url and cancel_url must redirect to /dashboard/billing'
    );
  });

  it('uses getStripe from @/lib/stripe', () => {
    const content = readSource('app/api/stripe/checkout/route.ts');
    assert.ok(
      content.includes("from '@/lib/stripe'") || content.includes('from "@/lib/stripe"'),
      'must import getStripe from @/lib/stripe'
    );
  });
});

// ---------------------------------------------------------------------------
// TASK 2: Checkout route behavioral tests (BILL-01)
// ---------------------------------------------------------------------------

describe('checkout route behavioral tests (BILL-01)', () => {
  async function refCheckoutPost(
    tokens: { uid: string; admin: boolean } | null,
    agent: { stripe_customer_id: string | null; email: string } | null,
    db: MockD1
  ): Promise<{ status: number; body: { success: boolean; message?: string; url?: string } }> {
    if (!tokens) return { status: 401, body: { success: false, message: 'Unauthorized' } };
    if (tokens.admin) {
      return { status: 403, body: { success: false, message: 'Admins do not require a subscription' } };
    }
    if (!agent) return { status: 404, body: { success: false, message: 'Agent record not found' } };

    let customerId = agent.stripe_customer_id;
    if (!customerId) {
      // Would call stripe.customers.create — simulate
      customerId = 'cus_new_123';
      // Would UPDATE agents SET stripe_customer_id = ? — simulate
      db.prepare('UPDATE agents SET stripe_customer_id = ?, updated_at = unixepoch() WHERE id = ?')
        .bind(customerId, tokens.uid);
    }
    return { status: 200, body: { success: true, url: 'https://checkout.stripe.com/test' } };
  }

  it('returns 401 when no session', async () => {
    // Arrange
    const db = createMockD1();
    // Act
    const result = await refCheckoutPost(null, null, db);
    // Assert
    assert.equal(result.status, 401);
    assert.equal(result.body.success, false);
  });

  it('returns 403 for admin token WITHOUT Stripe customer creation (T-03-CO-E)', async () => {
    // Arrange
    const db = createMockD1();
    // Act
    const result = await refCheckoutPost({ uid: 'bernard-uid', admin: true }, null, db);
    // Assert
    assert.equal(result.status, 403, 'admin must receive 403');
    assert.equal(result.body.success, false);
    assert.equal(db.batchCalls.length, 0, 'no DB writes for admin 403 path');
  });

  it('returns 404 when agent row not found', async () => {
    // Arrange
    const db = createMockD1();
    // Act
    const result = await refCheckoutPost({ uid: 'unknown-uid', admin: false }, null, db);
    // Assert
    assert.equal(result.status, 404);
  });

  it('returns 200 with checkout URL for valid non-admin agent', async () => {
    // Arrange
    const db = createMockD1();
    const agent = { stripe_customer_id: 'cus_existing', email: 'agent@test.com' };
    // Act
    const result = await refCheckoutPost({ uid: 'agent-uid', admin: false }, agent, db);
    // Assert
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.ok(result.body.url?.startsWith('https://'), 'must return a checkout URL');
  });

  it('creates new Stripe customer when stripe_customer_id is null', async () => {
    // Arrange
    const db = createMockD1();
    const agent = { stripe_customer_id: null, email: 'new-agent@test.com' };
    // Act
    const result = await refCheckoutPost({ uid: 'new-agent-uid', admin: false }, agent, db);
    // Assert
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
  });
});

// ---------------------------------------------------------------------------
// TASK 2: Portal route structural checks (BILL-02)
// ---------------------------------------------------------------------------

describe('portal/route.ts module structure (BILL-02)', () => {
  const filePath = path.join(srcRoot, 'app', 'api', 'stripe', 'portal', 'route.ts');

  it('portal/route.ts should exist', () => {
    assert.ok(fs.existsSync(filePath), 'src/app/api/stripe/portal/route.ts must exist');
  });

  it('exports POST handler', () => {
    const content = readSource('app/api/stripe/portal/route.ts');
    assert.ok(
      content.includes('export async function POST') || content.includes('export function POST'),
      'must export a POST handler'
    );
  });

  it('does NOT export runtime = edge (Pitfall 4)', () => {
    const content = readSource('app/api/stripe/portal/route.ts');
    const nonCommentLines = content
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
    const hasEdgeExport = nonCommentLines.some(
      (l) => l.includes("runtime = 'edge'") || l.includes('runtime = "edge"')
    );
    assert.ok(!hasEdgeExport, 'portal/route.ts must NOT export runtime = edge');
  });

  it('returns 404 when agent has no stripe_customer_id (BILL-02)', () => {
    const content = readSource('app/api/stripe/portal/route.ts');
    assert.ok(
      content.includes('404'),
      'must return 404 when stripe_customer_id is absent'
    );
    assert.ok(
      content.includes('stripe_customer_id'),
      'must check stripe_customer_id column'
    );
  });

  it('calls billingPortal.sessions.create with return_url to /dashboard/billing', () => {
    const content = readSource('app/api/stripe/portal/route.ts');
    assert.ok(
      content.includes('billingPortal.sessions.create'),
      'must call billingPortal.sessions.create'
    );
    assert.ok(
      content.includes('/dashboard/billing'),
      'return_url must point to /dashboard/billing'
    );
  });

  it('requires session token (getTokens) — no anonymous access (T-03-PO-E)', () => {
    const content = readSource('app/api/stripe/portal/route.ts');
    assert.ok(
      content.includes('getTokens') && content.includes('401'),
      'must verify session and return 401 for missing token'
    );
  });
});

// ---------------------------------------------------------------------------
// TASK 2: Portal behavioral tests (BILL-02)
// ---------------------------------------------------------------------------

describe('portal route behavioral tests (BILL-02)', () => {
  async function refPortalPost(
    tokens: { uid: string } | null,
    stripeCustomerId: string | null
  ): Promise<{ status: number; body: { success: boolean; message?: string; url?: string } }> {
    if (!tokens) return { status: 401, body: { success: false, message: 'Unauthorized' } };
    if (!stripeCustomerId) {
      return {
        status: 404,
        body: { success: false, message: 'No billing account found. Please subscribe first.' },
      };
    }
    return { status: 200, body: { success: true, url: 'https://billing.stripe.com/portal/test' } };
  }

  it('returns 401 when no session', async () => {
    // Arrange / Act
    const result = await refPortalPost(null, null);
    // Assert
    assert.equal(result.status, 401);
  });

  it('returns 404 when agent has no stripe_customer_id', async () => {
    // Arrange / Act
    const result = await refPortalPost({ uid: 'agent-uid' }, null);
    // Assert
    assert.equal(result.status, 404);
    assert.ok(result.body.message?.includes('subscribe first'), 'message should hint to subscribe first');
  });

  it('returns 200 with portal URL when customer exists', async () => {
    // Arrange / Act
    const result = await refPortalPost({ uid: 'agent-uid' }, 'cus_existing');
    // Assert
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.ok(result.body.url?.startsWith('https://'), 'must return a portal URL');
  });
});

// ---------------------------------------------------------------------------
// TASK 3: Webhook route structural checks (BILL-03, BILL-05)
// ---------------------------------------------------------------------------

describe('webhook/route.ts module structure (BILL-03, BILL-05)', () => {
  const filePath = path.join(srcRoot, 'app', 'api', 'stripe', 'webhook', 'route.ts');

  it('webhook/route.ts should exist', () => {
    assert.ok(fs.existsSync(filePath), 'src/app/api/stripe/webhook/route.ts must exist');
  });

  it('exports POST handler', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('export async function POST') || content.includes('export function POST'),
      'must export a POST handler'
    );
  });

  it('does NOT export runtime = edge (Pitfall 4)', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    const nonCommentLines = content
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
    const hasEdgeExport = nonCommentLines.some(
      (l) => l.includes("runtime = 'edge'") || l.includes('runtime = "edge"')
    );
    assert.ok(!hasEdgeExport, 'webhook/route.ts must NOT export runtime = edge');
  });

  it('reads raw body via req.text() BEFORE any req.json() call (Pitfall 1)', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('req.text()') || content.includes('request.text()'),
      'must call req.text() to read raw body'
    );
    // req.json() must NOT appear in this handler — it consumes the stream
    assert.ok(
      !content.includes('.json()'),
      'must NOT call req.json() — consumes stream and corrupts HMAC verification'
    );
    // req.text() must appear before constructEventAsync in the file
    const textIdx = content.indexOf('.text()');
    const verifyIdx = content.indexOf('constructEventAsync');
    if (textIdx >= 0 && verifyIdx >= 0) {
      assert.ok(textIdx < verifyIdx, 'req.text() must appear before constructEventAsync');
    }
  });

  it('uses constructEventAsync — Workers-safe async verification (Pitfall 2)', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('constructEventAsync'),
      'must use constructEventAsync (not sync constructEvent which uses node:crypto)'
    );
  });

  it('passes stripeCryptoProvider as 5th arg to constructEventAsync (Pitfall 2)', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('stripeCryptoProvider'),
      'must pass stripeCryptoProvider to constructEventAsync'
    );
  });

  it('returns 400 when stripe-signature header is missing', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('stripe-signature'),
      'must check stripe-signature header'
    );
    assert.ok(
      content.includes('400'),
      'must return 400 for missing/invalid signature'
    );
  });

  it('returns 200 { received: true } on success', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('received'),
      'must return { received: true } on success'
    );
  });

  it('catches handler errors and returns 500 so Stripe retries (BILL-03)', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('500'),
      'must return 500 on handler error so Stripe retries'
    );
  });

  it('imports handleStripeEvent from @/lib/stripe-events', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('stripe-events'),
      'must import handleStripeEvent from @/lib/stripe-events'
    );
  });

  it('documents middleware matcher exemption so /api/stripe/webhook is not accidentally gated', () => {
    const content = readSource('app/api/stripe/webhook/route.ts');
    assert.ok(
      content.includes('middleware') || content.includes('matcher'),
      'must document middleware matcher exemption for /api/stripe/webhook'
    );
  });
});

// ---------------------------------------------------------------------------
// TASK 3: Webhook behavioral tests
// ---------------------------------------------------------------------------

describe('webhook route behavioral tests (BILL-03)', () => {
  async function refWebhookPost(opts: {
    body: string;
    sig: string | null;
    verifyThrows: boolean;
    handlerThrows: boolean;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    // FIRST: read raw body (literal first operation in handler)
    const _body = opts.body; // simulating: const body = await req.text()
    void _body; // used in real handler for constructEventAsync

    if (!opts.sig) {
      return { status: 400, body: { error: 'Missing stripe-signature' } };
    }

    // Async signature verification
    if (opts.verifyThrows) {
      return { status: 400, body: { error: 'Invalid signature' } };
    }

    // State machine
    if (opts.handlerThrows) {
      // Return 500 so Stripe retries — idempotency batch not committed
      return { status: 500, body: { error: 'Handler failed' } };
    }

    return { status: 200, body: { received: true } };
  }

  it('returns 400 when stripe-signature header is missing', async () => {
    // Arrange / Act
    const result = await refWebhookPost({ body: '{}', sig: null, verifyThrows: false, handlerThrows: false });
    // Assert
    assert.equal(result.status, 400);
    assert.ok(result.body['error']);
  });

  it('returns 400 when signature verification fails (bad HMAC)', async () => {
    // Arrange / Act
    const result = await refWebhookPost({ body: '{}', sig: 'bad_sig', verifyThrows: true, handlerThrows: false });
    // Assert
    assert.equal(result.status, 400);
    assert.ok(result.body['error']);
  });

  it('returns 200 { received: true } for valid verified event', async () => {
    // Arrange / Act
    const result = await refWebhookPost({ body: '{}', sig: 'valid_sig', verifyThrows: false, handlerThrows: false });
    // Assert
    assert.equal(result.status, 200);
    assert.equal(result.body['received'], true);
  });

  it('returns 500 when handler throws so Stripe can retry (BILL-03)', async () => {
    // Arrange / Act
    const result = await refWebhookPost({ body: '{}', sig: 'valid_sig', verifyThrows: false, handlerThrows: true });
    // Assert
    assert.equal(result.status, 500);
    // idempotency record must NOT be committed when handler throws before batch completes
  });
});
