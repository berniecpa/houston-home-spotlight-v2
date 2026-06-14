/**
 * AgentProfileHeader Component
 *
 * Pure presentation component for the public agent profile page.
 * Renders the agent's public-safe identity: display_name, photo_url,
 * brokerage, and license_number.
 *
 * PII safety (T-05-06): AgentProfileHeaderProps intentionally omits
 * email and phone — these fields are never passed to any client component
 * on the public profile path.
 *
 * No 'use client' directive — this is a pure server-rendered display
 * component with no hooks or browser APIs.
 *
 * @module components/AgentProfileHeader
 */

import Image from 'next/image';

/**
 * Props for the AgentProfileHeader component.
 *
 * Contains ONLY public-safe identity fields — no email or phone (T-05-06).
 */
export interface AgentProfileHeaderProps {
  /** Agent's public display name */
  display_name: string;
  /** URL of the agent's profile photo; null if not set */
  photo_url: string | null;
  /** Brokerage or company name; null if not set */
  brokerage: string | null;
  /** Real estate license number; null if not set */
  license_number: string | null;
}

/**
 * AgentProfileHeader — Public-safe agent identity header.
 *
 * Renders the agent's photo (or a fallback avatar), display name,
 * brokerage, and license number in a card-style header. Uses existing
 * Tailwind utilities (.card, .container-custom, primary-* palette) for
 * visual consistency with the rest of the marketplace.
 *
 * @param {AgentProfileHeaderProps} props - Component props (no PII)
 * @returns {JSX.Element} The agent identity header
 */
export function AgentProfileHeader({
  display_name,
  photo_url,
  brokerage,
  license_number,
}: AgentProfileHeaderProps): JSX.Element {
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Agent Photo */}
        <div className="relative flex-shrink-0">
          {photo_url ? (
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-primary-100 shadow-md">
              <Image
                src={photo_url}
                alt={`Profile photo of ${display_name}`}
                fill
                sizes="(max-width: 640px) 96px, 128px"
                className="object-cover"
              />
            </div>
          ) : (
            /* Fallback avatar when no photo is set */
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary-100 border-4 border-primary-200 shadow-md flex items-center justify-center">
              <svg
                className="w-12 h-12 sm:w-16 sm:h-16 text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Agent Identity */}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900 mb-1">
            {display_name}
          </h1>

          {brokerage && (
            <p className="text-lg text-gray-700 font-medium mb-2">{brokerage}</p>
          )}

          {license_number && (
            <p className="text-sm text-gray-500">
              License #{license_number}
            </p>
          )}

          {/* Contact prompt — buyers use per-listing inquiry forms; no email/phone here */}
          <p className="mt-3 text-sm text-gray-600">
            Contact this agent via the inquiry form on any listing below.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AgentProfileHeader;
