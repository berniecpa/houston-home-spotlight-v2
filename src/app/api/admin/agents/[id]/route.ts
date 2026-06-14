/**
 * Admin Agent Suspend/Unsuspend API Route — PATCH /api/admin/agents/[id]
 *
 * Flips agents.is_suspended for the given agent ID.
 *
 * Security (T-05-10 defense in depth):
 *   - requireAdmin() re-verifies decodedToken.admin server-side before any D1 work.
 *   - Missing token → 401; present-but-non-admin → 403.
 *
 * Security (T-05-11 mitigation):
 *   - The target agentId comes ONLY from the route segment (URL params), never from
 *     the request body. This prevents callers from spoofing the target agent.
 *   - The admin identity is derived from the session token (requireAdmin), not the body.
 *
 * Security (T-05-12 mitigation):
 *   - setAgentSuspended in @/lib/admin uses prepare().bind() — no string concatenation.
 *
 * Body validation:
 *   - { suspended: boolean } — exactly one required boolean field.
 *   - Non-boolean or missing suspended → 400.
 *
 * @module app/api/admin/agents/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import {
  requireAdmin,
  isAdminRejection,
  setAgentSuspended,
} from '@/lib/admin';

/** Runtime must be edge for Cloudflare Workers compatibility */
export const runtime = 'edge';

/**
 * Route context with Next.js 15 async params.
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH handler — suspend or unsuspend an agent.
 *
 * Body: { suspended: boolean }
 *   - true  → is_suspended = 1 (agent is suspended)
 *   - false → is_suspended = 0 (agent is active)
 *
 * @param request - Incoming PATCH request with JSON body
 * @param context - Route context with async params (Next.js 15 pattern)
 * @returns { success: boolean, message: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    // --- 1. Admin claim re-verification (T-05-10: defense in depth) ---
    const adminResult = await requireAdmin();
    if (isAdminRejection(adminResult)) {
      return NextResponse.json(
        { success: false, message: adminResult.message },
        { status: adminResult.status }
      );
    }

    // --- 2. Resolve agentId from route segment (T-05-11: NOT from body) ---
    // Next.js 15 async params pattern: const { id } = await params
    const { id: agentId } = await params;

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing agent ID in route.' },
        { status: 400 }
      );
    }

    // --- 3. Parse and validate request body ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { success: false, message: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    const { suspended } = body as Record<string, unknown>;

    // Validate: suspended must be a boolean (not a string, number, or null)
    if (typeof suspended !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid value for "suspended". Must be a boolean (true or false).',
        },
        { status: 400 }
      );
    }

    // --- 4. Apply the suspension change to D1 ---
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB as unknown as D1Database;

    await setAgentSuspended(db, agentId, suspended);

    const action = suspended ? 'suspended' : 'unsuspended';
    return NextResponse.json({
      success: true,
      message: `Agent ${action} successfully.`,
    });
  } catch (error) {
    console.error('PATCH /api/admin/agents/[id] error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
