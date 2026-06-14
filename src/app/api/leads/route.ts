/**
 * Leads API Route — D1 source of truth + best-effort Resend + Perfex
 *
 * Flow when listingSlug is present (listing inquiry):
 *   1. Validate required fields + email (400 before any side effect)
 *   2. Resolve listing_id + agent_id + agent_email + address from slug via D1
 *      (never trust a body-supplied listing/agent id — T-04-11)
 *   3. INSERT into D1 leads (source of truth — LEAD-01 / LEAD-04)
 *      Only this step can return 500 (durability gate)
 *   4. Promise.allSettled([sendLeadEmail, sendToPerfex]) — best-effort; log
 *      rejections; NEVER let a side-effect failure change the 200 response
 *   5. Return 200 with leadId
 *
 * Flow when listingSlug is absent (general contact form — /contact page):
 *   - leads.listing_id is NOT NULL, so a D1 insert is impossible
 *   - Best-effort Perfex post only; return success regardless
 *   - Preserves the existing contact form behavior with no regression
 *
 * @module app/api/leads/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { LeadFormData, LeadSubmissionResponse } from '@/types';
import { sendLeadEmail, sendToPerfex } from '@/lib/leads';

/**
 * D1 row returned by the listing-lookup JOIN
 */
interface ListingLookupRow {
  id: string;
  agent_id: string;
  agent_email: string;
  address: string;
}

/**
 * POST handler for lead submission
 *
 * @param {NextRequest} request - The incoming request with lead form data
 * @returns {Promise<NextResponse<LeadSubmissionResponse>>} API response
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadSubmissionResponse>> {
  try {
    // --- 1. Parse + validate request body ---
    const body: LeadFormData = await request.json();

    const requiredFields: (keyof LeadFormData)[] = ['firstname', 'lastname', 'email', 'phonenumber'];
    const missingFields = requiredFields.filter(
      field => !body[field] || String(body[field]).trim() === ''
    );

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // --- 2. Branch on listingSlug presence ---
    const { env } = await getCloudflareContext({ async: true });

    if (body.listingSlug && body.listingSlug.trim() !== '') {
      // ── LISTING INQUIRY PATH ──────────────────────────────────────────────

      // Resolve listing_id + agent_id + agent_email + address from slug.
      // NEVER trust a body-supplied UUID — T-04-11 spoofing mitigation.
      const listingRow = await env.DB.prepare(
        `SELECT l.id, l.agent_id, a.email AS agent_email, l.address
         FROM listings l
         JOIN agents a ON l.agent_id = a.id
         WHERE l.slug = ?`
      )
        .bind(body.listingSlug.trim())
        .first<ListingLookupRow>();

      if (!listingRow) {
        return NextResponse.json(
          { success: false, message: 'Listing not found.' },
          { status: 400 }
        );
      }

      // INSERT into D1 leads — source of truth (LEAD-01).
      // Only this step is allowed to return 500 (LEAD-04 durability).
      // body.description maps to the leads.message column.
      const leadId = crypto.randomUUID();

      try {
        await env.DB.prepare(
          `INSERT INTO leads (id, listing_id, agent_id, firstname, lastname, email, phonenumber, message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            leadId,
            listingRow.id,
            listingRow.agent_id,
            body.firstname,
            body.lastname,
            body.email,
            body.phonenumber,
            body.description ?? null
          )
          .run();
      } catch (insertErr) {
        console.error('D1 leads INSERT failed:', insertErr);
        return NextResponse.json(
          {
            success: false,
            message: 'An error occurred saving your inquiry. Please try again.',
          },
          { status: 500 }
        );
      }

      // Best-effort side effects — await both, catch individually (T-04-14).
      // A failure in either MUST NOT alter the 200 success response.
      // Cast env to a loose record to access runtime secrets not in wrangler-generated types.
      const envRecord = env as unknown as Record<string, string | undefined>;
      const [emailResult, perfexResult] = await Promise.allSettled([
        sendLeadEmail({
          resendKey: envRecord['RESEND_API_KEY'] ?? '',
          fromEmail: envRecord['LEAD_FROM_EMAIL'] ?? '',
          agentEmail: listingRow.agent_email,
          adminEmail: envRecord['ADMIN_NOTIFY_EMAIL'] ?? '',
          buyerEmail: body.email,
          buyerName: `${body.firstname} ${body.lastname}`,
          listingAddress: listingRow.address,
          listingSlug: body.listingSlug.trim(),
          message: body.description ?? '',
          phonenumber: body.phonenumber,
        }),
        sendToPerfex(body, {
          PERFEX_RE_URL: envRecord['PERFEX_RE_URL'],
          PERFEX_RE_KEY: envRecord['PERFEX_RE_KEY'],
        }),
      ]);

      if (emailResult.status === 'rejected') {
        console.error('Resend best-effort failure:', emailResult.reason);
      }
      if (perfexResult.status === 'rejected') {
        console.error('Perfex best-effort failure:', perfexResult.reason);
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Thank you! Your inquiry has been submitted. We will contact you soon.',
          leadId,
        },
        { status: 200 }
      );
    } else {
      // ── GENERAL CONTACT PATH (no listingSlug) ────────────────────────────
      // leads.listing_id is NOT NULL — cannot insert a general inquiry into D1.
      // Fall back to best-effort Perfex only; preserve existing contact behavior.
      const envRec = env as unknown as Record<string, string | undefined>;
      await sendToPerfex(body, {
        PERFEX_RE_URL: envRec['PERFEX_RE_URL'],
        PERFEX_RE_KEY: envRec['PERFEX_RE_KEY'],
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Thank you! Your inquiry has been submitted. We will contact you soon.',
          leadId: `contact_${Date.now()}`,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error processing lead submission:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while processing your request. Please try again.',
      },
      { status: 500 }
    );
  }
}
