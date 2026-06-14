/**
 * Tests for auth-edge shared config and session route exports
 *
 * Verifies the static shape of authEdgeConfig and that the session route
 * module exports the expected handler names. Workers-runtime cookie behavior
 * (assumption A4) is validated manually via wrangler dev — it cannot be
 * tested with the Node.js test runner.
 *
 * @module tests/auth-edge
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..');

describe('auth-edge config shape', () => {
  it('auth-edge.ts should exist at src/lib/auth-edge.ts', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');

    // Act
    const exists = fs.existsSync(filePath);

    // Assert
    assert.strictEqual(exists, true, 'src/lib/auth-edge.ts must exist');
  });

  it('auth-edge.ts should export authEdgeConfig', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('export const authEdgeConfig'),
      'authEdgeConfig must be a named export'
    );
  });

  it('authEdgeConfig should set cookieName to __session', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes("cookieName: '__session'"),
      "cookieName must be '__session'"
    );
  });

  it('authEdgeConfig cookieSerializeOptions should have httpOnly: true', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('httpOnly: true'),
      'cookieSerializeOptions must include httpOnly: true'
    );
  });

  it('authEdgeConfig cookieSerializeOptions should have sameSite: lax', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes("sameSite: 'lax'"),
      "cookieSerializeOptions must include sameSite: 'lax' (as const)"
    );
  });

  it('authEdgeConfig should have two cookieSignatureKeys (rotation support)', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert — both COOKIE_SECRET_CURRENT and COOKIE_SECRET_PREVIOUS must be present
    assert.ok(
      content.includes('COOKIE_SECRET_CURRENT'),
      'cookieSignatureKeys must include COOKIE_SECRET_CURRENT'
    );
    assert.ok(
      content.includes('COOKIE_SECRET_PREVIOUS'),
      'cookieSignatureKeys must include COOKIE_SECRET_PREVIOUS (key rotation)'
    );
  });

  it('authEdgeConfig privateKey should normalize newlines (Pitfall 1)', () => {
    // Arrange
    const filePath = path.join(srcRoot, 'lib', 'auth-edge.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert — must apply .replace(/\\n/g, '\n') for wrangler secret PEM storage
    assert.ok(
      content.includes(".replace(/\\\\n/g, '\\n')"),
      "FIREBASE_PRIVATE_KEY must normalize \\\\n -> \\n (Pitfall 1)"
    );
  });
});

describe('session route exports', () => {
  it('session route file should exist at src/app/api/auth/session/route.ts', () => {
    // Arrange
    const filePath = path.join(
      srcRoot,
      'app',
      'api',
      'auth',
      'session',
      'route.ts'
    );

    // Act
    const exists = fs.existsSync(filePath);

    // Assert
    assert.strictEqual(
      exists,
      true,
      'src/app/api/auth/session/route.ts must exist'
    );
  });

  it('session route should export POST handler', () => {
    // Arrange
    const filePath = path.join(
      srcRoot,
      'app',
      'api',
      'auth',
      'session',
      'route.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('export async function POST'),
      'route.ts must export a POST handler'
    );
  });

  it('session route should export DELETE handler', () => {
    // Arrange
    const filePath = path.join(
      srcRoot,
      'app',
      'api',
      'auth',
      'session',
      'route.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('export async function DELETE'),
      'route.ts must export a DELETE handler'
    );
  });

  it('session route POST should gate on email_verified', () => {
    // Arrange — T-02-02 mitigation: unverified emails must be blocked
    const filePath = path.join(
      srcRoot,
      'app',
      'api',
      'auth',
      'session',
      'route.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('email_verified'),
      'POST handler must check decodedToken.email_verified (T-02-02 mitigation)'
    );
  });

  it('session route should use parameterized D1 queries (T-02-06)', () => {
    // Arrange — no string concatenation in SQL
    const filePath = path.join(
      srcRoot,
      'app',
      'api',
      'auth',
      'session',
      'route.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('.prepare('),
      'D1 queries must use .prepare() for parameterized execution (T-02-06)'
    );
    assert.ok(
      content.includes('.bind('),
      'D1 queries must use .bind() to prevent SQL injection (T-02-06)'
    );
  });
});

describe('middleware config', () => {
  it('middleware.ts should exist at project root', () => {
    // Arrange
    const filePath = path.join(srcRoot, '..', 'middleware.ts');

    // Act
    const exists = fs.existsSync(filePath);

    // Assert
    assert.strictEqual(exists, true, 'middleware.ts must exist at project root');
  });

  it('middleware.ts should export middleware function', () => {
    // Arrange
    const filePath = path.join(srcRoot, '..', 'middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('export async function middleware'),
      'middleware.ts must export the middleware function'
    );
  });

  it('middleware config matcher should include /dashboard/:path*', () => {
    // Arrange
    const filePath = path.join(srcRoot, '..', 'middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('/dashboard/:path*'),
      'matcher must protect /dashboard/:path* (Pitfall 2: no catch-all)'
    );
  });

  it('middleware config matcher should include /admin/:path*', () => {
    // Arrange
    const filePath = path.join(srcRoot, '..', 'middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes('/admin/:path*'),
      'matcher must protect /admin/:path*'
    );
  });

  it('middleware should import authEdgeConfig from @/lib/auth-edge', () => {
    // Arrange
    const filePath = path.join(srcRoot, '..', 'middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes("from '@/lib/auth-edge'"),
      'middleware must import authEdgeConfig from @/lib/auth-edge (single config source)'
    );
  });

  it('middleware admin gate uses STRICT equality on the admin claim (WR-01)', () => {
    // Arrange
    const filePath = path.join(srcRoot, '..', 'middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Act + Assert
    assert.ok(
      content.includes("claims['admin'] !== true") ||
        content.includes('claims["admin"] !== true'),
      'middleware must gate /admin with strict !== true — a truthy non-boolean claim must NOT grant admin (WR-01)'
    );
    assert.ok(
      !content.includes('!decodedToken.admin'),
      'middleware must NOT use a loose truthy !decodedToken.admin check (WR-01)'
    );
  });
});
