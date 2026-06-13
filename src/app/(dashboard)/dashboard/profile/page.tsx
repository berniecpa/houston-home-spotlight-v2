/**
 * Profile Page (/dashboard/profile)
 *
 * RSC that reads the agent's current profile from D1 and renders the
 * ProfileForm pre-filled with existing values.
 *
 * This page is the destination of the AUTH-05 redirect gate enforced in
 * src/app/(dashboard)/layout.tsx. The layout does NOT redirect here again
 * when the current path starts with /dashboard/profile (Pitfall 4 guard).
 *
 * Per UI-SPEC /dashboard/profile spec.
 *
 * @module app/(dashboard)/dashboard/profile/page
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authEdgeConfig } from '@/lib/auth-edge';
import { ProfileForm } from '@/components/dashboard/ProfileForm';
import type { ProfileFormValues } from '@/components/dashboard/ProfileForm';

/** Page metadata */
export const metadata: Metadata = {
  title: 'Your Profile — Houston Home Spotlight',
};

/** Agent row subset read for pre-filling the profile form */
interface AgentProfileRow {
  display_name: string | null;
  photo_url: string | null;
  phone: string | null;
  brokerage: string | null;
  license_number: string | null;
}

/**
 * ProfilePage — pre-filled profile form for agent to complete/update.
 *
 * Reads current agent values from D1 (null becomes empty string for form).
 * Falls back to all-empty form in dev environment where D1 is unavailable.
 *
 * @returns {Promise<JSX.Element>} Profile form page
 */
export default async function ProfilePage(): Promise<JSX.Element> {
  // Read current agent values for pre-fill
  let initialValues: ProfileFormValues = {
    display_name: '',
    photo_url: '',
    phone: '',
    brokerage: '',
    license_number: '',
  };

  try {
    const cookieStore = await cookies();
    const tokens = await getTokens(cookieStore, authEdgeConfig);

    if (tokens) {
      const { env } = await getCloudflareContext({ async: true });
      const row = await env.DB.prepare(
        `SELECT display_name, photo_url, phone, brokerage, license_number
         FROM agents WHERE id = ?`
      )
        .bind(tokens.decodedToken.uid)
        .first<AgentProfileRow>();

      if (row) {
        initialValues = {
          display_name: row.display_name ?? '',
          photo_url: row.photo_url ?? '',
          phone: row.phone ?? '',
          brokerage: row.brokerage ?? '',
          license_number: row.license_number ?? '',
        };
      }
    }
  } catch (err) {
    console.error('ProfilePage: D1 agent read error', err);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900 mb-8">
        Your Profile
      </h1>
      <ProfileForm initialValues={initialValues} />
    </div>
  );
}
