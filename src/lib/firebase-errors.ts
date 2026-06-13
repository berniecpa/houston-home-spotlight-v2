/**
 * Firebase Auth Error Message Mapping
 *
 * Maps Firebase authentication error codes to human-readable copy
 * matching the UI-SPEC Copywriting Contract exactly.
 *
 * Used by RegisterForm, LoginForm, and ResetPasswordForm to display
 * user-friendly messages on Firebase rejection.
 *
 * @module lib/firebase-errors
 */

/**
 * Maps a Firebase Auth error code to human-readable copy.
 *
 * Error codes handled (per UI-SPEC Copywriting Contract):
 * - auth/email-already-in-use: Account exists prompt
 * - auth/wrong-password: Incorrect password prompt
 * - auth/invalid-credential: Firebase v9+ alias for wrong-password/user-not-found
 * - auth/user-not-found: No account prompt
 * - auth/weak-password: Minimum 8 chars prompt
 * - auth/invalid-email: Valid email format prompt
 * - unknown: Generic fallback
 *
 * @param code - Firebase Auth error code (e.g. "auth/email-already-in-use")
 * @returns Human-readable error message string
 */
export function firebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Log in instead.';

    case 'auth/wrong-password':
      return 'Incorrect password. Try again or reset your password.';

    case 'auth/invalid-credential':
      // Firebase v9+ SDK uses this code for wrong-password and user-not-found
      return 'Incorrect password. Try again or reset your password.';

    case 'auth/user-not-found':
      return 'No account found with this email. Create an account.';

    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';

    case 'auth/invalid-email':
      return 'Enter a valid email address.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';

    case 'auth/network-request-failed':
      return 'Something went wrong. Please try again.';

    default:
      return 'Something went wrong. Please try again.';
  }
}
