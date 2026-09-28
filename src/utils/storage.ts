/**
 * localStorage helpers for the student's completion state.
 *
 * Completion is stored as a plain array of assignment ids. Every read and write
 * is defensive: missing, malformed or unavailable storage must never break the
 * dashboard.
 */

export const COMPLETED_ASSIGNMENTS_KEY = "classboard_completed_assignments";

export const CLASS_ID_KEY = "classboard_class_id";

/** The class this browser last looked at, or null. A preference, not an identity. */
export function loadClassId(): string | null {
  try {
    const raw = window.localStorage.getItem(CLASS_ID_KEY);
    return raw && raw.length > 0 && raw.length <= 1500 ? raw : null;
  } catch {
    return null;
  }
}

/** Remembers the class, or forgets it when passed null. Failures are ignored. */
export function saveClassId(classId: string | null): void {
  try {
    if (classId) {
      window.localStorage.setItem(CLASS_ID_KEY, classId);
    } else {
      window.localStorage.removeItem(CLASS_ID_KEY);
    }
  } catch {
    // Storage unavailable. The class still works for this page view.
  }
}

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
