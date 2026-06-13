/**
 * scripts/set-admin-claim.ts
 *
 * One-time Node.js script — sets the admin:true Firebase custom claim on
 * Bernard's account (the platform owner). This script MUST be run in Node.js
 * (not in Cloudflare Workers). firebase-admin uses Node.js-only APIs
 * (node:crypto, node:net) that are unavailable in the Workers runtime. It is
 * a devDependency confined to this scripts/ directory and is NEVER imported
 * by any src/ app code.
 *
 * IMPORTANT: After running this script, Bernard must sign out and sign back in
 * (or wait up to 1 hour for the Firebase token to auto-refresh) so the new
 * admin claim appears in his ID token and the middleware can read it.
 *
 * Prerequisites:
 *   1. Download a service account key JSON:
 *      Firebase Console -> Project Settings -> Service accounts -> Generate new private key
 *      Save as ./serviceAccountKey.json in the project root (gitignored -- never commit).
 *   2. Find Bernard's UID:
 *      Firebase Console -> Authentication -> Users -> find Bernard's account -> copy User UID.
 *   3. Export the UID as an environment variable before running:
 *      BERNARD_UID=<paste-uid> npm run admin:set-claim
 *
 * Usage:
 *   BERNARD_UID=abc123 npm run admin:set-claim
 *
 * @module scripts/set-admin-claim
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// --- Guard: BERNARD_UID must be set ---
const uid = process.env.BERNARD_UID;
if (!uid || uid.trim() === '') {
  console.error(
    '\nError: BERNARD_UID environment variable is not set.\n\n' +
    'How to find Bernard\'s UID:\n' +
    '  1. Open the Firebase Console: https://console.firebase.google.com\n' +
    '  2. Select the Houston Home Spotlight project\n' +
    '  3. Go to Authentication -> Users\n' +
    '  4. Find Bernard\'s account (bernardcpa@gmail.com)\n' +
    '  5. Copy the User UID (looks like: abc123XYZ...)\n\n' +
    'Then run:\n' +
    '  BERNARD_UID=<paste-uid-here> npm run admin:set-claim\n'
  );
  process.exit(1);
}

// --- Initialize Firebase Admin with service account ---
// serviceAccountKey.json is gitignored and must be present locally.
// Download from: Firebase Console -> Project Settings -> Service accounts -> Generate new private key
const app = initializeApp({
  credential: cert('./serviceAccountKey.json'),
});

// --- Set admin:true custom claim on Bernard's account ---
await getAuth(app).setCustomUserClaims(uid.trim(), { admin: true });

console.log(`\nAdmin claim set successfully for uid: ${uid.trim()}`);
console.log(
  '\nIMPORTANT: Bernard must sign out and sign back in (or wait up to\n' +
  '1 hour for the token to auto-refresh) for the admin claim to take\n' +
  'effect. The middleware reads the claim from the signed JWT token;\n' +
  'the old token does not carry the new claim until it is refreshed.\n'
);

process.exit(0);
