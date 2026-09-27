/**
 * localStorage helpers for the student's completion state.
 *
 * Completion is stored as a plain array of assignment ids. Every read and write
 * is defensive: missing, malformed or unavailable storage must never break the
 * dashboard.
 */

export const COMPLETED_ASSIGNMENTS_KEY = "classboard_completed_assignments";

/** Reads the completed assignment ids. Returns `[]` for missing or invalid data. */
export function loadCompletedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(COMPLETED_ASSIGNMENTS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const ids = parsed.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    return [...new Set(ids)];
  } catch {
    // Unavailable storage (private mode, disabled cookies) or malformed JSON.
    return [];
  }
}

/** Persists the completed assignment ids. Failures are ignored on purpose. */
export function saveCompletedIds(ids: string[]): void {
  try {
    window.localStorage.setItem(
      COMPLETED_ASSIGNMENTS_KEY,
      JSON.stringify([...new Set(ids)]),
    );
  } catch {
    // Quota exceeded or storage unavailable. Completion still works for this session.
  }
}
