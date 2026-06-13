/**
 * ProfileCompletionBar Component
 *
 * Server display component that renders a horizontal progress bar showing
 * what percentage of the agent's five profile fields are complete.
 *
 * Visual spec (UI-SPEC Profile Completion Progress Bar):
 *   - Track: bg-gray-200 full-width rounded bar
 *   - Fill: bg-accent-500 (accent reserved use #2 per UI-SPEC)
 *   - Width: completionPercent(agent)% of track
 *   - Label: "Profile [N]% complete" — 14px semibold text-gray-700
 *
 * @module components/dashboard/ProfileCompletionBar
 */

import { completionPercent } from '@/lib/profile';
import type { AgentProfileFields } from '@/lib/profile';

/** ProfileCompletionBar component props */
export interface ProfileCompletionBarProps {
  /** Agent row fields used to compute the completion percentage */
  agent: AgentProfileFields;
}

/**
 * ProfileCompletionBar — horizontal progress indicator for agent profile.
 *
 * Uses accent-500 fill (accent reserved use #2). Pure display component.
 *
 * @param props.agent - Agent profile fields (nullable values treated as empty)
 * @returns {JSX.Element} Progress bar with label
 */
export function ProfileCompletionBar({
  agent,
}: ProfileCompletionBarProps): JSX.Element {
  const pct = completionPercent(agent);

  return (
    <div className="w-full">
      {/* Label */}
      <p className="text-sm font-semibold text-gray-700 mb-2">
        Profile {pct}% complete
      </p>

      {/* Track */}
      <div
        className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Profile ${pct}% complete`}
      >
        {/* Fill — bg-accent-500 per UI-SPEC accent reserved use #2 */}
        <div
          className="h-full bg-accent-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ProfileCompletionBar;
