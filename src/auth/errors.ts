/**
 * Turns Supabase errors into something a person can act on.
 *
 * Raw SDK messages never reach a user (§29): they are cryptic, can leak
 * internals, and some are misleading. A wrong password and a non-existent
 * account both report `invalid_credentials`, and must not be shown differently.
 *
 * Three error families arrive here:
 *   - Auth errors carry a string `code` (`invalid_credentials`, …).
 *   - Database (PostgREST) errors carry a Postgres SQLSTATE `code` (`42501`, …).
 *   - Storage errors carry only a message and an HTTP status.
 */

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email first — check your inbox for the link.",
  user_already_exists: "An account with that email already exists. Sign in instead.",
  email_exists: "An account with that email already exists. Sign in instead.",
  weak_password: "Choose a stronger password.",
  email_address_invalid: "That does not look like a valid email address.",
  validation_failed: "Check the email and password and try again.",
  over_request_rate_limit: "Too many attempts. Wait a moment and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
  user_banned: "This account has been deactivated.",
  signup_disabled: "New accounts are not being accepted right now.",
  provider_disabled: "That sign-in method is not enabled for this project yet.",
  email_provider_disabled: "Email sign-in is not enabled for this project yet.",
};

const DATABASE_MESSAGES: Record<string, string> = {
  // RLS refused the row, or a trigger refused the change.
  "42501": "You do not have permission to do that.",
  // A CHECK constraint, e.g. a title that is too long.
  "23514": "Some of the details are not valid. Check the form and try again.",
  // The subject does not belong to this class, or was removed.
  "23503": "That subject is no longer available. Pick another one.",
  "23505": "That already exists.",
  PGRST301: "Your session has expired. Sign in again.",
};

/** Errors raised by name from the database functions (see the migration). */
const FUNCTION_MESSAGES: Record<string, string> = {
  "invite-invalid": "That invite code doesn't match any class. Check it and try again.",
  "invalid-name": "Give it a name between 1 and 80 characters.",
  "too-many-classes": "You own the maximum number of classes. Delete one first.",
  "not-allowed": "You do not have permission to do that.",
  "not-signed-in": "Your session has expired. Sign in again.",
};

export function toFriendlyError(error: unknown): string {
  if (typeof error !== "object" || error === null) return GENERIC;

  const { code, message, status, statusCode } = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  const raw = typeof message === "string" ? message.toLowerCase() : "";
  for (const [key, friendly] of Object.entries(FUNCTION_MESSAGES)) {
    if (raw.includes(key)) return friendly;
  }

  if (typeof code === "string") {
    if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
    if (DATABASE_MESSAGES[code]) return DATABASE_MESSAGES[code];
  }

  const text = raw;
  const httpStatus = Number(statusCode ?? status);

  // Storage
  if (httpStatus === 413 || text.includes("maximum allowed size")) {
    return "That file is larger than 25 MB.";
  }
  if (text.includes("mime type") || text.includes("invalid_mime_type")) {
    return "That file type is not supported. Use PDF, PowerPoint, Word, Excel, text or an image.";
  }
  if (httpStatus === 403 || text.includes("row-level security")) {
    return "You do not have permission to do that.";
  }

  // fetch() itself failed: offline, DNS, blocked.
  if (error instanceof TypeError || text.includes("failed to fetch") || text.includes("network")) {
    return "Network problem. Check your connection and try again.";
  }

  return GENERIC;
}

// Never surface an unknown SDK message — it can contain internal detail.
const GENERIC = "Something went wrong. Please try again.";
