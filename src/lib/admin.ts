/**
 * Admin server-side helpers for the /admin panel routes.
 *
 * Provides:
 *   - requireAdmin(): session-derived admin-claim guard (T-05-10/11 defense in depth)
 *   - listAgentsPaginated(): paginated SELECT of agents for the admin agent list
 *   - setAgentSuspended(): parameterized UPDATE of agents.is_suspended
 *   - getPlatformStats(): four COUNT queries for the stats page
 *
 * Security:
 *   - requireAdmin re-verifies decodedToken.admin from the session token — NEVER from
 *     the request body or headers. This is defense in depth beyond middleware.ts.
 *   - setAgentSuspended accepts the agentId from the route segment, not from the
 *     request body, so callers cannot spoof the target (T-05-11).
 *   - All D1 queries are parameterized via prepare().bind() (T-05-12).
 *   - Server-side pagination caps rows per request at PAGE_SIZE (T-05-14).
 *
 * Out of scope (v1): agent profile editing, account deletion.
 *
 * @module lib/admin
 */

import type { D1Database } from '@cloudflare/workers-types';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { authEdgeConfig } from '@/lib/auth-edge';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Shape of an agents row as returned by the admin agent list query.
 */
export interface AdminAgentRow {
  /** Firebase UID (agents.id) */
  id: string;
  /** Agent's display name (may be null for new agents who haven't completed profile) */
  display_name: string | null;
  /** Agent's email (from Firebase auth, synced to D1) */
  email: string;
  /** Current subscription status: 'none' | 'active' | 'grace' | 'lapsed' */
  subscription_status: string;
  /** 1 if agent is suspended, 0 otherwise */
  is_suspended: number;
}

/**
 * Result type for listAgentsPaginated.
 */
export interface PaginatedAgents {
  /** Page of agent rows */
  agents: AdminAgentRow[];
  /** Total number of agents (for pagination math) */
  total: number;
}

/**
 * Typed result returned by requireAdmin on success.
 */
export interface AdminTokenResult {
  /** Firebase UID of the authenticated admin */
  uid: string;
  /** Full decoded token (contains .admin claim) */
  decodedToken: {
    uid: string;
    admin: boolean;
    email?: string;
    email_verified?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Typed rejection result returned by requireAdmin when access is denied.
 */
export interface AdminTokenRejection {
  /** HTTP status to return: 401 (no token) or 403 (non-admin token) */
  status: 401 | 403;
  /** Human-readable rejection reason */
  message: string;
}

/**
 * requireAdmin returns either a success payload or a rejection.
 */
export type RequireAdminResult = AdminTokenResult | AdminTokenRejection;

/**
 * Type guard: checks whether a RequireAdminResult is a rejection.
 */
export function isAdminRejection(result: RequireAdminResult): result is AdminTokenRejection {
  return 'status' in result && ('message' in result) && !('uid' in result);
}

// ────────────────────────────────────────────────────────────────────────────
// requireAdmin — server-side admin claim guard
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verify the request's session cookie and confirm the admin custom claim.
 *
 * This is defense in depth beyond middleware.ts — every admin API route must
 * call requireAdmin before touching D1. If middleware is bypassed, this guard
 * still enforces the admin claim (T-05-10 mitigation).
 *
 * Reads the session cookie via next/headers cookies() and validates the
 * Firebase token via getTokens(). Checks decodedToken.admin === true.
 * NEVER reads admin status from the request body or headers.
 *
 * Returns:
 *   - AdminTokenResult when the caller is a verified admin (uid, decodedToken)
 *   - AdminTokenRejection { status: 401 } when no token exists
 *   - AdminTokenRejection { status: 403 } when token lacks the admin claim
 *
 * @returns RequireAdminResult — check with isAdminRejection() before proceeding
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, authEdgeConfig);

  // 401 — no session cookie or invalid/expired token
  if (!tokens) {
    return { status: 401, message: 'Unauthorized' };
  }

  const { decodedToken } = tokens;

  // 403 — valid session but no admin claim (T-05-10: non-admin calls admin API)
  // Firebase custom claims are not in DecodedIdToken's declared type — cast to access.
  // WR-01: use STRICT equality (=== true). A custom claim accidentally set to a
  // truthy non-boolean (e.g. the string "false") must NOT grant admin access.
  const claims = decodedToken as unknown as Record<string, unknown>;
  if (claims['admin'] !== true) {
    return { status: 403, message: 'Forbidden: admin access required' };
  }

  return {
    uid: decodedToken.uid,
    // Cast through unknown: DecodedIdToken does not declare custom claims
    // such as `admin`; the claim is set via Firebase Admin setCustomUserClaims
    // and is present at runtime but not in the SDK's type definition.
    decodedToken: decodedToken as unknown as AdminTokenResult['decodedToken'],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// listAgentsPaginated — paginated agent list for admin view
// ────────────────────────────────────────────────────────────────────────────

/** Page size for the admin agent list (T-05-14: caps rows per request) */
export const ADMIN_PAGE_SIZE = 25;

/**
 * Return a page of agents (ordered newest-first) and the total count.
 *
 * Columns returned: id, display_name, email, subscription_status, is_suspended
 * Ordered: created_at DESC (newest agents first, consistent across pages)
 * Pagination: LIMIT/OFFSET — all parameterized via .bind() (T-05-12)
 *
 * A separate COUNT(*) query provides the total for Prev/Next pagination math.
 *
 * @param db     - D1Database binding from Cloudflare Worker env
 * @param limit  - Number of rows to return (typically ADMIN_PAGE_SIZE)
 * @param offset - Number of rows to skip (page * limit)
 * @returns PaginatedAgents with agents array and total count
 */
export async function listAgentsPaginated(
  db: D1Database,
  limit: number,
  offset: number
): Promise<PaginatedAgents> {
  // Paginated SELECT — parameterized LIMIT/OFFSET (T-05-12/14)
  const rowsResult = await db
    .prepare(
      `SELECT id, display_name, email, subscription_status, is_suspended
       FROM agents
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<AdminAgentRow>();

  // Separate COUNT(*) for total (needed for Prev/Next pagination)
  const countResult = await db
    .prepare('SELECT COUNT(*) AS total FROM agents')
    .first<{ total: number }>();

  return {
    agents: rowsResult.results,
    total: countResult?.total ?? 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// setAgentSuspended — flip is_suspended on a single agent
// ────────────────────────────────────────────────────────────────────────────

/**
 * Flip an agent's is_suspended flag in D1.
 *
 * Target is the agentId from the API route segment — NEVER from the request
 * body to prevent callers from spoofing the target (T-05-11 mitigation).
 *
 * Updates updated_at = unixepoch() so the change is timestamped.
 * All values bound via prepare().bind() — no string concatenation (T-05-12).
 *
 * WR-02: returns the number of rows changed so the caller can distinguish a
 * real update from a no-op (agentId matched no row — deleted agent, stale id
 * from a long-open admin tab, fabricated id) and respond 404 instead of
 * silently claiming success.
 *
 * @param db        - D1Database binding from Cloudflare Worker env
 * @param agentId   - agents.id to update (from the URL route segment)
 * @param suspended - true to suspend (is_suspended=1), false to unsuspend (is_suspended=0)
 * @returns The number of agent rows updated (0 when no row matched agentId)
 */
export async function setAgentSuspended(
  db: D1Database,
  agentId: string,
  suspended: boolean
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE agents
       SET is_suspended = ?,
           updated_at   = unixepoch()
       WHERE id = ?`
    )
    .bind(suspended ? 1 : 0, agentId)
    .run();

  return result.meta?.changes ?? 0;
}

// ────────────────────────────────────────────────────────────────────────────
// getPlatformStats — four COUNT queries for the stats page
// ────────────────────────────────────────────────────────────────────────────

/**
 * Shape returned by getPlatformStats.
 */
export interface PlatformStats {
  /** Total number of agent rows */
  totalAgents: number;
  /** Agents with subscription_status = 'active' */
  activeSubscriptions: number;
  /** Total listing rows */
  totalListings: number;
  /** Total lead rows */
  totalLeads: number;
}

/**
 * Fetch platform-wide count statistics for the admin stats page.
 *
 * Issues four independent COUNT(*) queries:
 *   1. Total agents
 *   2. Active subscriptions (subscription_status = 'active')
 *   3. Total listings
 *   4. Total leads
 *
 * All queries are read-only; no parameterized values needed (no user input).
 *
 * @param db - D1Database binding from Cloudflare Worker env
 * @returns PlatformStats with four counts
 */
export async function getPlatformStats(db: D1Database): Promise<PlatformStats> {
  const [agentsRow, activeSubsRow, listingsRow, leadsRow] = await Promise.all([
    db
      .prepare('SELECT COUNT(*) AS total FROM agents')
      .first<{ total: number }>(),
    db
      .prepare("SELECT COUNT(*) AS total FROM agents WHERE subscription_status = 'active'")
      .first<{ total: number }>(),
    db
      .prepare('SELECT COUNT(*) AS total FROM listings')
      .first<{ total: number }>(),
    db
      .prepare('SELECT COUNT(*) AS total FROM leads')
      .first<{ total: number }>(),
  ]);

  return {
    totalAgents: agentsRow?.total ?? 0,
    activeSubscriptions: activeSubsRow?.total ?? 0,
    totalListings: listingsRow?.total ?? 0,
    totalLeads: leadsRow?.total ?? 0,
  };
}
