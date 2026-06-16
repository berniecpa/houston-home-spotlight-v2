/**
 * Admin Layout — Red-themed shell for /admin/* routes
 *
 * React Server Component that renders the admin shell with a visually distinct
 * red sidebar to differentiate the admin area from the agent dashboard.
 *
 * Route protection is enforced at two layers (BL-01 defense in depth):
 *   1. middleware.ts reads the admin:true Firebase custom claim and returns 403
 *      before this layout renders (T-02-17 mitigation).
 *   2. This layout ALSO calls requireAdmin() server-side as a single choke point
 *      for /admin, /admin/agents, and /admin/stats — so the admin pages never
 *      rely solely on middleware. Any matcher regression or adapter quirk that
 *      lets a non-admin request reach the RSC is still rejected here before any
 *      D1 read or PII render.
 *
 * On rejection (missing token OR missing admin claim) we call notFound() — a
 * 404 that does not reveal the existence of the /admin surface to non-admins.
 *
 * Admin Layout differences from Dashboard Layout:
 *   - Sidebar background: red-800 instead of primary-900
 *   - ADMIN badge displayed in sidebar header (red-100 text on red-700 bg)
 *   - No profile completeness gate (admin is Bernard, not an agent)
 *
 * Per UI-SPEC Admin Layout contract:
 *   - Sidebar background: red-800
 *   - ADMIN badge: red-100 text on red-700 background
 *   - Main content area: gray-50 background, p-8 padding
 *   - Structure mirrors dashboard layout
 *
 * Phase 2 delivers shell only; admin page content comes in Phase 5.
 *
 * @module app/(admin)/layout
 */

import { notFound } from 'next/navigation';
import { requireAdmin, isAdminRejection } from '@/lib/admin';
import { LogoutButton } from '@/components/auth/LogoutButton';

/**
 * Force per-request dynamic rendering on the Cloudflare Worker so the
 * requireAdmin() session check runs on every request and is never cached.
 */
export const dynamic = 'force-dynamic';

/** Props for the admin layout */
interface AdminLayoutProps {
  /** Admin page content */
  children: React.ReactNode;
}

/**
 * AdminLayout -- Red-sidebar shell for all /admin/* routes.
 *
 * Calls requireAdmin() server-side (BL-01 defense in depth) as the single
 * choke point for every admin page; rejects non-admins with notFound() before
 * any child page reads D1 or renders agent PII.
 *
 * @param props.children - Admin page content
 * @returns {Promise<JSX.Element>} Admin shell with red sidebar
 */
export default async function AdminLayout({
  children,
}: AdminLayoutProps): Promise<JSX.Element> {
  // BL-01: re-verify the admin claim server-side. Do NOT rely solely on
  // middleware — a matcher regression or adapter quirk must not expose agent
  // PII / platform stats to any authenticated non-admin.
  const adminResult = await requireAdmin();
  if (isAdminRejection(adminResult)) {
    // 404 (not 403) so we never reveal the /admin surface to non-admins.
    notFound();
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Red sidebar -- visually distinct from agent dashboard (primary-900) */}
      <aside
        className="w-64 bg-red-800 text-white flex flex-col flex-shrink-0"
        aria-label="Admin navigation"
      >
        {/* Sidebar header with site name and ADMIN badge */}
        <div className="p-6 border-b border-red-700">
          <div className="flex flex-col gap-2">
            <span className="font-serif font-semibold text-lg leading-tight text-white">
              Houston Home Spotlight
            </span>
            {/* ADMIN badge: red-100 text on red-700 background per UI-SPEC */}
            <span className="inline-flex items-center self-start px-2 py-0.5 rounded text-xs font-semibold bg-red-700 text-red-100">
              ADMIN
            </span>
          </div>
        </div>

        {/* Sidebar navigation */}
        <nav className="flex-1 p-4" aria-label="Admin menu">
          <ul className="space-y-1">
            <li>
              <a
                href="/admin"
                className="flex items-center px-4 py-3 rounded-lg text-red-100 hover:bg-red-700 hover:text-white transition-colors touch-target"
                aria-label="Admin panel home"
              >
                Admin Panel
              </a>
            </li>
            <li>
              <a
                href="/admin/agents"
                className="flex items-center px-4 py-3 rounded-lg text-red-100 hover:bg-red-700 hover:text-white transition-colors touch-target"
                aria-label="Manage agents"
              >
                Agents
              </a>
            </li>
            <li>
              <a
                href="/admin/stats"
                className="flex items-center px-4 py-3 rounded-lg text-red-100 hover:bg-red-700 hover:text-white transition-colors touch-target"
                aria-label="Platform stats"
              >
                Platform Stats
              </a>
            </li>
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-red-700 space-y-3">
          <LogoutButton className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-red-100 bg-red-900/40 hover:bg-red-700 hover:text-white transition-colors touch-target disabled:opacity-60 disabled:cursor-not-allowed" />
          <p className="text-xs text-red-300 text-center">
            Platform Administration
          </p>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
