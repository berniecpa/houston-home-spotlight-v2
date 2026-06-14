/**
 * video-ui.test.ts — source-grep tests for 06-04 UI implementation
 *
 * Validates that ListingsManager.tsx and the public listing detail page
 * contain the required video UI patterns:
 *   - Generate Video button with correct aria-label
 *   - POST to /video trigger endpoint
 *   - 409 conflict handling (adopt in-flight job)
 *   - Polling loop against /video-status
 *   - clearInterval on terminal state / unmount
 *   - Exact "Generation failed — retrying" text (VIDEO-03)
 *   - aria-live="polite" for the status live region
 *   - Native <video> element on the public detail page
 *   - Placeholder "Video tour coming soon" removed
 *
 * @module tests/video-ui
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'src');

function readSrc(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// ListingsManager — Generate Video button + polling
// ---------------------------------------------------------------------------
describe('ListingsManager.tsx — Generate Video button', () => {
  const src = readSrc('components/dashboard/ListingsManager.tsx');

  it('exports OwnListing interface with optional video_status', () => {
    assert.match(src, /video_status\?:\s*['"]none['"]/);
  });

  it('exports OwnListing interface with optional video_url', () => {
    assert.match(src, /video_url\?:\s*string\s*\|\s*null/);
  });

  it('renders a Generate Video button with aria-label containing "Generate video"', () => {
    assert.match(src, /aria-label=\{`Generate video for/);
  });

  it('POSTs to the /video trigger endpoint', () => {
    assert.match(src, /\/api\/agent\/listings\/\$\{.*\}\/video[`'"]/);
  });

  it('sends POST method to the trigger route', () => {
    assert.match(src, /method:\s*['"]POST['"]/);
  });

  it('handles 202 Accepted by starting polling', () => {
    assert.match(src, /res\.status\s*===\s*202/);
    assert.match(src, /startPolling/);
  });

  it('handles 409 Conflict by adopting the in-flight job and starting polling', () => {
    assert.match(src, /res\.status\s*===\s*409/);
    // After the 409 branch, startPolling is called (same as 202)
    const post409Index = src.indexOf('res.status === 409');
    const post409Section = src.slice(post409Index, post409Index + 300);
    assert.match(post409Section, /startPolling/);
  });

  it('polls /video-status endpoint on an interval', () => {
    assert.match(src, /\/api\/agent\/listings\/\$\{.*\}\/video-status/);
    assert.match(src, /setInterval/);
  });

  it('stops polling on ready terminal state', () => {
    assert.match(src, /status\s*===\s*['"]ready['"]/);
    assert.match(src, /clearPoll|clearInterval/);
  });

  it('stops polling on failed terminal state', () => {
    assert.match(src, /status\s*===\s*['"]failed['"]/);
  });

  it('clears all intervals on unmount (clearInterval present)', () => {
    assert.match(src, /clearInterval/);
  });

  it('enforces a hard poll cap (~5 minutes)', () => {
    assert.match(src, /POLL_MAX_MS/);
    assert.match(src, /5\s*\*\s*60\s*\*\s*1000/);
  });

  it('renders exact "Generation failed — retrying" text (VIDEO-03)', () => {
    assert.match(src, /Generation failed — retrying/);
  });

  it('uses aria-live="polite" for the video status live region', () => {
    assert.match(src, /aria-live="polite"/);
  });

  it('uses role="status" for the video status region', () => {
    assert.match(src, /role="status"/);
  });

  it('renders "Generating…" text while processing', () => {
    assert.match(src, /Generating…/);
  });

  it('renders "View video" affordance when ready', () => {
    assert.match(src, /View video/);
  });

  it('button is disabled while processing', () => {
    assert.match(src, /disabled=\{isProcessing\}/);
  });

  it('initialises videoStates from server-loaded video_status (W1 — persisted state on load)', () => {
    assert.match(src, /l\.video_status/);
    assert.match(src, /l\.video_url/);
  });

  it('resumes polling on mount for listings already in processing state', () => {
    assert.match(src, /vs\.status\s*===\s*['"]processing['"]/);
    assert.match(src, /startPolling/);
  });
});

// ---------------------------------------------------------------------------
// Dashboard listings page — W1 SELECT fix
// ---------------------------------------------------------------------------
describe('dashboard/listings/page.tsx — W1 SELECT includes video columns', () => {
  const src = readSrc('app/(dashboard)/dashboard/listings/page.tsx');

  it('selects video_status column from D1', () => {
    assert.match(src, /video_status/);
  });

  it('selects video_url column from D1', () => {
    assert.match(src, /video_url/);
  });
});

// ---------------------------------------------------------------------------
// Public listing detail page — native <video> render
// ---------------------------------------------------------------------------
describe('listings/[slug]/page.tsx — native video render', () => {
  const src = readSrc('app/listings/[slug]/page.tsx');

  it('renders a <video element when videoUrl is present', () => {
    assert.match(src, /<video/);
  });

  it('includes controls attribute on the video element', () => {
    assert.match(src, /controls/);
  });

  it('binds src to listing.videoUrl', () => {
    assert.match(src, /src=\{listing\.videoUrl\}/);
  });

  it('no longer contains the placeholder "Video tour coming soon"', () => {
    assert.doesNotMatch(src, /Video tour coming soon/);
  });

  it('preserves the "Video Tour" section heading', () => {
    assert.match(src, /Video Tour/);
  });

  it('includes a fallback text child for browsers without video support', () => {
    assert.match(src, /<\/video>/);
    // Fallback text is between <video...> and </video>
    const videoBlock = src.slice(src.indexOf('<video'), src.indexOf('</video>') + 8);
    // Must have some text between the tags beyond just the src
    assert.ok(videoBlock.length > 50, 'video block should contain fallback text');
  });

  it('includes an aria-label on the video element referencing the listing', () => {
    assert.match(src, /aria-label/);
  });
});
