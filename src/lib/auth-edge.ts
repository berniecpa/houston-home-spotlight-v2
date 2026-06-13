/**
 * Shared next-firebase-auth-edge configuration
 *
 * Single source of truth for auth config imported by middleware,
 * session API route, and dashboard layout. Never duplicate this object.
 *
 * Private key newlines normalized per Pitfall 1 in RESEARCH.md:
 * wrangler secrets store the PEM with \\n; .replace(/\\n/g, '\n') restores them.
 *
 * @module lib/auth-edge
 */

/** Shared configuration object for next-firebase-auth-edge */
export const authEdgeConfig = {
  /** Firebase Web API key (public — safe to expose) */
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  /** HttpOnly session cookie name */
  cookieName: '__session',
  /** HMAC signing keys; two-key rotation supported */
  cookieSignatureKeys: [
    process.env.COOKIE_SECRET_CURRENT!,
    process.env.COOKIE_SECRET_PREVIOUS!,
  ],
  /** Cookie serialization options */
  cookieSerializeOptions: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    /** 12-day max age (seconds) */
    maxAge: 60 * 60 * 24 * 12,
  },
  /** Firebase service account for server-side token verification */
  serviceAccount: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    /** Normalize double-escaped newlines stored by wrangler secret put */
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },
};
