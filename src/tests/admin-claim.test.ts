/**
 * admin-claim.test.ts
 *
 * Guards the Workers-runtime boundary for firebase-admin.
 *
 * These tests enforce two invariants that protect production correctness:
 *
 * 1. No src/ file imports firebase-admin.
 *    firebase-admin uses node:crypto and node:net -- both unavailable in
 *    Cloudflare Workers. If any src/ file imports it, the Workers runtime
 *    will throw at deploy time (T-02-20 mitigation).
 *
 * 2. scripts/set-admin-claim.ts contains setCustomUserClaims.
 *    Structural check confirming the admin-claim script uses the correct
 *    firebase-admin setCustomUserClaims call (RESEARCH Pattern 6).
 *
 * These run with the Node.js built-in test runner (node --test).
 * No third-party test framework required.
 *
 * @module tests/admin-claim
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recursively collect all .ts and .tsx files under a directory.
 * Skips node_modules, .next, and test files (*.test.ts) -- test files are
 * never deployed to Workers so they are exempt from the firebase-admin boundary.
 */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    // Skip directories that should never contain app source
    if (entry === 'node_modules' || entry === '.next' || entry === '.open-next') {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.endsWith('.tsx') || (entry.endsWith('.ts') && !entry.endsWith('.test.ts'))) {
      // Exclude *.test.ts files: they run in Node.js only and are never
      // deployed to Cloudflare Workers, so they are exempt from this guard.
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check whether a file's content contains an import of firebase-admin.
 * Matches both single-quote and double-quote import forms:
 *   from 'firebase-admin'
 *   from 'firebase-admin/app'
 *   from "firebase-admin"
 *   require('firebase-admin')
 *   require("firebase-admin")
 */
function importsFirebaseAdmin(content: string): boolean {
  return (
    /from\s+['"]firebase-admin['"]/.test(content) ||
    /from\s+['"]firebase-admin\//.test(content) ||
    /require\s*\(\s*['"]firebase-admin/.test(content)
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(process.cwd());
const SRC_DIR = join(PROJECT_ROOT, 'src');
const ADMIN_CLAIM_SCRIPT = join(PROJECT_ROOT, 'scripts', 'set-admin-claim.ts');

describe('firebase-admin Workers-runtime boundary guard', () => {
  it('no file under src/ imports firebase-admin (would crash Workers runtime)', () => {
    const sourceFiles = collectSourceFiles(SRC_DIR);

    // Must have found at least some source files (sanity check)
    assert.ok(
      sourceFiles.length > 0,
      `Expected to find TypeScript files under ${SRC_DIR} but found none`
    );

    const violators: string[] = [];

    for (const file of sourceFiles) {
      let content: string;
      try {
        content = readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      if (importsFirebaseAdmin(content)) {
        violators.push(file);
      }
    }

    assert.deepEqual(
      violators,
      [],
      `The following src/ files import firebase-admin, which will crash at Cloudflare Workers runtime.\n` +
      `firebase-admin uses node:crypto and node:net which are unavailable in Workers.\n` +
      `Move any firebase-admin usage to scripts/ only.\n\n` +
      `Violating files:\n${violators.map((f) => `  - ${f}`).join('\n')}`
    );
  });

  it('scripts/set-admin-claim.ts exists and contains setCustomUserClaims', () => {
    let content: string;
    try {
      content = readFileSync(ADMIN_CLAIM_SCRIPT, 'utf-8');
    } catch {
      assert.fail(
        `scripts/set-admin-claim.ts does not exist at expected path: ${ADMIN_CLAIM_SCRIPT}\n` +
        "This file is required to set Bernard's admin custom claim via firebase-admin."
      );
    }

    assert.ok(
      content.includes('setCustomUserClaims'),
      'scripts/set-admin-claim.ts must call setCustomUserClaims to set the admin:true claim'
    );
  });

  it('scripts/set-admin-claim.ts reads BERNARD_UID from environment (not hardcoded)', () => {
    const content = readFileSync(ADMIN_CLAIM_SCRIPT, 'utf-8');

    // Must reference process.env.BERNARD_UID
    assert.ok(
      content.includes('process.env.BERNARD_UID'),
      'scripts/set-admin-claim.ts must read the UID from process.env.BERNARD_UID, not hardcode it'
    );
  });

  it('scripts/set-admin-claim.ts imports from firebase-admin (correct location)', () => {
    const content = readFileSync(ADMIN_CLAIM_SCRIPT, 'utf-8');

    assert.ok(
      importsFirebaseAdmin(content),
      'scripts/set-admin-claim.ts must import from firebase-admin (it is the Node.js-only admin script)'
    );
  });
});

describe('admin route shell files exist', () => {
  it('src/app/(admin)/layout.tsx exists with red sidebar markup', () => {
    const layoutPath = join(SRC_DIR, 'app', '(admin)', 'layout.tsx');
    let content: string;
    try {
      content = readFileSync(layoutPath, 'utf-8');
    } catch {
      assert.fail(
        `src/app/(admin)/layout.tsx does not exist.\n` +
        'This file is required for the admin route group shell.'
      );
    }

    assert.ok(
      content.includes('red-800'),
      'Admin layout must use red-800 sidebar background per UI-SPEC Admin Layout contract'
    );

    assert.ok(
      content.includes('ADMIN'),
      'Admin layout must display the ADMIN badge per UI-SPEC'
    );
  });

  it('src/app/(admin)/admin/page.tsx renders the platform overview', () => {
    const pagePath = join(SRC_DIR, 'app', '(admin)', 'admin', 'page.tsx');
    let content: string;
    try {
      content = readFileSync(pagePath, 'utf-8');
    } catch {
      assert.fail(
        `src/app/(admin)/admin/page.tsx does not exist.\n` +
        'This file is required for the /admin route shell.'
      );
    }

    assert.ok(
      content.includes('Admin Panel'),
      'Admin page must include the "Admin Panel" heading per UI-SPEC'
    );

    assert.ok(
      content.includes('getPlatformStats') && content.includes('Manage Agents'),
      'Admin landing must show the platform overview (getPlatformStats) and link to the admin tools'
    );
  });
});

describe('package.json admin:set-claim script', () => {
  it('package.json contains admin:set-claim script entry', () => {
    const pkgPath = join(PROJECT_ROOT, 'package.json');
    const content = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };

    assert.ok(
      pkg.scripts?.['admin:set-claim'],
      'package.json must have an "admin:set-claim" script entry to run the claim setter'
    );

    assert.ok(
      pkg.scripts['admin:set-claim'].includes('set-admin-claim'),
      'The admin:set-claim script must invoke set-admin-claim.ts'
    );
  });
});

describe('.gitignore service account key exclusion', () => {
  it('.gitignore excludes serviceAccountKey.json (credentials must never be committed)', () => {
    const gitignorePath = join(PROJECT_ROOT, '.gitignore');
    let content: string;
    try {
      content = readFileSync(gitignorePath, 'utf-8');
    } catch {
      assert.fail('.gitignore file not found at project root');
    }

    assert.ok(
      content.includes('serviceAccountKey.json'),
      '.gitignore must exclude serviceAccountKey.json -- credentials must never be committed (T-02-19)'
    );
  });
});
