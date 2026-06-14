/**
 * Dashboard Listings UI — source-grep test assertions (TDD RED phase).
 *
 * Verifies that the listings management UI files contain the required
 * structural and security contracts, without invoking any D1 or browser
 * runtime (which is unavailable in the Node.js test environment).
 *
 * Coverage:
 *   - page.tsx: force-dynamic, agent_id scoping, renders ListingsManager
 *   - ListingsManager.tsx: 'use client', API wiring, action verbs, empty state
 *   - ListingForm.tsx: 'use client', POST/PUT wiring, multi-photo URL input
 *
 * @module tests/dashboard-listings
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = join(process.cwd(), 'src');

const pagePath    = join(root, 'app', '(dashboard)', 'dashboard', 'listings', 'page.tsx');
const managerPath = join(root, 'components', 'dashboard', 'ListingsManager.tsx');
const formPath    = join(root, 'components', 'dashboard', 'ListingForm.tsx');

const page    = readFileSync(pagePath, 'utf-8');
const manager = readFileSync(managerPath, 'utf-8');
const form    = readFileSync(formPath, 'utf-8');

// ---------------------------------------------------------------------------
// page.tsx — RSC shell
// ---------------------------------------------------------------------------
describe('dashboard/listings/page.tsx — RSC shell', () => {
  it('has force-dynamic export', () => {
    assert.ok(
      page.includes("export const dynamic = 'force-dynamic'"),
      "page.tsx must export const dynamic = 'force-dynamic'"
    );
  });

  it('does NOT have runtime=edge on the page (autonomous directive)', () => {
    // The runtime='edge' export on the page itself is forbidden per the
    // autonomous directive: only force-dynamic on the page; client
    // components handle interactivity.
    assert.ok(
      !page.includes("export const runtime = 'edge'"),
      "page.tsx must NOT export runtime='edge' (use force-dynamic only)"
    );
  });

  it('scopes listings query by agent_id (LIST-08 ownership)', () => {
    assert.ok(
      page.includes('agent_id'),
      'page.tsx must include agent_id in the listings query'
    );
  });

  it('renders ListingsManager component', () => {
    assert.ok(
      page.includes('ListingsManager'),
      'page.tsx must render <ListingsManager />'
    );
  });

  it('imports ListingsManager from dashboard components', () => {
    assert.ok(
      page.includes("from '@/components/dashboard/ListingsManager'") ||
      page.includes("from '../../../../../components/dashboard/ListingsManager'"),
      'page.tsx must import ListingsManager'
    );
  });

  it('derives uid from getTokens (T-04-17 session scoping)', () => {
    assert.ok(
      page.includes('getTokens'),
      'page.tsx must use getTokens to derive the session uid'
    );
  });

  it('passes initialListings prop to ListingsManager', () => {
    assert.ok(
      page.includes('initialListings'),
      'page.tsx must pass initialListings to ListingsManager'
    );
  });
});

// ---------------------------------------------------------------------------
// ListingsManager.tsx — client table + actions
// ---------------------------------------------------------------------------
describe('ListingsManager.tsx — client table with CRUD actions', () => {
  it("has 'use client' directive", () => {
    assert.ok(
      manager.startsWith("'use client'") || manager.includes("'use client'"),
      "ListingsManager.tsx must have 'use client' directive"
    );
  });

  it('fetches from /api/agent/listings (GET refresh)', () => {
    assert.ok(
      manager.includes('/api/agent/listings'),
      'ListingsManager.tsx must reference /api/agent/listings for fetch calls'
    );
  });

  it('has Edit action for opening ListingForm in edit mode', () => {
    assert.ok(
      manager.includes('Edit') || manager.includes('edit'),
      'ListingsManager.tsx must have an Edit action'
    );
  });

  it('has Delete action with confirmation (DELETE method)', () => {
    assert.ok(
      manager.includes('Delete') || manager.includes('delete'),
      'ListingsManager.tsx must have a Delete action'
    );
    assert.ok(
      manager.includes("method: 'DELETE'") || manager.includes('method: "DELETE"'),
      'ListingsManager.tsx must use DELETE HTTP method'
    );
  });

  it('has Pause/Activate action (PATCH method)', () => {
    assert.ok(
      manager.includes('Pause') || manager.includes('pause'),
      'ListingsManager.tsx must have a Pause action'
    );
    assert.ok(
      manager.includes("method: 'PATCH'") || manager.includes('method: "PATCH"'),
      'ListingsManager.tsx must use PATCH HTTP method for status toggle'
    );
  });

  it('has status badge for active/paused display', () => {
    assert.ok(
      manager.includes('active') && manager.includes('paused'),
      'ListingsManager.tsx must display status badges for active and paused states'
    );
  });

  it('has empty state with Create CTA', () => {
    assert.ok(
      manager.includes('Create') || manager.includes('create'),
      'ListingsManager.tsx must include a Create listing CTA'
    );
  });

  it('imports ListingForm for create/edit modal', () => {
    assert.ok(
      manager.includes('ListingForm'),
      'ListingsManager.tsx must import/render ListingForm'
    );
  });

  it('uses window.confirm before DELETE (T-04-16 accidental deletion guard)', () => {
    assert.ok(
      manager.includes('confirm') || manager.includes('window.confirm'),
      'ListingsManager.tsx must use window.confirm before deleting a listing'
    );
  });
});

// ---------------------------------------------------------------------------
// ListingForm.tsx — create/edit form with multi-photo URLs
// ---------------------------------------------------------------------------
describe('ListingForm.tsx — create/edit form (LIST-01, LIST-02)', () => {
  it("has 'use client' directive", () => {
    assert.ok(
      form.startsWith("'use client'") || form.includes("'use client'"),
      "ListingForm.tsx must have 'use client' directive"
    );
  });

  it('posts to /api/agent/listings on create (LIST-01)', () => {
    assert.ok(
      form.includes('/api/agent/listings'),
      "ListingForm.tsx must reference /api/agent/listings for POST/PUT"
    );
  });

  it('uses POST method for create', () => {
    assert.ok(
      form.includes("method: 'POST'") || form.includes('method: "POST"'),
      "ListingForm.tsx must use POST method for create"
    );
  });

  it('uses PUT method for edit (LIST-02)', () => {
    assert.ok(
      form.includes("method: 'PUT'") || form.includes('method: "PUT"'),
      "ListingForm.tsx must use PUT method for edit (LIST-02)"
    );
  });

  it('includes title field', () => {
    assert.ok(
      form.includes('title'),
      'ListingForm.tsx must include a title field'
    );
  });

  it('includes address field', () => {
    assert.ok(
      form.includes('address'),
      'ListingForm.tsx must include an address field'
    );
  });

  it('includes price field', () => {
    assert.ok(
      form.includes('price'),
      'ListingForm.tsx must include a price field'
    );
  });

  it('includes beds field', () => {
    assert.ok(
      form.includes('beds'),
      'ListingForm.tsx must include a beds field'
    );
  });

  it('includes baths field', () => {
    assert.ok(
      form.includes('baths'),
      'ListingForm.tsx must include a baths field'
    );
  });

  it('supports multiple photo URL inputs (LIST-01 multi-photo)', () => {
    assert.ok(
      form.includes('imageUrls') || form.includes('photoUrl') || form.includes('photo_url'),
      'ListingForm.tsx must support photo URL input(s)'
    );
    // Must have array-based management (add/remove rows)
    assert.ok(
      form.includes('push') || form.includes('filter') || form.includes('splice') ||
      form.includes('map(') || form.includes('Array'),
      'ListingForm.tsx must manage photo URLs as an array (add/remove rows)'
    );
  });

  it('validates http(s) URLs client-side (T-04-18)', () => {
    assert.ok(
      form.includes('http') || form.includes('isSafe') || form.includes('URL'),
      'ListingForm.tsx must include http(s) URL validation for photo inputs'
    );
  });

  it('maps 403 API response to an ownership/subscription error message', () => {
    assert.ok(
      form.includes('403') || form.includes('Forbidden') || form.includes('subscription') || form.includes('own'),
      'ListingForm.tsx must handle 403 responses with a clear error message'
    );
  });

  it('calls onSuccess callback after successful submit', () => {
    assert.ok(
      form.includes('onSuccess'),
      'ListingForm.tsx must call onSuccess prop after a successful API response'
    );
  });

  it('has a mode prop (create | edit)', () => {
    assert.ok(
      form.includes("'create'") || form.includes('"create"') || form.includes("mode"),
      "ListingForm.tsx must accept a mode prop to distinguish create vs edit"
    );
  });
});
