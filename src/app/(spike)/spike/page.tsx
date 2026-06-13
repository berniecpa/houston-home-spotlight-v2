'use client';

/**
 * THROWAWAY Spike Page — Auth Cookie Round-Trip Validator
 *
 * This page exists ONLY to validate that the next-firebase-auth-edge
 * HttpOnly cookie session round-trips correctly through the
 * @opennextjs/cloudflare adapter on the Workers runtime (assumption A4).
 *
 * It will be DELETED in Plan 02-02 once the spike is approved.
 *
 * Usage in wrangler dev (cf:preview):
 *   1. Visit http://localhost:8788/spike
 *   2. Enter a verified Firebase user's email + password
 *   3. Click "Sign In & Test Cookie"
 *   4. Confirm the result shows cookie round-trip succeeded
 *
 * @module app/(spike)/spike/page
 */

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

/**
 * SpikePage — validates the Firebase Auth + HttpOnly cookie round-trip.
 * THROWAWAY: delete in Plan 02-02.
 */
export default function SpikePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  /**
   * Signs in with Firebase, exchanges the ID token for an HttpOnly cookie
   * via POST /api/auth/session, then fetches a protected path to confirm
   * the cookie round-trip works on the Workers runtime.
   */
  async function handleSignIn() {
    setLoading(true);
    setStatus('');

    try {
      // Step 1: Firebase client sign-in
      setStatus('Step 1: Signing in with Firebase...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      setStatus('Step 1 complete. ID token obtained.');

      // Step 2: Exchange ID token for HttpOnly session cookie
      setStatus('Step 2: Exchanging ID token for session cookie...');
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}));
        const msg = (err as Record<string, string>).message ?? sessionRes.statusText;
        setStatus(`FAILED at Step 2: ${msg} (status ${sessionRes.status})`);
        setLoading(false);
        return;
      }

      setStatus(
        'Step 2 complete. Session cookie set. Check DevTools -> Application -> Cookies for __session (HttpOnly).'
      );

      // Step 3: Confirm check — visit a protected path; middleware should pass us through
      setStatus('Step 3: Verifying cookie persists to protected route...');
      const checkRes = await fetch('/dashboard', { redirect: 'manual' });

      if (checkRes.type === 'opaqueredirect') {
        setStatus(
          'RESULT: Cookie round-trip INCONCLUSIVE via fetch (opaque redirect). ' +
            'Navigate to /dashboard in a new tab to confirm middleware passes you through. ' +
            'Check DevTools for __session cookie (HttpOnly = true).'
        );
      } else if (checkRes.redirected && checkRes.url.includes('/login')) {
        setStatus(
          'RESULT: FAILED — protected route redirected to /login even with cookie. ' +
            'Cookie may not be forwarded by the OpenNext adapter. Check Pitfall 3 in RESEARCH.md.'
        );
      } else {
        setStatus(
          `RESULT: Response status ${checkRes.status}. ` +
            'Navigate manually to /dashboard to verify the middleware passes you through.'
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`ERROR: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Signs out by deleting the session cookie via DELETE /api/auth/session.
   */
  async function handleSignOut() {
    setLoading(true);
    setStatus('Clearing session cookie...');
    try {
      const res = await fetch('/api/auth/session', { method: 'DELETE' });
      if (res.ok) {
        setStatus(
          'Signed out. __session cookie cleared. Visit /dashboard to confirm redirect to /login.'
        );
      } else {
        setStatus(`Sign-out failed: ${res.status}`);
      }
    } catch (err) {
      setStatus(
        `Sign-out error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container-custom py-12">
      <div className="max-w-lg mx-auto">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-primary-900 mb-2">
            Auth Spike — Cookie Round-Trip Test
          </h1>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-6">
            THROWAWAY — This page will be deleted in Plan 02-02. Use a verified
            test Firebase user only.
          </p>

          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="spike-email"
              >
                Firebase user email
              </label>
              <input
                id="spike-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="test@example.com"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="spike-password"
              >
                Password
              </label>
              <input
                id="spike-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="••••••••"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading || !email || !password}
                className="btn-primary flex-1 touch-target"
                aria-label="Sign in and test cookie round-trip"
              >
                {loading ? 'Working...' : 'Sign In & Test Cookie'}
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="btn-accent px-4 touch-target"
                aria-label="Sign out and clear session cookie"
              >
                Sign Out
              </button>
            </div>

            {status && (
              <div
                className={`text-sm rounded-lg p-4 border ${
                  status.includes('FAILED') || status.includes('ERROR')
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : status.includes('RESULT')
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
                role="status"
                aria-live="polite"
              >
                <p className="whitespace-pre-wrap">{status}</p>
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-gray-500 space-y-1">
            <p>
              <strong>Manual checks:</strong>
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                DevTools -&gt; Application -&gt; Cookies -&gt; confirm{' '}
                <code>__session</code> with HttpOnly = true
              </li>
              <li>
                Navigate to <code>/dashboard</code> — should NOT redirect to
                /login if signed in
              </li>
              <li>
                Clear cookie, visit <code>/dashboard</code> — should redirect
                to <code>/login?redirect=/dashboard</code>
              </li>
              <li>
                Run:{' '}
                <code>
                  wrangler d1 execute DB --local --command &quot;SELECT id,
                  email FROM agents&quot;
                </code>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
