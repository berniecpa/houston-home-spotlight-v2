/**
 * LogoutButton Component
 *
 * Client button that signs the user out: clears the server __session cookie
 * (DELETE /api/auth/session) and the Firebase client session (signOut), then
 * redirects home. Reused in the agent dashboard and admin sidebars.
 *
 * @module components/auth/LogoutButton
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

/** Props for the LogoutButton component */
export interface LogoutButtonProps {
  /** Tailwind classes controlling the button's appearance for its sidebar theme. */
  className?: string;
}

/**
 * LogoutButton — clears server + client auth state and redirects to home.
 *
 * Clears the HttpOnly session cookie first (DELETE is same-origin guarded by
 * the session route), then the Firebase client session, so server and client
 * auth state stay consistent.
 *
 * @param {LogoutButtonProps} props - Component props
 * @returns {JSX.Element} A sign-out button
 */
export function LogoutButton({ className }: LogoutButtonProps): JSX.Element {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsSigningOut(true);
    // Clear the HttpOnly server session cookie first (best-effort).
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Ignore network errors — still clear the client session below.
    }
    // Clear the Firebase client session.
    try {
      await signOut(auth);
    } catch {
      // Ignore — the server cookie is already cleared.
    }
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSigningOut}
      aria-label="Sign out"
      className={className}
    >
      {isSigningOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

export default LogoutButton;
