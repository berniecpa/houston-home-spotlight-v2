/**
 * Video Provider Tests — Plan 06-01, Task 2
 *
 * Source-grep assertions verifying:
 *   1. types.ts exports VideoProvider with submit/getStatus
 *   2. kie-adapter.ts has correct endpoint, model, duration, HMAC, dual-parse
 *   3. higgsfield-adapter.ts uses `Key ` auth (NOT Bearer) + request_id + /requests/ path
 *   4. provider.ts caps Kie.ai at 2 attempts, exports getProviderByName
 *   5. .env.local.example lists all three required secrets
 *
 * These are structural tests that do not require live provider connections.
 *
 * @module tests/video-provider
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const typesPath      = join(root, 'src/lib/video/types.ts');
const kieAdapterPath = join(root, 'src/lib/video/kie-adapter.ts');
const higgsPath      = join(root, 'src/lib/video/higgsfield-adapter.ts');
const providerPath   = join(root, 'src/lib/video/provider.ts');
const envExamplePath = join(root, '.env.local.example');

const types      = readFileSync(typesPath, 'utf-8');
const kieAdapter = readFileSync(kieAdapterPath, 'utf-8');
const higgs      = readFileSync(higgsPath, 'utf-8');
const provider   = readFileSync(providerPath, 'utf-8');
const envExample = readFileSync(envExamplePath, 'utf-8');

// ---------------------------------------------------------------------------
// types.ts assertions
// ---------------------------------------------------------------------------

describe('types.ts — VideoProvider interface', () => {
  it('exports VideoProvider interface', () => {
    assert.ok(
      types.includes('export interface VideoProvider'),
      'types.ts must export VideoProvider interface'
    );
  });

  it('VideoProvider has submit method signature', () => {
    assert.ok(
      types.includes('submit(imageUrl: string, callbackUrl: string)'),
      'VideoProvider must declare submit(imageUrl: string, callbackUrl: string): Promise<string>'
    );
  });

  it('VideoProvider has getStatus method signature', () => {
    assert.ok(
      types.includes('getStatus(taskId: string)'),
      'VideoProvider must declare getStatus(taskId: string) returning status object'
    );
  });

  it('VideoProvider getStatus returns processing | ready | failed status', () => {
    assert.ok(
      types.includes("'processing' | 'ready' | 'failed'"),
      "VideoProvider.getStatus must return { status: 'processing' | 'ready' | 'failed'; videoUrl?: string }"
    );
  });

  it('exports VideoJobRow type matching 0005 columns', () => {
    assert.ok(
      types.includes('VideoJobRow'),
      'types.ts must export VideoJobRow type'
    );
  });
});

// ---------------------------------------------------------------------------
// kie-adapter.ts assertions
// ---------------------------------------------------------------------------

describe('kie-adapter.ts — submit endpoint and model', () => {
  it('uses https://api.kie.ai/api/v1/jobs/createTask endpoint', () => {
    assert.ok(
      kieAdapter.includes('https://api.kie.ai/api/v1/jobs/createTask'),
      'kieSubmit must POST to https://api.kie.ai/api/v1/jobs/createTask'
    );
  });

  it("uses model 'kling-2.6/image-to-video'", () => {
    assert.ok(
      kieAdapter.includes("'kling-2.6/image-to-video'"),
      "kie-adapter must use model 'kling-2.6/image-to-video'"
    );
  });

  it("uses duration '5' (string, not number)", () => {
    assert.ok(
      kieAdapter.includes("duration: '5'"),
      "kie-adapter must use duration: '5' (string enum, not a number)"
    );
  });

  it('uses https://api.kie.ai/api/v1/jobs/recordInfo status endpoint', () => {
    assert.ok(
      kieAdapter.includes('api/v1/jobs/recordInfo'),
      'kieGetStatus must query https://api.kie.ai/api/v1/jobs/recordInfo?taskId='
    );
  });
});

describe('kie-adapter.ts — HMAC signature verification', () => {
  it('uses crypto.subtle for HMAC-SHA256', () => {
    assert.ok(
      kieAdapter.includes('crypto.subtle') && kieAdapter.includes('HMAC'),
      'verifyKieSignature must use crypto.subtle HMAC-SHA256 (Workers-safe, no node:crypto)'
    );
  });

  it('signs taskId.timestamp (the Kie.ai signing formula)', () => {
    assert.ok(
      kieAdapter.includes('`${taskId}.${timestamp}`'),
      'verifyKieSignature must sign `${taskId}.${timestamp}` per docs.kie.ai/common-api/webhook-verification'
    );
  });

  it('uses constant-time XOR comparison (not plain ===)', () => {
    assert.ok(
      kieAdapter.includes('diff |=') || kieAdapter.includes('diff|='),
      'verifyKieSignature must use XOR-accumulate (diff |= expected[i] ^ received[i]) for constant-time comparison'
    );
  });
});

describe('kie-adapter.ts — dual-parse callback video URL (Pitfall 8)', () => {
  it('tries data.video_url first', () => {
    assert.ok(
      kieAdapter.includes('video_url'),
      'extractKieCallbackVideoUrl must try data.video_url (Runway-style callback shape)'
    );
  });

  it('falls back to JSON.parse(data.resultJson).resultUrls[0]', () => {
    assert.ok(
      kieAdapter.includes('resultJson') && kieAdapter.includes('resultUrls'),
      'extractKieCallbackVideoUrl must fall back to JSON.parse(data.resultJson).resultUrls[0] (market-style)'
    );
  });
});

// ---------------------------------------------------------------------------
// higgsfield-adapter.ts assertions
// ---------------------------------------------------------------------------

describe('higgsfield-adapter.ts — Key auth (NOT Bearer)', () => {
  it('uses `Key ` authorization scheme', () => {
    assert.ok(
      higgs.includes('`Key ${credentials}`') || higgs.includes("Key ${"),
      'HiggsField adapter must use Authorization: Key {credentials} (Pitfall 7 — NOT Bearer)'
    );
  });

  it('does NOT use Bearer for HiggsField auth header', () => {
    // Allow the word Bearer in comments only; reject it in actual auth header usage
    const lines = higgs.split('\n');
    const hasBearer = lines.some(line => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed.includes('Bearer') && trimmed.includes('Authorization');
    });
    assert.ok(
      !hasBearer,
      'HiggsField adapter must NOT use Bearer auth in Authorization header (Pitfall 7)'
    );
  });

  it('returns request_id from submit response', () => {
    assert.ok(
      higgs.includes('request_id'),
      'HiggsField submit must return request_id (NOT taskId — different from Kie.ai)'
    );
  });

  it('polls /requests/{id}/status endpoint', () => {
    assert.ok(
      higgs.includes('/requests/'),
      'higgsGetStatus must poll https://platform.higgsfield.ai/requests/{id}/status'
    );
  });
});

// ---------------------------------------------------------------------------
// provider.ts assertions
// ---------------------------------------------------------------------------

describe('provider.ts — Kie.ai 2-attempt cap and failover', () => {
  it('caps Kie.ai at 2 attempts before HiggsField failover', () => {
    assert.ok(
      provider.includes('KIE_MAX_ATTEMPTS = 2') || provider.includes('KIE_MAX_ATTEMPTS=2'),
      'submitWithFallback must cap Kie.ai at exactly 2 attempts (VIDEO-03)'
    );
  });

  it('falls over to HiggsField after all Kie.ai attempts fail', () => {
    assert.ok(
      provider.includes('higgsfield') || provider.includes('Higgs'),
      'submitWithFallback must attempt HiggsField as fallback after Kie.ai exhaustion'
    );
  });

  it('exports getProviderByName function', () => {
    assert.ok(
      provider.includes('export function getProviderByName'),
      'provider.ts must export getProviderByName for poller/callback route use'
    );
  });

  it('returns { provider, taskId } from submitWithFallback', () => {
    assert.ok(
      provider.includes('provider:') && provider.includes('taskId:'),
      'submitWithFallback must return { provider, taskId } identifying the successful provider'
    );
  });
});

// ---------------------------------------------------------------------------
// .env.local.example assertions
// ---------------------------------------------------------------------------

describe('.env.local.example — video secrets documented', () => {
  it('lists KIE_API_KEY', () => {
    assert.ok(
      envExample.includes('KIE_API_KEY'),
      '.env.local.example must document KIE_API_KEY for the Kie.ai primary provider'
    );
  });

  it('lists KIE_WEBHOOK_SECRET', () => {
    assert.ok(
      envExample.includes('KIE_WEBHOOK_SECRET'),
      '.env.local.example must document KIE_WEBHOOK_SECRET for HMAC callback verification'
    );
  });

  it('lists HIGGSFIELD_API_KEY', () => {
    assert.ok(
      envExample.includes('HIGGSFIELD_API_KEY'),
      '.env.local.example must document HIGGSFIELD_API_KEY for the HiggsField fallback provider'
    );
  });

  it('documents wrangler secret put commands for each secret', () => {
    const kieWrangler    = envExample.includes('wrangler secret put KIE_API_KEY');
    const secretWrangler = envExample.includes('wrangler secret put KIE_WEBHOOK_SECRET');
    const higgsWrangler  = envExample.includes('wrangler secret put HIGGSFIELD_API_KEY');
    assert.ok(
      kieWrangler && secretWrangler && higgsWrangler,
      '.env.local.example must include wrangler secret put instructions for all three secrets'
    );
  });
});
