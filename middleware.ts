/**
 * Next.js Middleware — Firebase Auth session verification
 *
 * Runs at the edge before protected route renders. Uses next-firebase-auth-edge
 * authMiddleware to verify the __session HttpOnly cookie on every request to
 * /dashboard/* and /admin/*.
 *
 * Matcher scope: only /dashboard/:path* and /admin/:path* — never catch-all
 * (see RESEARCH Pitfall 2: running on static assets causes unnecessary overhead).
 *
 * @module middleware
 */

import { authMiddleware } from 'next-firebase-auth-edge';
import { NextRequest, NextResponse } from 'next/server';
import { authEdgeConfig } from '@/lib/auth-edge';

/**
 * Middleware function — verified against next-firebase-auth-edge@1.12.0 types.
 *
 * Confirmed API: authMiddleware(request, options) where options extends
 * SetAuthCookiesOptions and adds handleValidToken, handleInvalidToken, handleError.
 * loginPath/logoutPath are required by the library type. Cookie creation is also
 * handled in the session API route directly (so it can perform D1 upsert alongside
 * cookie minting). The middleware matcher excludes /api/auth/* so the middleware
 * loginPath handling doesn't conflict with the route handler.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  return authMiddleware(request, {
    ...authEdgeConfig,
    // Required by library type; the session route also handles cookie creation
    // for D1 upsert. Middleware matcher excludes /api/auth/*, so these don't conflict.
    loginPath: '/api/auth/session',
    logoutPath: '/api/auth/session',

    /**
     * Called when a valid session cookie is found.
     * Blocks /admin/* access for tokens without the admin custom claim.
     */
    handleValidToken: async ({ decodedToken }, headers) => {
      // Block admin routes for tokens without the admin custom claim
      if (
        request.nextUrl.pathname.startsWith('/admin') &&
        !decodedToken.admin
      ) {
        return new NextResponse('Forbidden', { status: 403 });
      }
      return NextResponse.next({ request: { headers } });
    },

    /**
     * Called when the session cookie is missing or invalid.
     * Redirects to /login with the original path preserved in ?redirect.
     */
    handleInvalidToken: async (_reason) => {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    },

    /**
     * Called on unexpected middleware errors (e.g. Google key fetch failure).
     * Logs and redirects to /login to avoid leaking error details.
     */
    handleError: async (error) => {
      console.error('Middleware auth error:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    },
  });
}

/**
 * Middleware route matcher.
 *
 * Protects /dashboard/* and /admin/* only.
 * /api/auth/* is excluded from the middleware matcher — the session route
 * handles its own cookie creation so it can also perform D1 agent row upsert.
 * Never use a catch-all matcher (Pitfall 2: auth middleware must not run on
 * /_next/static assets or other public routes).
 */
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
