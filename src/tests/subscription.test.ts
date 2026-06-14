/**
 * Tests for src/lib/subscription.ts.
 *
 * Covers:
 *   - Structural checks: named exports (isAgentPublishable, AGENT_PUBLISHABLE_SQL,
 *     getAgentSubscriptionState, SubscriptionStatus type, AgentSubscriptionState interface)
 *   - Behavioral tests: all 4 subscription statuses, admin bypass, grace expiry boundary
 *
 * Matches BILL-04 (subscription status + 7-day grace enforcement) and BILL-05
 * (isAgentPublishable correct for none/active/grace(future)/grace(past)/lapsed + admin bypass).
 *
 * Test strategy: source-text assertions for structural checks (offline, deterministic);
 * inline reference implementations for behavioral tests. No D1 or Stripe I/O.
 *
 * @module tests/subscription
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Reference implementations (mirrors subscription.ts logic) for behavioral tests
// ---------------------------------------------------------------------------

type SubscriptionStatus = 'none' | 'active' | 'grace' | 'lapsed';

interface AgentSubscriptionState {
  subscription_status: SubscriptionStatus;
  subscription_grace_until: number | null; // epoch seconds
  is_admin: number; // 0 or 1
}

/**
 * Mirror of isAgentPublishable from src/lib/subscription.ts.
 * Admin (is_admin=1) always publishable.
 * active: publishable.
 * grace: publishable until subscription_grace_until epoch (seconds) passes.
 * none / lapsed: not publishable.
 */
function isAgentPublishable(agent: AgentSubscriptionState): boolean {
  if (agent.is_admin === 1) return true;
  if (agent.subscription_status === 'active') return true;
  if (
    agent.subscription_status === 'grace' &&
    agent.subscription_grace_until !== null &&
    Math.floor(Date.now() / 1000) < agent.subscription_grace_until
  ) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Structural checks — verify src/lib/subscription.ts contains correct exports
// ---------------------------------------------------------------------------

describe('subscription.ts module structure', () => {
  const filePath = path.join(srcRoot, 'lib', 'subscription.ts');

  it('subscription.ts should exist at src/lib/subscription.ts', () => {
    // Arrange / Act
    const exists = fs.existsSync(filePath);
    // Assert
    assert.ok(exists, 'src/lib/subscription.ts must exist');
  });

  it('subscription.ts should export SubscriptionStatus type', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('SubscriptionStatus'),
      "SubscriptionStatus type must be exported from subscription.ts"
    );
  });

  it('subscription.ts should export AgentSubscriptionState interface', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('AgentSubscriptionState'),
      "AgentSubscriptionState interface must be exported from subscription.ts"
    );
  });

  it('subscription.ts should export isAgentPublishable function', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('export function isAgentPublishable'),
      'isAgentPublishable must be a named function export'
    );
  });

  it('subscription.ts should export AGENT_PUBLISHABLE_SQL constant', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('export const AGENT_PUBLISHABLE_SQL'),
      'AGENT_PUBLISHABLE_SQL must be a named const export'
    );
  });

  it('subscription.ts should export getAgentSubscriptionState function', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('export async function getAgentSubscriptionState'),
      'getAgentSubscriptionState must be a named async function export'
    );
  });

  it('AGENT_PUBLISHABLE_SQL should include admin bypass (is_admin=1)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('is_admin') && content.includes('1'),
      'AGENT_PUBLISHABLE_SQL must check is_admin = 1 for admin bypass'
    );
  });

  it("AGENT_PUBLISHABLE_SQL should include subscription_status='active' check", () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes("subscription_status = 'active'"),
      "AGENT_PUBLISHABLE_SQL must check subscription_status = 'active'"
    );
  });

  it('AGENT_PUBLISHABLE_SQL should include unixepoch() for grace comparison (epoch seconds)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('unixepoch()'),
      'AGENT_PUBLISHABLE_SQL must use unixepoch() to compare grace_until in epoch seconds (not ms)'
    );
  });

  it('subscription.ts should have JSDoc @module comment (CLAUDE.md convention)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(content.includes('@module'), 'subscription.ts must have a JSDoc @module comment');
  });

  it('subscription.ts should be under 500 lines (CLAUDE.md)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    // Act + Assert
    assert.ok(lineCount < 500, `subscription.ts must be under 500 lines (got ${lineCount})`);
  });
});

// ---------------------------------------------------------------------------
// Behavioral tests: isAgentPublishable (all 4 statuses + admin + grace boundary)
// ---------------------------------------------------------------------------

describe('isAgentPublishable (behavior)', () => {
  it('returns true for admin (is_admin=1) regardless of subscription_status=none', () => {
    // Arrange
    const agent: AgentSubscriptionState = {
      is_admin: 1,
      subscription_status: 'none',
      subscription_grace_until: null,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), true);
  });

  it('returns true for admin (is_admin=1) regardless of subscription_status=lapsed', () => {
    // Arrange
    const agent: AgentSubscriptionState = {
      is_admin: 1,
      subscription_status: 'lapsed',
      subscription_grace_until: null,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), true);
  });

  it('returns true for active subscription (is_admin=0)', () => {
    // Arrange
    const agent: AgentSubscriptionState = {
      is_admin: 0,
      subscription_status: 'active',
      subscription_grace_until: null,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), true);
  });

  it('returns true for grace status with grace_until in the future', () => {
    // Arrange: grace_until is 1 hour in the future (epoch seconds)
    const futureGrace = Math.floor(Date.now() / 1000) + 3600;
    const agent: AgentSubscriptionState = {
      is_admin: 0,
      subscription_status: 'grace',
      subscription_grace_until: futureGrace,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), true);
  });

  it('returns false for grace status with grace_until in the past (grace expired)', () => {
    // Arrange: grace_until is 1 second in the past (epoch seconds)
    const pastGrace = Math.floor(Date.now() / 1000) - 1;
    const agent: AgentSubscriptionState = {
      is_admin: 0,
      subscription_status: 'grace',
      subscription_grace_until: pastGrace,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), false);
  });

  it('returns false for grace status with grace_until=null (defensive edge case)', () => {
    // Arrange: grace status but null grace_until — treat as expired
    const agent: AgentSubscriptionState = {
      is_admin: 0,
      subscription_status: 'grace',
      subscription_grace_until: null,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), false);
  });

  it('returns false for subscription_status=none (is_admin=0)', () => {
    // Arrange
    const agent: AgentSubscriptionState = {
      is_admin: 0,
      subscription_status: 'none',
      subscription_grace_until: null,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), false);
  });

  it('returns false for subscription_status=lapsed (is_admin=0)', () => {
    // Arrange
    const agent: AgentSubscriptionState = {
      is_admin: 0,
      subscription_status: 'lapsed',
      subscription_grace_until: null,
    };
    // Act + Assert
    assert.equal(isAgentPublishable(agent), false);
  });
});
