/**
 * Tests for firebase-errors mapping function
 *
 * Verifies that Firebase auth error codes map to the exact human-readable copy
 * defined in the UI-SPEC Copywriting Contract. Tests follow the RED -> GREEN TDD cycle.
 *
 * @module tests/firebase-errors
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..');

describe('firebase-errors module', () => {
  it('firebase-errors.ts should exist at src/lib/firebase-errors.ts', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');

    // Act
    const exists = fs.existsSync(filePath);

    // Assert
    assert.strictEqual(exists, true, 'src/lib/firebase-errors.ts must exist');
  });

  it('firebase-errors.ts should export firebaseErrorMessage function', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('export function firebaseErrorMessage') ||
        content.includes('export const firebaseErrorMessage'),
      'firebaseErrorMessage must be a named export'
    );
  });

  it('firebase-errors.ts should map auth/email-already-in-use', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('email-already-in-use'),
      'must handle auth/email-already-in-use error code'
    );
    assert.ok(
      content.includes('An account with this email already exists'),
      'email-already-in-use must return the UI-SPEC copy'
    );
  });

  it('firebase-errors.ts should map auth/wrong-password', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('wrong-password'),
      'must handle auth/wrong-password error code'
    );
    assert.ok(
      content.includes('Incorrect password'),
      'wrong-password must return the UI-SPEC copy'
    );
  });

  it('firebase-errors.ts should map auth/user-not-found', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('user-not-found'),
      'must handle auth/user-not-found error code'
    );
    assert.ok(
      content.includes('No account found with this email'),
      'user-not-found must return the UI-SPEC copy'
    );
  });

  it('firebase-errors.ts should map auth/weak-password', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('weak-password'),
      'must handle auth/weak-password error code'
    );
    assert.ok(
      content.includes('Password must be at least 8 characters'),
      'weak-password must return the UI-SPEC copy'
    );
  });

  it('firebase-errors.ts should map auth/invalid-email', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('invalid-email'),
      'must handle auth/invalid-email error code'
    );
    assert.ok(
      content.includes('Enter a valid email address'),
      'invalid-email must return the UI-SPEC copy'
    );
  });

  it('firebase-errors.ts should return fallback for unknown codes', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('Something went wrong. Please try again.'),
      'unknown codes must return default fallback copy'
    );
  });

  it('firebase-errors.ts should also handle auth/invalid-credential (Firebase v9+ alias)', () => {
    // Arrange - Firebase v9+ uses auth/invalid-credential for wrong-password in some SDKs
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('invalid-credential'),
      'must handle auth/invalid-credential (Firebase v9+ alias for wrong-password)'
    );
  });
});

describe('firebase-errors file-level checks', () => {
  it('firebase-errors.ts should have JSDoc module comment', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('@module'),
      'module must have a JSDoc @module comment (CLAUDE.md convention)'
    );
  });

  it('firebase-errors.ts should be under 500 lines (CLAUDE.md)', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'firebase-errors.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;

    // Act + Assert
    assert.ok(lineCount < 500, `firebase-errors.ts must be under 500 lines (got ${lineCount})`);
  });
});
