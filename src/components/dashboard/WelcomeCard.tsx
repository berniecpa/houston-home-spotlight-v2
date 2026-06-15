/**
 * WelcomeCard Component
 *
 * Server display component shown on /dashboard for new and returning agents.
 * Shows the agent's first name, the ProfileCompletionBar, and a CTA:
 *
 *   - Profile incomplete: "Complete your profile" link → /dashboard/profile
 *   - Profile complete:   "Create your first listing" button (.btn-accent)
 *                         disabled (aria-disabled + opacity-50) until 100%
 *
 * Below the card: empty state copy per UI-SPEC Copywriting Contract.
 *
 * Per UI-SPEC /dashboard page spec and Copywriting Contract.
 *
 * @module components/dashboard/WelcomeCard
 */

import Link from 'next/link';
import { ProfileCompletionBar } from '@/components/dashboard/ProfileCompletionBar';
import { isProfileComplete } from '@/lib/profile';
import type { AgentProfileFields } from '@/lib/profile';

/** WelcomeCard component props */
export interface WelcomeCardProps {
  /** Full agent row from D1, used for display name and progress */
  agent: AgentProfileFields & { display_name?: string | null };
}

/**
 * Extract the first name from a full display name.
 * Returns "there" as fallback if name is null/empty.
 */
function firstName(displayName: string | null | undefined): string {
  if (!displayName) return 'there';
  const first = displayName.trim().split(/\s+/)[0];
  return first || 'there';
}

/**
 * WelcomeCard — new-agent onboarding card with progress bar and CTA.
 *
 * Pure server display component. No client state.
 *
 * @param props.agent - Agent profile fields
 * @returns {JSX.Element} Onboarding card
 */
export function WelcomeCard({ agent }: WelcomeCardProps): JSX.Element {
  const profileDone = isProfileComplete(agent);

  return (
    <div>
      {/* Welcome heading */}
      <h1 className="font-serif text-xl font-semibold leading-relaxed text-gray-900 mb-6">
        Welcome, {firstName(agent.display_name)}
      </h1>

      {/* Main card */}
      <div className="card p-6 mb-6">
        <ProfileCompletionBar agent={agent} />

        {/* CTA */}
        <div className="mt-5">
          {profileDone ? (
            /* Profile complete: enabled "Create your first listing" button */
            <Link
              href="/dashboard/listings/new"
              className="btn-accent touch-target w-full text-center inline-flex items-center justify-center"
              aria-disabled="false"
            >
              Create your first listing
            </Link>
          ) : (
            /* Profile incomplete: link to profile form */
            <Link
              href="/dashboard/profile"
              className="text-primary-600 underline text-base hover:text-primary-800 transition-colors"
            >
              Complete your profile
            </Link>
          )}
        </div>
      </div>

      {/* Empty state below card */}
      <div className="text-center py-8">
        <p className="font-serif text-xl font-semibold leading-relaxed text-gray-700 mb-2">
          Welcome to Houston Home Spotlight
        </p>
        <p className="text-base text-gray-500">
          Your listings will appear here once you&apos;ve completed your profile
          and created your first listing.
        </p>
      </div>
    </div>
  );
}

export default WelcomeCard;
