/**
 * Client-side Firebase initialization
 *
 * Exports a Firebase Auth instance for use in browser components.
 * HMR-safe: guards against double-initialization via getApps().length check.
 *
 * Only import this module in 'use client' components — it uses the Firebase
 * client SDK which requires browser APIs and NEXT_PUBLIC_ env vars.
 *
 * @module lib/firebase-client
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/** Firebase client SDK configuration from NEXT_PUBLIC_ env vars */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

/**
 * Firebase app instance — HMR-safe initialization.
 * Uses existing app if already initialized (prevents duplicate-app error in Next.js dev).
 */
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Firebase Auth instance for client-side authentication operations.
 * Use in 'use client' components only.
 */
export const auth = getAuth(app);
