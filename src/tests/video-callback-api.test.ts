/**
 * Video Callback API Tests — Plan 06-02, Task 2
 *
 * Source-grep assertions for:
 *   1. callback/route.ts — reads raw body FIRST (req.text() before any req.json);
 *      logs raw body once; requires X-Webhook-Timestamp + X-Webhook-Signature
 *      (400 when missing); calls verifyKieSignature; 400 when KIE_WEBHOOK_SECRET
 *      unset; calls extractKieCallbackVideoUrl; calls applyTerminalResult; 200 no-op
 *      on {applied:false}; returns 200 { received:true }; contains middleware-exemption
 *      comment; does NOT contain runtime = 'edge'.
 *   2. middleware.ts matcher still equals ['/dashboard/:path*', '/admin/:path*']
 *      confirming /api/video/callback is exempt (not gated by auth middleware).
 *
 * @module tests/video-callback-api
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const callbackPath   = join(root, 'src/app/api/video/callback/route.ts');
const middlewarePath = join(root, 'middleware.ts');

const callback   = readFileSync(callbackPath, 'utf-8');
const middleware = readFileSync(middlewarePath, 'utf-8');

// ---------------------------------------------------------------------------
// callback/route.ts assertions
// ---------------------------------------------------------------------------

describe('callback/route.ts — POST Kie.ai webhook handler', () => {
  it('exports POST handler', () => {
    assert.ok(
      callback.includes('export async function POST'),
      'callback/route.ts must export POST'
    );
  });

  it('does NOT declare runtime = edge (opennextjs/cloudflare restriction)', () => {
    // The file may contain "export const runtime = 'edge'" inside a comment (DO NOT add).
    // Assert there is no ACTUAL export statement (i.e., no non-comment occurrence).
    // Strip comment lines and block comment content before checking.
    const codeLines = callback
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    assert.ok(
      !codeLines.includes("export const runtime = 'edge'") &&
        !codeLines.includes('export const runtime = "edge"'),
      'callback/route.ts must NOT have a real export const runtime = edge declaration'
    );
  });

  it('reads raw body FIRST via await req.text() before any req.json()', () => {
    // req.text() must be the first body access pattern.
    // The correct implementation uses JSON.parse(raw) rather than req.json() — so
    // req.json() should NOT appear as code (only possibly in comments).
    const textIdx = callback.indexOf('req.text()');

    assert.ok(
      textIdx !== -1,
      'callback/route.ts must call req.text() to read raw body'
    );

    // req.json() must NOT appear in code (only allowed in comments).
    // A comment occurrence is acceptable — grep non-comment lines only.
    const codeLines = callback
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    assert.ok(
      !codeLines.includes('req.json()'),
      'callback/route.ts must NOT call req.json() — use JSON.parse(raw) to preserve the raw body for HMAC'
    );

    // The body must be parsed via JSON.parse(raw) — the raw text variable
    assert.ok(
      callback.includes('JSON.parse(raw)'),
      'callback/route.ts must parse the body via JSON.parse(raw) after reading via req.text()'
    );
  });

  it('logs the raw body once for first-receipt resilience', () => {
    assert.ok(
      callback.includes('console.log'),
      'callback/route.ts must console.log the raw body once (first-receipt resilience)'
    );
    assert.ok(
      callback.includes('raw'),
      'callback/route.ts console.log must reference the raw body variable'
    );
  });

  it('reads X-Webhook-Timestamp header', () => {
    assert.ok(
      callback.includes('X-Webhook-Timestamp'),
      'callback/route.ts must read X-Webhook-Timestamp header'
    );
  });

  it('reads X-Webhook-Signature header', () => {
    assert.ok(
      callback.includes('X-Webhook-Signature'),
      'callback/route.ts must read X-Webhook-Signature header'
    );
  });

  it('returns 400 when signature headers are missing', () => {
    // Both headers are checked — must have at least one 400 for missing headers
    assert.ok(
      callback.includes('status: 400'),
      'callback/route.ts must return 400 on missing/invalid signature headers'
    );
    // Should have the guard before processing
    assert.ok(
      callback.includes('!timestamp || !signature') ||
        (callback.includes('!timestamp') && callback.includes('!signature')),
      'callback/route.ts must check both X-Webhook-Timestamp and X-Webhook-Signature'
    );
  });

  it('calls verifyKieSignature for HMAC verification (T-06-04)', () => {
    assert.ok(
      callback.includes('verifyKieSignature'),
      'callback/route.ts must call verifyKieSignature'
    );
  });

  it('returns 400 when verifyKieSignature returns false', () => {
    // After the verifyKieSignature call there must be a 400 branch
    const verifyIdx = callback.indexOf('verifyKieSignature');
    assert.ok(verifyIdx !== -1, 'verifyKieSignature call not found');
    const badSigReject = callback.indexOf('status: 400', verifyIdx);
    assert.ok(
      badSigReject !== -1,
      'callback/route.ts must return 400 when HMAC signature is invalid'
    );
  });

  it('returns 400 when KIE_WEBHOOK_SECRET is unset (Pitfall 1 — T-06-04)', () => {
    assert.ok(
      callback.includes('KIE_WEBHOOK_SECRET'),
      'callback/route.ts must check KIE_WEBHOOK_SECRET from env'
    );
    // There must be a guard returning 400 when secret is not set
    assert.ok(
      callback.includes('!secret') ||
        callback.includes('secret === undefined') ||
        callback.includes('!env.KIE_WEBHOOK_SECRET'),
      'callback/route.ts must 400 when KIE_WEBHOOK_SECRET is not configured'
    );
  });

  it('calls extractKieCallbackVideoUrl for dual-parse (Pitfall 8)', () => {
    assert.ok(
      callback.includes('extractKieCallbackVideoUrl'),
      'callback/route.ts must call extractKieCallbackVideoUrl'
    );
  });

  it('calls applyTerminalResult for idempotent D1 write (T-06-03)', () => {
    assert.ok(
      callback.includes('applyTerminalResult'),
      'callback/route.ts must call applyTerminalResult'
    );
  });

  it('returns 200 no-op when applyTerminalResult returns {applied:false} (VIDEO-04)', () => {
    // applied:false → return 200 immediately without re-processing
    assert.ok(
      callback.includes('applied') && callback.includes('false'),
      'callback/route.ts must check writeResult.applied'
    );
    // After the applied check there must be a return with received:true (the no-op)
    const appliedIdx = callback.indexOf('!writeResult.applied');
    const noopIdx = appliedIdx !== -1
      ? callback.indexOf('received: true', appliedIdx)
      : -1;
    assert.ok(
      noopIdx !== -1,
      'callback/route.ts must return 200 { received: true } no-op when already terminal'
    );
  });

  it('returns 200 { received: true } on success', () => {
    assert.ok(
      callback.includes('received: true'),
      'callback/route.ts must return 200 { received: true } on success'
    );
  });

  it('contains middleware-exemption comment documenting the matcher scope', () => {
    assert.ok(
      callback.includes('/dashboard/:path*') ||
        callback.includes('middleware matcher') ||
        callback.includes('middleware-exempt') ||
        callback.includes('middleware'),
      'callback/route.ts must contain a middleware-exemption comment'
    );
  });
});

// ---------------------------------------------------------------------------
// middleware.ts assertions — confirm callback route is exempt
// ---------------------------------------------------------------------------

describe('middleware.ts — callback route stays exempt', () => {
  it("matcher is ['/dashboard/:path*', '/admin/:path*'] — unchanged", () => {
    assert.ok(
      middleware.includes("'/dashboard/:path*'") &&
        middleware.includes("'/admin/:path*'"),
      "middleware.ts matcher must still cover ['/dashboard/:path*', '/admin/:path*']"
    );
  });

  it('matcher does NOT include /api/video/callback', () => {
    assert.ok(
      !middleware.includes('/api/video/callback'),
      'middleware.ts must NOT include /api/video/callback in the matcher'
    );
  });

  it('matcher does NOT include /api/* (catch-all that would gate the callback)', () => {
    assert.ok(
      !middleware.includes('/api/:path*') && !middleware.includes('/api/*'),
      'middleware.ts must NOT have a catch-all /api/* matcher'
    );
  });
});
