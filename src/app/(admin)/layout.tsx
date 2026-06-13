/**
 * Admin Layout — Red-themed shell for /admin/* routes
 *
 * React Server Component that renders the admin shell with a visually distinct
 * red sidebar to differentiate the admin area from the agent dashboard.
 *
 * Route protection is enforced upstream by middleware.ts — the middleware reads
 * the admin:true Firebase custom claim and returns 403 before this layout renders
 * for any token without the claim (T-02-17 mitigation). This layout does not
 * need to re-implement that gate; middleware is the single enforcement point.
 *
 * Admin Layout differences from Dashboard Layout:
 *   - Sidebar background: red-800 instead of primary-900
 *   - ADMIN badge displayed in sidebar header (red-100 text on red-700 bg)
 *   - No profile completeness gate (admin is Bernard, not an agent)
 *   - No D1 query required -- middleware already confirmed the admin claim
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

/** Props for the admin layout */
interface AdminLayoutProps {
  /** Admin page content */
  children: React.ReactNode;
}

/**
 * AdminLayout -- Red-sidebar shell for all /admin/* routes.
 *
 * Middleware enforces admin claim before this renders.
 * Phase 2: shell structure only; Phase 5 fills admin page content.
 *
 * @param props.children - Admin page content
 * @returns {JSX.Element} Admin shell with red sidebar
 */
export default function AdminLayout({ children }: AdminLayoutProps): JSX.Element {
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

        {/* Sidebar navigation -- Phase 5 fills additional nav items */}
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
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-red-700">
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
