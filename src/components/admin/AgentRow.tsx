'use client';

/**
 * AgentRow Component — Suspend/Unsuspend toggle for the admin agent list.
 *
 * Client component that renders a single agent table row with an inline
 * suspend/unsuspend button. PATCHes /api/admin/agents/[id] when toggled,
 * then calls router.refresh() to re-fetch the server-rendered agent list.
 *
 * Security (T-05-11 mitigation):
 *   - Sends { suspended: boolean } only; the agentId is in the URL, not the body.
 *   - The server route derives admin identity from the session token (requireAdmin),
 *     not from any value this component sends.
 *
 * UX:
 *   - Button is disabled (and shows "..." label) while the PATCH is in flight.
 *   - Suspended badge shown in the Account Status column.
 *   - Color: Suspend button is red-600; Unsuspend is green-600.
 *
 * @module components/admin/AgentRow
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAgentRow } from '@/lib/admin';

/** AgentRow component props */
export interface AgentRowProps {
  /** Agent row data from the paginated agent list query */
  agent: AdminAgentRow;
}

/**
 * AgentRow — single agent table row with inline suspend toggle.
 *
 * @param props.agent - Agent row from listAgentsPaginated
 * @returns {JSX.Element} Table row with name/email/subscription/status/action
 */
export function AgentRow({ agent }: AgentRowProps): JSX.Element {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive current is_suspended from the prop (re-render on router.refresh())
  const isSuspended = agent.is_suspended === 1;

  /** Toggle suspend/unsuspend via admin API */
  const handleToggle = useCallback(async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Send the OPPOSITE of the current state to toggle
        body: JSON.stringify({ suspended: !isSuspended }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Toggle failed. Please try again.');
      } else {
        // Re-fetch the server component data to reflect the new state
        router.refresh();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsPending(false);
    }
  }, [agent.id, isSuspended, router]);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Name column */}
      <td className="px-4 py-3 text-sm text-gray-900">
        {agent.display_name ?? <span className="text-gray-400 italic">No name</span>}
      </td>

      {/* Email column */}
      <td className="px-4 py-3 text-sm text-gray-700">{agent.email}</td>

      {/* Subscription status column */}
      <td className="px-4 py-3 text-sm">
        <span
          className={
            agent.subscription_status === 'active'
              ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800'
              : agent.subscription_status === 'grace'
                ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800'
                : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600'
          }
        >
          {agent.subscription_status}
        </span>
      </td>

      {/* Account status column */}
      <td className="px-4 py-3 text-sm">
        {isSuspended ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
            Suspended
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            Active
          </span>
        )}
      </td>

      {/* Action column — suspend/unsuspend toggle */}
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            aria-label={isSuspended ? `Unsuspend agent ${agent.email}` : `Suspend agent ${agent.email}`}
            className={
              isPending
                ? 'px-3 py-1 rounded text-xs font-medium opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
                : isSuspended
                  ? 'px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors touch-target'
                  : 'px-3 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors touch-target'
            }
          >
            {isPending ? '...' : isSuspended ? 'Unsuspend' : 'Suspend'}
          </button>

          {/* Inline error message (clears on next toggle attempt) */}
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

export default AgentRow;
