/**
 * Dashboard Lead Inbox — per-agent D1 read table
 *
 * React Server Component that reads the signed-in agent's own leads from D1
 * and renders them in a table (LEAD-05). Scope is enforced by
 * `WHERE agent_id = ?` bound to the session uid — an agent can never see
 * another agent's leads (T-04-12).
 *
 * Auth: session derived from getTokens() via the parent DashboardLayout;
 * the layout already gates unauthenticated requests, but we re-derive uid
 * here so this page cannot be rendered without a valid session even if the
 * layout gate changes.
 *
 * No client state needed — this page is read-only.
 *
 * @module app/(dashboard)/dashboard/leads/page
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';

/**
 * Force per-request rendering so D1 reads reflect the latest data.
 * Do NOT add runtime='edge' on this page — @opennextjs/cloudflare ignores it
 * and it can cause confusion (plan-checker W3).
 */
export const dynamic = 'force-dynamic';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Leads — Houston Home Spotlight',
};

/** Shape of each row returned by the leads SELECT */
interface LeadRow {
  firstname: string;
  lastname: string;
  email: string;
  phonenumber: string;
  message: string | null;
  created_at: number;
}

/**
 * Format epoch seconds to a locale date string.
 * created_at is stored as INTEGER epoch seconds in D1.
 *
 * @param epochSeconds - Unix timestamp in seconds
 * @returns Formatted date string, e.g. "Jun 13, 2026"
 */
function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * LeadsPage — Agent lead inbox RSC for /dashboard/leads.
 *
 * Reads the agent's own leads scoped by agent_id = session uid.
 * Renders a responsive table with columns: Name, Email, Phone, Message, Date.
 * Renders an empty-state row when the agent has no leads yet.
 *
 * @returns {Promise<JSX.Element>} Lead inbox page
 */
export default async function LeadsPage(): Promise<JSX.Element> {
  // --- Session gate: derive uid from verified session cookie ---
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  if (!tokens) {
    redirect('/login?redirect=/dashboard/leads');
  }

  const uid = tokens.decodedToken.uid;

  // --- Query agent's own leads from D1 (LEAD-05, T-04-12) ---
  let leads: LeadRow[] = [];
  let dbError = false;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const result = await env.DB.prepare(
      `SELECT firstname, lastname, email, phonenumber, message, created_at
       FROM leads
       WHERE agent_id = ?
       ORDER BY created_at DESC`
    )
      .bind(uid)
      .all<LeadRow>();

    leads = result.results;
  } catch (err) {
    console.error('LeadsPage: D1 read error', err);
    dbError = true;
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900">
          Leads
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Buyer inquiries submitted for your listings.
        </p>
      </div>

      {/* DB error banner */}
      {dbError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load leads at this time. Please refresh the page.
        </div>
      )}

      {/* Leads table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Phone
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Message
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {leads.length === 0 && !dbError ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No leads yet. When buyers inquire on your listings, they will appear here.
                  </td>
                </tr>
              ) : (
                leads.map((lead, idx) => (
                  <tr
                    key={idx}
                    className="transition-colors hover:bg-gray-50"
                  >
                    {/* Name */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {lead.firstname} {lead.lastname}
                    </td>

                    {/* Email — mailto link */}
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {lead.email}
                      </a>
                    </td>

                    {/* Phone — tel link */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <a
                        href={`tel:${lead.phonenumber}`}
                        className="text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {lead.phonenumber}
                      </a>
                    </td>

                    {/* Message */}
                    <td className="max-w-xs px-6 py-4 text-sm text-gray-600">
                      <p className="line-clamp-2">
                        {lead.message ?? <span className="italic text-gray-400">No message</span>}
                      </p>
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
