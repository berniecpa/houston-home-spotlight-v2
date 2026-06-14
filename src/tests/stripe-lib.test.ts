/**
 * Structural tests for src/lib/stripe.ts.
 *
 * Validates the Workers-safe Stripe client factory using source-text assertions
 * (no live Stripe imports — offline and deterministic).
 *
 * Checks:
 *   - File exports `getStripe` and `stripeCryptoProvider`
 *   - Uses `createFetchHttpClient` (required; Workers has no node:https)
 *   - Pins explicit apiVersion '2026-05-27.dahlia'
 *   - Does NOT export `runtime = 'edge'` (deviation from Phase 2 — @opennextjs/cloudflare v1.x)
 *   - Has JSDoc @module comment (CLAUDE.md convention)
 *   - Is under 500 lines (CLAUDE.md)
 *
 * @module tests/stripe-lib
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..');

describe('stripe.ts module structure', () => {
  const filePath = path.join(srcRoot, 'lib', 'stripe.ts');

  it('stripe.ts should exist at src/lib/stripe.ts', () => {
    // Arrange / Act
    const exists = fs.existsSync(filePath);
    // Assert
    assert.ok(exists, 'src/lib/stripe.ts must exist');
  });

  it('stripe.ts should export getStripe function', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('export function getStripe'),
      'getStripe must be a named function export'
    );
  });

  it('stripe.ts should export stripeCryptoProvider constant', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('export const stripeCryptoProvider'),
      'stripeCryptoProvider must be a named const export'
    );
  });

  it('stripe.ts should use createFetchHttpClient (Workers requires Fetch HTTP client — no node:https)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('createFetchHttpClient'),
      'stripe.ts must call Stripe.createFetchHttpClient() — node:https unavailable in Workers'
    );
  });

  it("stripe.ts should pin apiVersion '2026-05-27.dahlia'", () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes("'2026-05-27.dahlia'"),
      "stripe.ts must pin apiVersion: '2026-05-27.dahlia' (stripe@22.2.1 SDK default)"
    );
  });

  it("stripe.ts should NOT export runtime = 'edge' (forbidden — @opennextjs/cloudflare v1.x)", () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act: check non-comment lines only for the export declaration
    const nonCommentLines = content
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'));
    const hasEdgeExport = nonCommentLines.some(
      (line) => line.includes('export') && line.includes('runtime') && line.includes("'edge'")
    );
    // Assert
    assert.ok(
      !hasEdgeExport,
      "stripe.ts must not declare 'export const runtime = \"edge\"' — @opennextjs/cloudflare v1.x does not support edge runtime"
    );
  });

  it('stripe.ts should have JSDoc @module comment (CLAUDE.md convention)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    // Act + Assert
    assert.ok(
      content.includes('@module'),
      'stripe.ts must have a JSDoc @module comment'
    );
  });

  it('stripe.ts should be under 500 lines (CLAUDE.md)', () => {
    // Arrange
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    // Act + Assert
    assert.ok(lineCount < 500, `stripe.ts must be under 500 lines (got ${lineCount})`);
  });
});
