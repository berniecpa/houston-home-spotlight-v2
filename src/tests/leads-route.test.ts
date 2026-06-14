/**
 * Leads Route Tests — Plan 04-04
 *
 * Source-grep style assertions verifying:
 * - D1 INSERT as source of truth (LEAD-01)
 * - sendLeadEmail + sendToPerfex imported from lib/leads (LEAD-02, LEAD-03)
 * - Promise.allSettled best-effort pattern (LEAD-04)
 * - Listing/agent resolved from slug, never from body UUID (T-04-11 spoofing guard)
 * - General contact (no-slug) branch preserved (no regression on /contact)
 * - Dashboard lead inbox scoped by agent_id = session uid (LEAD-05, T-04-12)
 *
 * @module tests/leads-route
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROUTE_PATH = join(process.cwd(), 'src/app/api/leads/route.ts');
const LEADS_LIB_PATH = join(process.cwd(), 'src/lib/leads.ts');
const INBOX_PAGE_PATH = join(process.cwd(), 'src/app/(dashboard)/dashboard/leads/page.tsx');

describe('Leads Route — D1 + best-effort side effects (04-04)', () => {
  describe('File structure', () => {
    it('route.ts exists', () => {
      assert.strictEqual(existsSync(ROUTE_PATH), true, 'route.ts must exist');
    });

    it('leads.ts helper module exists', () => {
      assert.strictEqual(existsSync(LEADS_LIB_PATH), true, 'src/lib/leads.ts must exist');
    });

    it('dashboard leads inbox page exists', () => {
      assert.strictEqual(existsSync(INBOX_PAGE_PATH), true, 'dashboard leads page must exist');
    });
  });

  describe('Route imports', () => {
    it('imports sendLeadEmail from lib/leads', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('sendLeadEmail') && content.includes('@/lib/leads'),
        'Should import sendLeadEmail from @/lib/leads'
      );
    });

    it('imports sendToPerfex from lib/leads', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('sendToPerfex') && content.includes('@/lib/leads'),
        'Should import sendToPerfex from @/lib/leads'
      );
    });

    it('exports POST handler', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(content.includes('export async function POST'), 'Should export POST async function');
    });
  });

  describe('D1 source of truth (LEAD-01)', () => {
    it('contains INSERT INTO leads statement', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('INSERT INTO leads'),
        'Route must INSERT into leads table (D1 source of truth — LEAD-01)'
      );
    });

    it('generates leadId via crypto.randomUUID()', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('crypto.randomUUID()'),
        'leadId must be generated server-side via crypto.randomUUID()'
      );
    });

    it('returns leadId in success response', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(content.includes('leadId,') || content.includes('leadId:'), 'Should return leadId in response');
    });
  });

  describe('Slug-to-listing resolution (T-04-11 spoofing guard)', () => {
    it('resolves listing_id from slug via D1 JOIN — not from request body', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('FROM listings l') && content.includes('JOIN agents a ON') && content.includes('WHERE l.slug = ?'),
        'Must resolve listing via slug JOIN — never trust a body-supplied listing id'
      );
    });

    it('uses .bind() for parameterized slug query (T-04-15)', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('.bind(') && content.includes('listingSlug'),
        'Slug query must use parameterized .bind() — no string concatenation'
      );
    });

    it('returns 400 when listing slug has no matching row', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('Listing not found') && content.includes('status: 400'),
        'Should return 400 when slug resolves to no listing'
      );
    });
  });

  describe('Best-effort side effects via Promise.allSettled (LEAD-04)', () => {
    it('uses Promise.allSettled for side effects', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('Promise.allSettled'),
        'Must use Promise.allSettled to run sendLeadEmail + sendToPerfex best-effort'
      );
    });

    it('logs rejected email result without throwing', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('emailResult.status') && content.includes('rejected'),
        "Must check emailResult.status === 'rejected' and log without re-throwing"
      );
    });

    it('logs rejected perfex result without throwing', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('perfexResult.status') && content.includes('rejected'),
        "Must check perfexResult.status === 'rejected' and log without re-throwing"
      );
    });

    it('D1 INSERT is the only operation that can return 500', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('D1 leads INSERT failed') && content.includes('status: 500'),
        'Only D1 INSERT failure should produce a 500 response (LEAD-04 durability)'
      );
    });
  });

  describe('General contact path — no listingSlug (no regression)', () => {
    it('handles absent listingSlug without D1 insert', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      assert.ok(
        content.includes('GENERAL CONTACT PATH') || content.includes('no listingSlug'),
        'Must have a branch for absent listingSlug (general contact form — no D1 insert)'
      );
    });

    it('still returns success on general contact path', () => {
      const content = readFileSync(ROUTE_PATH, 'utf-8');
      const generalBlock = content.indexOf('GENERAL CONTACT PATH');
      assert.ok(
        content.slice(generalBlock).includes('success: true'),
        'General contact path must return success: true'
      );
    });
  });

  describe('leads.ts helper module', () => {
    it('exports sendLeadEmail', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('export async function sendLeadEmail'),
        'leads.ts must export sendLeadEmail'
      );
    });

    it('exports sendToPerfex', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('export async function sendToPerfex'),
        'leads.ts must export sendToPerfex'
      );
    });

    it('sendLeadEmail uses raw fetch to Resend REST API', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('https://api.resend.com/emails') && content.includes('fetch('),
        'sendLeadEmail must use raw fetch to https://api.resend.com/emails (no SDK)'
      );
    });

    it('sendLeadEmail sets reply_to to buyer email', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('reply_to') && content.includes('buyerEmail'),
        'sendLeadEmail must set reply_to = buyerEmail so agent can reply to buyer'
      );
    });

    it('sendLeadEmail CCs adminEmail (Bernard)', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('cc') && content.includes('adminEmail'),
        'sendLeadEmail must cc adminEmail (Bernard CC — LEAD-03)'
      );
    });

    it('sendLeadEmail does not throw on non-2xx (T-04-14)', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('console.error') && content.includes('Resend delivery failed'),
        'sendLeadEmail must log non-2xx and not throw (best-effort for allSettled)'
      );
    });

    it('sendToPerfex calls Perfex /api/v1/leads', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('/api/v1/leads') && content.includes('authtoken'),
        'sendToPerfex must POST to Perfex /api/v1/leads with authtoken header'
      );
    });

    it('sendToPerfex does not throw on error (T-04-14)', () => {
      const content = readFileSync(LEADS_LIB_PATH, 'utf-8');
      assert.ok(
        content.includes('sendToPerfex error') && content.includes('console.error'),
        'sendToPerfex must catch and log errors without re-throwing'
      );
    });
  });

  describe('Dashboard lead inbox page — per-agent D1 read (LEAD-05)', () => {
    it('scopes query by agent_id = session uid (T-04-12 — no cross-agent visibility)', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('agent_id'),
        'Inbox page must scope D1 query by agent_id (LEAD-05 — own leads only)'
      );
    });

    it('uses force-dynamic (not runtime=edge on page — plan-checker W3)', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('force-dynamic'),
        "Inbox page must export const dynamic = 'force-dynamic'"
      );
    });

    it('renders Name column', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('Name') || (content.includes('firstname') && content.includes('lastname')),
        'Inbox table must render buyer name (firstname + lastname)'
      );
    });

    it('renders Email column', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(content.includes('Email') || content.includes('email'), 'Inbox table must render email column');
    });

    it('renders Phone column', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('Phone') || content.includes('phonenumber'),
        'Inbox table must render phone column'
      );
    });

    it('renders Message column', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(content.includes('Message') || content.includes('message'), 'Inbox table must render message column');
    });

    it('renders Date column', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(content.includes('Date') || content.includes('created_at'), 'Inbox table must render date column');
    });

    it('has empty-state for agents with no leads', () => {
      const content = readFileSync(INBOX_PAGE_PATH, 'utf-8');
      assert.ok(
        content.includes('No leads') || content.includes('no leads') || content.includes('No inquiries'),
        'Inbox page must render empty state when agent has no leads'
      );
    });
  });
});
