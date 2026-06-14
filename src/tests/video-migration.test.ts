/**
 * Video Migration Tests — Plan 06-01, Task 1
 *
 * Source-grep assertions verifying:
 *   1. db/migrations/0005_video_jobs.sql contains required table + indexes
 *   2. src/lib/video/jobs.ts contains required patterns:
 *      - dedup SELECT with status IN ('queued','processing')
 *      - idempotent UPDATE guarded by AND status = 'processing'
 *      - meta.changes read
 *      - isSafeHttpUrl guard before listings write
 *      - parameterized writes only (no template literals in SQL value positions)
 *
 * These are structural tests that do not require a live D1 connection.
 *
 * @module tests/video-migration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const migrationPath = join(root, 'db/migrations/0005_video_jobs.sql');
const jobsPath      = join(root, 'src/lib/video/jobs.ts');

const migration = readFileSync(migrationPath, 'utf-8');
const jobs      = readFileSync(jobsPath, 'utf-8');

// ---------------------------------------------------------------------------
// Migration file assertions
// ---------------------------------------------------------------------------

describe('0005_video_jobs.sql — table structure', () => {
  it('contains CREATE TABLE IF NOT EXISTS video_jobs', () => {
    assert.ok(
      migration.includes('CREATE TABLE IF NOT EXISTS video_jobs'),
      'Migration must define video_jobs table with CREATE TABLE IF NOT EXISTS'
    );
  });

  it('task_id column has UNIQUE constraint', () => {
    assert.ok(
      migration.includes('task_id') && migration.includes('UNIQUE'),
      'task_id column must have UNIQUE constraint for idempotent callback writes'
    );
  });

  it("status column has DEFAULT 'processing'", () => {
    assert.ok(
      migration.includes("DEFAULT 'processing'"),
      "status column must DEFAULT to 'processing'"
    );
  });

  it('attempts column has DEFAULT 1', () => {
    assert.ok(
      migration.includes('DEFAULT 1'),
      'attempts column must DEFAULT to 1'
    );
  });

  it('listing_id references listings(id) — FK constraint', () => {
    assert.ok(
      migration.includes('REFERENCES listings(id)'),
      'listing_id must have a REFERENCES listings(id) FK constraint'
    );
  });

  it('agent_id references agents(id) — FK constraint', () => {
    assert.ok(
      migration.includes('REFERENCES agents(id)'),
      'agent_id must have a REFERENCES agents(id) FK constraint'
    );
  });

  it('idx_video_jobs_listing_id index exists', () => {
    assert.ok(
      migration.includes('idx_video_jobs_listing_id'),
      'idx_video_jobs_listing_id index must be created'
    );
  });

  it('idx_video_jobs_task_id index exists', () => {
    assert.ok(
      migration.includes('idx_video_jobs_task_id'),
      'idx_video_jobs_task_id index must be created'
    );
  });

  it('idx_video_jobs_status index exists', () => {
    assert.ok(
      migration.includes('idx_video_jobs_status'),
      'idx_video_jobs_status index must be created'
    );
  });
});

// ---------------------------------------------------------------------------
// jobs.ts pattern assertions
// ---------------------------------------------------------------------------

describe('jobs.ts — dedup SELECT pattern', () => {
  it("findActiveJob queries status IN ('queued','processing')", () => {
    const hasQueued     = jobs.includes("'queued'");
    const hasProcessing = jobs.includes("'processing'");
    const hasStatusIn   = jobs.includes('status IN');
    assert.ok(
      hasStatusIn && hasQueued && hasProcessing,
      "findActiveJob must use status IN ('queued', 'processing') for dedup query"
    );
  });

  it('findActiveJob query targets video_jobs table', () => {
    assert.ok(
      jobs.includes('FROM video_jobs'),
      'findActiveJob must SELECT FROM video_jobs'
    );
  });

  it('findActiveJob uses LIMIT 1', () => {
    assert.ok(
      jobs.includes('LIMIT 1'),
      'findActiveJob must use LIMIT 1 to return at most one active job'
    );
  });
});

describe('jobs.ts — idempotent terminal write pattern', () => {
  it("applyTerminalResult UPDATE is guarded by AND status = 'processing'", () => {
    assert.ok(
      jobs.includes("AND status = 'processing'"),
      "applyTerminalResult UPDATE must be guarded by `AND status = 'processing'` for idempotency"
    );
  });

  it('meta.changes is read to detect no-op (already-terminal guard)', () => {
    assert.ok(
      jobs.includes('meta.changes'),
      'applyTerminalResult must read meta.changes to detect already-terminal rows'
    );
  });

  it('returns { applied: false } when meta.changes === 0', () => {
    assert.ok(
      jobs.includes('applied: false'),
      'applyTerminalResult must return { applied: false } when row is already terminal'
    );
  });
});

describe('jobs.ts — SSRF guard before listings write', () => {
  it('imports isSafeHttpUrl from @/lib/listings-db', () => {
    assert.ok(
      jobs.includes('isSafeHttpUrl') && jobs.includes('@/lib/listings-db'),
      'jobs.ts must import isSafeHttpUrl from @/lib/listings-db (T-06-02)'
    );
  });

  it('calls isSafeHttpUrl before writing to listings table', () => {
    const urlCheckIdx   = jobs.indexOf('isSafeHttpUrl');
    const listingsWrite = jobs.indexOf('SET video_url');
    assert.ok(
      urlCheckIdx !== -1 && listingsWrite !== -1 && urlCheckIdx < listingsWrite,
      'isSafeHttpUrl check must appear before the listings video_url write (T-06-02)'
    );
  });
});

describe('jobs.ts — parameterized writes only (no SQL injection via template literals)', () => {
  it('does not use template literals (${...}) inside SQL string value positions', () => {
    // Verify that ${...} template expressions do not appear inside SQL
    // passed to .prepare(). Only plain string literals are allowed.
    const hasTemplateSql = /prepare\(`[^`]*\$\{/.test(jobs);
    assert.ok(
      !hasTemplateSql,
      'SQL passed to prepare() must not contain template literal interpolations (${ ... })'
    );
  });
});
