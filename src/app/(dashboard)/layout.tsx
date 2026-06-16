/**
 * Dashboard Layout — Session + Profile Completeness Gate + Suspension Banner
 *
 * React Server Component that gates all /dashboard/* routes:
 *
 * 1. Session gate: calls getTokens() to read the __session HttpOnly cookie.
 *    No token → redirect to /login?redirect=/dashboard (T-02-15 mitigation).
 *
 * 2. Profile gate (AUTH-05): reads the four profile fields from D1 agents row.
 *    Incomplete profile AND NOT already on /dashboard/profile
 *    → redirect to /dashboard/profile (Pitfall 4: avoid redirect loop).
 *
 * 3. Suspension banner (ADMIN-02, T-05-03): when is_suspended=1, renders a
 *    visible "Account suspended" read-only banner above {children}.
 *    Server-side 403s in the mutation routes are the real enforcement;
 *    the banner is advisory (informs the agent why actions are blocked).
 *
 * 4. Renders the dashboard shell: DashboardSidebar (left) + main content (right).
 *    No public Header or Footer — standalone agent app shell per CONTEXT.md.
 *
 * PATHNAME DETECTION (Pitfall 4, Assumption A7):
 *   x-invoke-path may be unreliable in the OpenNext adapter. We use the
 *   x-matched-path header which Next.js consistently sets in RSC layout renders.
 *   Falls back to checking headers().get('next-url') as secondary option.
 *   The guard checks that the path STARTS WITH '/dashboard/profile' to safely
 *   catch /dashboard/profile and any future sub-routes.
 *
 * @module app/(dashboard)/layout
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { isProfileComplete } from '@/lib/profile';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { LogoutButton } from '@/components/auth/LogoutButton';

/**
 * Force per-request dynamic rendering on the Cloudflare Worker (CR-02).
 * Without this, this cookie- and D1-reading segment can be evaluated
 * outside the worker binding context, making the fail-open path reachable.
 *
 * No `runtime = 'edge'`: @opennextjs/cloudflare runs pages on the Node.js
 * runtime (workerd) and rejects edge-runtime pages.
 */
export const dynamic = 'force-dynamic';

/** Agent profile fields read from D1 for the completeness gate and suspension check */
interface AgentGateRow {
  display_name: string | null;
  photo_url: string | null;
  phone: string | null;
  brokerage: string | null;
  license_number: string | null;
  /** 1 when the agent is suspended by the admin; 0 otherwise (ADMIN-02) */
  is_suspended: number | null;
}

/** Props for the dashboard layout */
interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * DashboardLayout — RSC session + profile gate + sidebar shell.
 *
 * Runs on every render of any /dashboard/* route. Must stay under 500 lines.
 *
 * @param props.children - Dashboard page content
 * @returns {Promise<JSX.Element>} Dashboard shell or redirect
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<JSX.Element> {
  // --- 1. Session gate ---
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  if (!tokens) {
    redirect('/login?redirect=/dashboard');
  }

  const uid = tokens.decodedToken.uid;

  // --- 2. Read agent profile from D1 ---
  let agent: AgentGateRow | null = null;
  // CR-02: a thrown D1 read must NOT be treated as "profile incomplete".
  // We cannot determine completeness, so the gate fails CLOSED — deny the
  // dashboard and hold the user on the profile route instead of rendering.
  let readFailed = false;

  try {
    const { env } = await getCloudflareContext({ async: true });
    agent = await env.DB.prepare(
      `SELECT display_name, photo_url, phone, brokerage, license_number, is_suspended
       FROM agents WHERE id = ?`
    )
      .bind(uid)
      .first<AgentGateRow>();
  } catch (err) {
    // The read threw (binding unavailable, D1 outage). We cannot prove the
    // profile is complete, so fail closed rather than rendering the gated app.
    console.error('DashboardLayout: D1 profile read error', err);
    readFailed = true;
  }

  const profileComplete = !readFailed && agent ? isProfileComplete(agent) : false;

  // Derive suspension state from D1 (ADMIN-02 / T-05-03).
  // When the D1 read failed we cannot know suspension state — fail toward NOT
  // blocking the agent further (is_suspended defaults to 0 on fail-read).
  const isSuspended = !readFailed && agent ? agent.is_suspended === 1 : false;

  // --- 3. Profile gate (AUTH-05) — prevent redirect loop on /dashboard/profile ---
  // Determine current pathname from request headers.
  // x-matched-path is set by Next.js App Router for every RSC render.
  // Falls back to next-url (set by middleware) as secondary option.
  // Pitfall 4: always skip the redirect when already on the profile route.
  const headersList = await headers();
  const matchedPath =
    headersList.get('x-matched-path') ??
    headersList.get('next-url') ??
    headersList.get('x-invoke-path') ??
    null;

  // WR-01: these headers are adapter-dependent and may be absent. When the
  // current path is undeterminable, fail TOWARD showing the profile form
  // (onProfilePage = true) so an incomplete agent is never redirect-looped to
  // /dashboard/profile. A known non-profile path still triggers the gate.
  const onProfilePage =
    matchedPath === null || matchedPath.startsWith('/dashboard/profile');

  if (!profileComplete && !onProfilePage) {
    redirect('/dashboard/profile');
  }

  // --- 4. Render dashboard shell ---
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardSidebar isProfileComplete={profileComplete} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isSuspended && (
          <div
            role="alert"
            aria-live="polite"
            className="bg-red-600 text-white text-sm font-medium px-6 py-3 flex items-center gap-2 shrink-0"
          >
            <span aria-hidden="true">&#9888;</span>
            <span>
              Account suspended — contact the administrator. Your listings are
              hidden from public view and listing actions are disabled.
            </span>
          </div>
        )}
        <header className="flex items-center justify-end border-b border-gray-200 bg-white px-6 h-14 flex-shrink-0">
          <LogoutButton className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
        </header>
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
