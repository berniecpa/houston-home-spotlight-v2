/**
 * Video Poller Tests — Plan 06-03, Tasks 1 + 2
 *
 * Source-grep assertions verifying:
 *
 * Task 1 — poller.ts:
 *   1. SELECT scans video_jobs with status='processing' and the stale guard
 *      (updated_at < unixepoch() - 300)
 *   2. SELECT includes task_id IS NOT NULL guard
 *   3. SELECT includes 'attempts' column
 *   4. Calls getProviderByName + getStatus
 *   5. Calls applyTerminalResult for ready status
 *   6. Implements kie→higgsfield failover guarded by attempts < KIE_ATTEMPT_CAP (2)
 *   7. Records provider='higgsfield' + incremented attempts via recordAttempt
 *   8. Wraps per-job work in try/catch with console.error
 *   9. Exports pollVideoJobs
 *
 * Task 2 — custom-worker.ts:
 *   1. Imports handler from '.open-next/worker.js'
 *   2. Re-exports handler.fetch
 *   3. Defines an async scheduled() handler
 *   4. Calls ctx.waitUntil(pollVideoJobs(env))
 *   5. Imports pollVideoJobs from './src/lib/video/poller'
 *
 * Task 2 — wrangler.toml:
 *   1. main = "./custom-worker.ts" (Pitfall 5 regression guard)
 *   2. [triggers] section present
 *   3. crons with 5-minute cadence
 *   4. D1 binding block still present (regression guard)
 *
 * These are structural / source-grep tests that do not require a live D1
 * connection or provider API keys.
 *
 * @module tests/video-poller
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const pollerPath       = join(root, 'src/lib/video/poller.ts');
const customWorkerPath = join(root, 'custom-worker.ts');
const wranglerPath     = join(root, 'wrangler.toml');

const poller       = readFileSync(pollerPath, 'utf-8');
const customWorker = readFileSync(customWorkerPath, 'utf-8');
const wrangler     = readFileSync(wranglerPath, 'utf-8');

// ---------------------------------------------------------------------------
// poller.ts — SQL scan assertions (Task 1)
// ---------------------------------------------------------------------------

describe("poller.ts — SQL scan: status='processing' and stale guard", () => {
  it("SELECTs video_jobs WHERE status = 'processing'", () => {
    assert.ok(
      poller.includes("status = 'processing'") || poller.includes("status='processing'"),
      "poller.ts must SELECT video_jobs WHERE status = 'processing'"
    );
  });

  it('has updated_at < unixepoch() - 300 stale guard (Pitfall 6)', () => {
    assert.ok(
      poller.includes('unixepoch() - 300') || poller.includes('unixepoch()-300'),
      'poller.ts must include updated_at < unixepoch() - 300 stale guard to avoid racing the callback'
    );
  });

  it('includes task_id IS NOT NULL guard to skip un-submitted jobs', () => {
    assert.ok(
      poller.includes('task_id IS NOT NULL'),
      'poller.ts must include task_id IS NOT NULL guard so un-submitted jobs are skipped'
    );
  });

  it('reads attempts column from video_jobs (required for failover cap)', () => {
    assert.ok(
      poller.includes('attempts'),
      'poller.ts SELECT must include the attempts column (needed for kie→higgsfield failover cap)'
    );
  });
});

// ---------------------------------------------------------------------------
// poller.ts — provider resolution and status poll (Task 1)
// ---------------------------------------------------------------------------

describe('poller.ts — provider resolution and status polling', () => {
  it('calls getProviderByName to resolve the per-job adapter', () => {
    assert.ok(
      poller.includes('getProviderByName'),
      'poller.ts must call getProviderByName(job.provider, env) to resolve the correct adapter'
    );
  });

  it('calls getStatus on the resolved adapter', () => {
    assert.ok(
      poller.includes('getStatus'),
      "poller.ts must call adapter.getStatus(job.task_id) to poll provider for current status"
    );
  });

  it("imports getProviderByName from '@/lib/video/provider'", () => {
    assert.ok(
      poller.includes("from '@/lib/video/provider'"),
      "poller.ts must import getProviderByName from '@/lib/video/provider'"
    );
  });
});

// ---------------------------------------------------------------------------
// poller.ts — terminal write path (Task 1)
// ---------------------------------------------------------------------------

describe('poller.ts — applyTerminalResult for ready status', () => {
  it('calls applyTerminalResult to converge on the shared idempotent write path', () => {
    assert.ok(
      poller.includes('applyTerminalResult'),
      "poller.ts must call applyTerminalResult to write the terminal state (same path as callback, no double-write)"
    );
  });

  it("imports applyTerminalResult from '@/lib/video/jobs'", () => {
    assert.ok(
      poller.includes("from '@/lib/video/jobs'"),
      "poller.ts must import applyTerminalResult from '@/lib/video/jobs'"
    );
  });

  it("passes { status: 'ready', videoUrl } to applyTerminalResult on success", () => {
    assert.ok(
      poller.includes("status: 'ready'") || poller.includes("status:'ready'"),
      "poller.ts must call applyTerminalResult with { status: 'ready', videoUrl } when provider returns ready"
    );
  });

  it("passes { status: 'failed' } to applyTerminalResult on exhausted attempts", () => {
    assert.ok(
      poller.includes("status: 'failed'") || poller.includes("status:'failed'"),
      "poller.ts must call applyTerminalResult with { status: 'failed' } on terminal failure"
    );
  });
});

// ---------------------------------------------------------------------------
// poller.ts — kie→higgsfield failover (Task 1, VIDEO-03)
// ---------------------------------------------------------------------------

describe('poller.ts — kie→higgsfield failover with attempt cap (VIDEO-03)', () => {
  it("guards failover with job.provider === 'kie' check", () => {
    assert.ok(
      poller.includes("provider === 'kie'") || poller.includes("job.provider === 'kie'"),
      "poller.ts must only fail over to HiggsField when job.provider === 'kie'"
    );
  });

  it('guards failover with an attempts cap (< 2 or < KIE_ATTEMPT_CAP)', () => {
    assert.ok(
      poller.includes('attempts < KIE_ATTEMPT_CAP') ||
      poller.includes('job.attempts < KIE_ATTEMPT_CAP') ||
      poller.includes('attempts < 2') ||
      poller.includes('job.attempts < 2'),
      'poller.ts must guard failover with attempts < cap (VIDEO-03: 2-attempt cap)'
    );
  });

  it("calls recordAttempt with provider='higgsfield' and attempts+1 (VIDEO-03)", () => {
    assert.ok(
      poller.includes('recordAttempt') && poller.includes('higgsfield'),
      "poller.ts must call recordAttempt(db, job.id, 'higgsfield', attempts+1) on failover (VIDEO-03)"
    );
  });

  it('calls setTaskId to store the new HiggsField task_id', () => {
    assert.ok(
      poller.includes('setTaskId'),
      'poller.ts must call setTaskId(db, job.id, newTaskId) after successful HiggsField submission'
    );
  });
});

// ---------------------------------------------------------------------------
// poller.ts — per-job fault isolation (Task 1)
// ---------------------------------------------------------------------------

describe('poller.ts — per-job try/catch fault isolation', () => {
  it('wraps per-job work in try/catch so one error does not abort the batch', () => {
    assert.ok(
      poller.includes('try {') || poller.includes('try{'),
      'poller.ts must use try/catch per-job so one provider error does not abort the whole scan'
    );
  });

  it('logs per-job failures via console.error', () => {
    assert.ok(
      poller.includes('console.error'),
      'poller.ts must log per-job failures via console.error'
    );
  });
});

// ---------------------------------------------------------------------------
// poller.ts — export (Task 1)
// ---------------------------------------------------------------------------

describe('poller.ts — pollVideoJobs export', () => {
  it('exports pollVideoJobs function', () => {
    assert.ok(
      poller.includes('export async function pollVideoJobs'),
      'poller.ts must export async function pollVideoJobs for the scheduled handler to call'
    );
  });
});

// ---------------------------------------------------------------------------
// custom-worker.ts — OpenNext fetch re-export and scheduled handler (Task 2)
// ---------------------------------------------------------------------------

describe('custom-worker.ts — OpenNext handler import and fetch re-export', () => {
  it("imports handler from '.open-next/worker.js' (build-time artifact)", () => {
    assert.ok(
      customWorker.includes('.open-next/worker.js') || customWorker.includes('.open-next/worker'),
      "custom-worker.ts must import the generated handler from './.open-next/worker.js'"
    );
  });

  it('re-exports handler.fetch as the fetch handler', () => {
    assert.ok(
      customWorker.includes('handler.fetch') || customWorker.includes('fetch: handler.fetch'),
      'custom-worker.ts must re-export handler.fetch so normal requests are not broken'
    );
  });
});

describe('custom-worker.ts — scheduled handler wiring (Task 2)', () => {
  it('defines an async scheduled() handler', () => {
    assert.ok(
      customWorker.includes('async scheduled') || customWorker.includes('scheduled('),
      'custom-worker.ts must define an async scheduled() handler for the cron trigger'
    );
  });

  it('calls ctx.waitUntil(pollVideoJobs(env)) in the scheduled handler', () => {
    assert.ok(
      customWorker.includes('ctx.waitUntil') && customWorker.includes('pollVideoJobs'),
      'custom-worker.ts scheduled() must call ctx.waitUntil(pollVideoJobs(env))'
    );
  });

  it("imports pollVideoJobs from './src/lib/video/poller'", () => {
    assert.ok(
      customWorker.includes('./src/lib/video/poller') ||
      customWorker.includes('src/lib/video/poller'),
      "custom-worker.ts must import pollVideoJobs from './src/lib/video/poller'"
    );
  });
});

// ---------------------------------------------------------------------------
// wrangler.toml — main pointer + [triggers] cron (Task 2)
// ---------------------------------------------------------------------------

describe('wrangler.toml — main points at custom-worker.ts (Pitfall 5 regression guard)', () => {
  it('main = "./custom-worker.ts"', () => {
    assert.ok(
      wrangler.includes('main = "./custom-worker.ts"') ||
      wrangler.includes('main="./custom-worker.ts"'),
      'wrangler.toml main must be updated to "./custom-worker.ts" (Pitfall 5: old .open-next/worker.js silently no-ops the cron)'
    );
  });
});

describe('wrangler.toml — [triggers] cron section (Task 2)', () => {
  it('has a [triggers] section', () => {
    assert.ok(
      wrangler.includes('[triggers]'),
      'wrangler.toml must have a [triggers] section for the cron configuration'
    );
  });

  it('cron schedule is */5 * * * * (every 5 minutes, not every 1 minute)', () => {
    assert.ok(
      wrangler.includes('*/5 * * * *'),
      'wrangler.toml crons must use */5 * * * * (5-minute cadence, not 1-minute — Pitfall 6)'
    );
  });
});

describe('wrangler.toml — D1 binding regression guard (Task 2)', () => {
  it('D1 binding block still present after wrangler.toml changes', () => {
    assert.ok(
      wrangler.includes('[[d1_databases]]') && wrangler.includes('binding = "DB"'),
      'wrangler.toml must still contain [[d1_databases]] with binding = "DB" after main + triggers changes'
    );
  });

  it('database_name is still houston-home-spotlight', () => {
    assert.ok(
      wrangler.includes('houston-home-spotlight'),
      'wrangler.toml database_name must remain houston-home-spotlight (regression guard)'
    );
  });
});
