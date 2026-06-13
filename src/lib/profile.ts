/**
 * Agent Profile Helpers
 *
 * Pure helper functions for computing agent profile completeness.
 * Used by the dashboard layout gate (AUTH-05), the WelcomeCard, and the
 * ProfileCompletionBar component.
 *
 * isProfileComplete — four-field gate per RESEARCH Pattern 4:
 *   Checks display_name, phone, brokerage, license_number.
 *   photo_url contributes to the progress bar but is NOT required to unlock
 *   the dashboard (it is not in the four-field redirect gate).
 *
 * completionPercent — five-field progress bar per UI-SPEC:
 *   Counts display_name, photo_url, phone, brokerage, license_number.
 *   Each contributes 20%. Null and empty string are both treated as incomplete.
 *
 * @module lib/profile
 */

/** Agent fields relevant to profile completion */
export interface AgentProfileFields {
  display_name?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  brokerage?: string | null;
  license_number?: string | null;
}

/**
 * Determine whether the agent's profile is complete enough to unlock
 * the dashboard and listing creation (AUTH-05 gate).
 *
 * Checks four required fields: display_name, phone, brokerage, license_number.
 * Both null and empty string are treated as incomplete.
 * photo_url is excluded from this gate — it is tracked in completionPercent only.
 *
 * @param agent - Partial agent row from D1
 * @returns true when all four required gate fields are non-null, non-empty strings
 */
export function isProfileComplete(agent: AgentProfileFields): boolean {
  return !!(
    agent.display_name &&
    agent.phone &&
    agent.brokerage &&
    agent.license_number
  );
}

/**
 * Compute what percentage of the five profile fields are filled.
 *
 * Fields: display_name, photo_url, phone, brokerage, license_number.
 * Each filled field contributes 20%. Null and empty string both count as 0%.
 *
 * @param agent - Partial agent row from D1
 * @returns Integer 0..100 in multiples of 20
 */
export function completionPercent(agent: AgentProfileFields): number {
  const fields: (keyof AgentProfileFields)[] = [
    'display_name',
    'photo_url',
    'phone',
    'brokerage',
    'license_number',
  ];

  const filled = fields.filter((f) => {
    const v = agent[f];
    return typeof v === 'string' && v.length > 0;
  }).length;

  return filled * 20;
}
