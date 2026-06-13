/**
 * Admin Panel Page -- /admin
 *
 * React Server Component shell for the admin area. Protected by middleware.ts
 * (admin claim check) before this page ever renders. Phase 5 will fill this
 * page with actual admin tools (listing moderation, agent management, etc.).
 *
 * Per UI-SPEC /admin page specification:
 *   - Heading: "Admin Panel" (24px Merriweather semibold)
 *   - Body: "Admin tools coming in Phase 5." (16px text-gray-400 centered)
 *   - Red sidebar + ADMIN badge rendered by the parent (admin)/layout.tsx
 *
 * @module app/(admin)/admin/page
 */

import type { Metadata } from 'next';

/** Next.js page metadata */
export const metadata: Metadata = {
  title: 'Admin Panel | Houston Home Spotlight',
  // Prevent search engines from indexing the admin panel
  robots: { index: false, follow: false },
};

/**
 * AdminPage -- Shell for the /admin route.
 *
 * Route is guarded by middleware (admin custom claim required).
 * Content is deferred to Phase 5.
 *
 * @returns {JSX.Element} Admin panel shell
 */
export default function AdminPage(): JSX.Element {
  return (
    <div className="max-w-4xl">
      {/* Page heading -- 24px Merriweather semibold per UI-SPEC */}
      <h1 className="font-serif text-2xl font-semibold text-gray-900 mb-4">
        Admin Panel
      </h1>

      {/* Phase 5 placeholder body -- text-gray-400 centered per UI-SPEC */}
      <div className="flex items-center justify-center py-16">
        <p className="text-base text-gray-400 text-center">
          Admin tools coming in Phase 5.
        </p>
      </div>
    </div>
  );
}
