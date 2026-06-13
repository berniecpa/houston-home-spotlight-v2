/**
 * Auth Session API Route
 *
 * POST /api/auth/session — Exchanges a Firebase ID token for an HttpOnly __session
 * cookie. Verifies email_verified before minting cookie. Upserts agent row in D1.
 *
 * DELETE /api/auth/session — Clears the __session cookie (sign out).
 *
 * Confirmed next-firebase-auth-edge@1.12.0 API used here:
 *   - Cookie creation: setAuthCookies(headers, options) -> NextResponse
 *   - Cookie removal: removeAuthCookies(headers, options) -> NextResponse
 *   - Token verification: getFirebaseAuth({ serviceAccount, apiKey }).verifyIdToken(idToken)
 *
 * @module app/api/auth/session/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAuth } from 'next-firebase-auth-edge';
import {
  setAuthCookies,
  removeAuthCookies,
} from 'next-firebase-auth-edge/lib/next/cookies';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';

/**
 * Same-origin guard (WR-04): reject state-changing requests whose Origin (or,
 * as a fallback, Referer) host does not match the request host. The session
 * cookie is sameSite: 'lax', which does not protect non-GET cross-site
 * requests in all browsers/embeddings, so we enforce origin here.
 *
 * Returns true when the request originates from the same host or carries no
 * Origin/Referer (e.g. same-origin fetch in some runtimes). Returns false only
 * when a present Origin/Referer host mismatches the request host.
 */
function isSameOrigin(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) return false;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const candidate = origin ?? referer;

  // No Origin/Referer present: allow (covers non-browser/same-origin callers).
  if (!candidate) return true;

  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

/**
 * POST handler — exchange Firebase ID token for HttpOnly session cookie.
 *
 * Validates input, verifies the token, enforces the email_verified gate
 * (T-02-02 mitigation), upserts the agent row in D1, then mints the cookie.
 *
 * @returns {Promise<NextResponse>} 200 with cookie on success; 400/403/500 on error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // --- Same-origin guard (WR-04: logout/login CSRF on a lax cookie) ---
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { success: false, message: 'Cross-origin request rejected' },
        { status: 403 }
      );
    }

    // --- Input validation (CLAUDE.md: validate at system boundaries) ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      !('idToken' in body) ||
      typeof (body as Record<string, unknown>).idToken !== 'string' ||
      !(body as Record<string, unknown>).idToken
    ) {
      return NextResponse.json(
        { success: false, message: 'idToken is required' },
        { status: 400 }
      );
    }

    const { idToken } = body as { idToken: string };

    // --- Verify the Firebase ID token via Web Crypto (T-02-01 mitigation) ---
    const auth = getFirebaseAuth({
      serviceAccount: authEdgeConfig.serviceAccount,
      apiKey: authEdgeConfig.apiKey,
    });

    let decodedToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err) {
      console.error('Session route: token verification failed', err);
      return NextResponse.json(
        { success: false, message: 'Invalid or expired ID token' },
        { status: 401 }
      );
    }

    // --- Email-verified gate (T-02-02 mitigation — critical security control) ---
    if (!decodedToken.email_verified) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email not verified. Please verify your email before signing in.',
        },
        { status: 403 }
      );
    }

    // --- D1 agent row upsert (T-02-06: parameterized, no string concatenation) ---
    try {
      const { env } = await getCloudflareContext({ async: true });
      if (env.DB) {
        await env.DB.prepare(
          `INSERT INTO agents (id, email, created_at, updated_at)
           VALUES (?, ?, unixepoch(), unixepoch())
           ON CONFLICT(id) DO UPDATE SET updated_at = unixepoch()`
        )
          .bind(decodedToken.uid, decodedToken.email ?? '')
          .run();
      }
    } catch (dbErr) {
      // Non-fatal: log but don't block cookie creation — agent row can be backfilled
      console.error('Session route: D1 upsert failed', dbErr);
    }

    // --- Mint the HttpOnly __session cookie ---
    // setAuthCookies(headers, options) -> NextResponse (confirmed v1.12.0 API)
    const response = await setAuthCookies(request.headers, {
      ...authEdgeConfig,
    });

    return response;
  } catch (error) {
    console.error('Session route POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler — clear the __session cookie (sign out).
 *
 * Enforces a same-origin guard (WR-04) to prevent logout CSRF.
 *
 * @param request - Incoming DELETE request (used for the same-origin check)
 * @returns {Promise<NextResponse>} 200 with cleared cookie; 403 cross-origin
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // --- Same-origin guard (WR-04: prevent forced sign-out / logout CSRF) ---
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { success: false, message: 'Cross-origin request rejected' },
        { status: 403 }
      );
    }

    // removeAuthCookies(headers, options) -> NextResponse (confirmed v1.12.0 API)
    const response = removeAuthCookies(new Headers(), {
      cookieName: authEdgeConfig.cookieName,
      cookieSerializeOptions: authEdgeConfig.cookieSerializeOptions,
    });

    return response;
  } catch (error) {
    console.error('Session route DELETE error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
