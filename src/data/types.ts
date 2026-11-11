/**
 * The shapes the UI renders.
 *
 * Deliberately separate from the database row shape. An assignment row is
 * `{ subject_id, subject_name, title, ..., attachments }`; the card wants
 * `{ subject, title, ..., attachments }` with links ready to open. Mapping once, in `rows.ts`, means the
 * components never learn a column name that only the backend uses.
 */

/**
 * How urgent the work is, as chosen by whoever posted it.
 *
 * `none` is the default and means "no priority was set" — the absence of a claim
 * rather than a low level of urgency.
 */
export type Priority = "none" | "low" | "normal" | "high";

/** A person's role inside one class. Owners and admins can post work. */
export type MemberRole = "owner" | "admin" | "member";

/** One file on an assignment. */
export type AttachedFile = {
  /** Storage object path, so an edit can keep or remove it. */
  path: string;
  /** The name it was uploaded with, for display. */
  name: string;
  /** Signed URL to open it, or null if it could not be signed. Expires; refreshed on every load. */
  url: string | null;
};

export type Assignment = {
  id: string;
  classId: string;
  /** Subject display name, denormalised onto the assignment. */
  subject: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD`, or empty when the poster used a note instead of a date. */
  dueDate: string;
  /** Shown in place of a date when there is no deadline. Null when there is a date. */
  dueNote: string | null;
  priority: Priority;
  /** Files posted with it, in the order they were added. */
  attachments: AttachedFile[];
  /** The subject's teacher, when one is set. */
  teacher?: string;
  /** The subject's colour, `#rrggbb`. */
  subjectColor?: string;
  /** Display name of whoever posted it. */
  postedBy?: string | null;
};

/**
 * An assignment as an owner or admin sees it: archived ones included, plus what
 * the edit form needs.
 */
export type ManagedAssignment = Assignment & {
  subjectId: string;
  active: boolean;
};

/** A class the signed-in person belongs to. */
export type ClassInfo = {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  /** The signed-in person's role in it. */
  role: MemberRole;
};

export type Member = {
  userId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
};

export type SubjectInfo = {
  id: string;
  classId: string;
  name: string;
  /** Who teaches it. Empty when not set. */
  teacher: string;
  /** `#rrggbb`, or empty when none was chosen (see `subjectColor()`). */
  color: string;
  active: boolean;
};

/** The three states any async read can be in. */
export type Loadable<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function canManage(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};
