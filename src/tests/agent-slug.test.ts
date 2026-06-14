/**
 * Agent Slug Tests — Plan 05-01, Task 2
 *
 * Source-grep assertions verifying that the profile PATCH route generates
 * and refreshes agent slugs from display_name (ADMIN-04, T-05-04, T-05-05),
 * and that the backfill migration file exists and is correctly documented.
 *
 * These are structural tests that do not require a live D1 connection —
 * they assert the presence of required patterns in implementation files,
 * consistent with the existing test suite style (source-grep).
 *
 * @module tests/agent-slug
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const profileRoutePath   = join(root, 'src/app/api/agent/profile/route.ts');
const backfillMigration  = join(root, 'db/migrations/0004_backfill_agent_slugs.sql');

const profileRoute = readFileSync(profileRoutePath, 'utf-8');

// ---------------------------------------------------------------------------
// profile/route.ts — slugifyName helper
// ---------------------------------------------------------------------------
describe('profile/route.ts — slugifyName helper (ADMIN-04)', () => {
  it('defines slugifyName function', () => {
    assert.ok(
      profileRoute.includes('function slugifyName'),
      'profile/route.ts must define slugifyName helper function'
    );
  });

  it('slugifyName lowercases the input', () => {
    assert.ok(
      profileRoute.includes('.toLowerCase()'),
      'slugifyName must lowercase the display_name to produce a URL-safe slug'
    );
  });

  it('slugifyName strips non-alphanumeric characters', () => {
    assert.ok(
      profileRoute.includes("[^a-z0-9"),
      'slugifyName must strip non-alphanumeric characters (keep spaces and hyphens)'
    );
  });

  it('slugifyName collapses whitespace and hyphens', () => {
    assert.ok(
      profileRoute.includes("replace(/[\\s-]+/g, '-')") ||
      profileRoute.includes("replace(/[\\s-]+/g,'-')"),
      'slugifyName must collapse consecutive whitespace/hyphens into a single hyphen'
    );
  });

  it('slugifyName truncates to safe length', () => {
    assert.ok(
      profileRoute.includes('.slice(0, 80)'),
      'slugifyName must truncate to 80 characters to avoid D1 index issues'
    );
  });

  it('slugifyName falls back to agent- prefix when result is empty', () => {
    assert.ok(
      profileRoute.includes('agent-') && profileRoute.includes("crypto.randomUUID().slice(0, 8)"),
      'slugifyName must fall back to agent-<random8> when the name produces an empty slug'
    );
  });
});

// ---------------------------------------------------------------------------
// profile/route.ts — PATCH handler slug generation
// ---------------------------------------------------------------------------
describe('profile/route.ts — PATCH handler slug generation (T-05-04, T-05-05)', () => {
  it('PATCH calls slugifyName to derive base slug', () => {
    assert.ok(
      profileRoute.includes('slugifyName('),
      'PATCH handler must call slugifyName to derive the base slug from display_name'
    );
  });

  it('PATCH writes slug column to agents table', () => {
    assert.ok(
      profileRoute.includes('slug') && profileRoute.includes('UPDATE agents'),
      'PATCH handler must write the slug column in the UPDATE agents statement'
    );
  });

  it('PATCH checks slug collision excluding caller own row (T-05-05)', () => {
    assert.ok(
      profileRoute.includes('slug = ? AND id != ?'),
      "PATCH collision check must exclude the caller's own row (id != ?) to allow re-save of same name"
    );
  });

  it('PATCH uses numeric suffix loop for collision resolution', () => {
    assert.ok(
      profileRoute.includes('suffix') && profileRoute.includes('suffix += 1'),
      'PATCH must resolve slug collisions with an incrementing numeric suffix'
    );
  });

  it('PATCH suffix loop appends baseSlug with suffix pattern', () => {
    assert.ok(
      profileRoute.includes('baseSlug') && profileRoute.includes('suffix'),
      'PATCH must construct suffixed slug from baseSlug + numeric suffix (e.g. jane-smith-2)'
    );
  });

  it('slug derivation uses session uid (not body-supplied id) — T-05-04', () => {
    assert.ok(
      profileRoute.includes('uid') && profileRoute.includes('WHERE id = ?'),
      'Slug UPDATE must use the session-derived uid, never a body-supplied id (T-05-04)'
    );
  });

  it('photo_url isSafeHttpUrl check is preserved', () => {
    assert.ok(
      profileRoute.includes('isSafeHttpUrl'),
      'Photo URL http(s) allowlist check must be preserved (CR-01)'
    );
  });

  it('409 record-not-found path is preserved', () => {
    assert.ok(
      profileRoute.includes('409') && profileRoute.includes('record not found'),
      'Profile record not found 409 response must be preserved (WR-03)'
    );
  });
});

// ---------------------------------------------------------------------------
// db/migrations/0004_backfill_agent_slugs.sql — backfill migration
// ---------------------------------------------------------------------------
describe('db/migrations/0004_backfill_agent_slugs.sql — backfill (ADMIN-04)', () => {
  it('backfill migration file exists', () => {
    assert.ok(
      existsSync(backfillMigration),
      'db/migrations/0004_backfill_agent_slugs.sql must exist'
    );
  });

  it('migration contains UPDATE agents statement', () => {
    const content = readFileSync(backfillMigration, 'utf-8');
    assert.ok(
      content.includes('UPDATE agents'),
      'Backfill migration must contain UPDATE agents statement'
    );
  });

  it('migration targets the slug column', () => {
    const content = readFileSync(backfillMigration, 'utf-8');
    assert.ok(
      content.includes('slug'),
      'Backfill migration must reference the slug column'
    );
  });

  it('migration only updates rows WHERE slug IS NULL', () => {
    const content = readFileSync(backfillMigration, 'utf-8');
    assert.ok(
      content.includes('WHERE slug IS NULL'),
      'Backfill migration must guard with WHERE slug IS NULL to avoid overwriting existing slugs'
    );
  });

  it('migration is documented as application-deferred', () => {
    const content = readFileSync(backfillMigration, 'utf-8');
    assert.ok(
      content.includes('APPLICATION DEFERRED') || content.includes('DEFERRED'),
      'Backfill migration must document that application is deferred (requires agent rows)'
    );
  });

  it('migration falls back to agent- prefix when display_name is null', () => {
    const content = readFileSync(backfillMigration, 'utf-8');
    assert.ok(
      content.includes("'agent-'"),
      "Backfill migration must fall back to 'agent-' prefix for agents with NULL display_name"
    );
  });
});
