/**
 * Turns Firebase Auth error codes into something a person can act on.
 *
 * The spec is explicit that raw Firebase errors never reach a user: they are
 * cryptic, they leak internals, and several of them are actively misleading
 * (a wrong password and a non-existent account both report
 * `auth/invalid-credential`, which must not be shown differently).
 */

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "That does not look like a valid email address.",
  "auth/user-disabled": "This account has been deactivated. Ask your superadmin.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network problem. Check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and retry.",
  "auth/cancelled-popup-request": "A sign-in window is already open. Close it and retry.",
  "auth/account-exists-with-different-credential":
    "An account already exists with that email using a different sign-in method.",
  "auth/operation-not-allowed":
    "That sign-in method is not enabled for this project yet.",
  "auth/unauthorized-domain":
    "This domain is not authorised for sign-in. Add it in the Firebase console.",
  "auth/too-many-requests-quota": "Too many attempts. Wait a moment and try again.",
  "permission-denied":
    "You do not have permission to do that.",
  "unavailable": "Could not reach the server. Check your connection and try again.",
};

export function toFriendlyError(error: unknown): string {
  const code = readCode(error);

  if (code && MESSAGES[code]) return MESSAGES[code];

  // Never surface an unknown SDK message — it can contain internal detail.
  return "Something went wrong. Please try again.";
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
