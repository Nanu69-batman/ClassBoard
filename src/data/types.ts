/**
 * The shapes the UI renders.
 *
 * Deliberately separate from the database row shape. An assignment row is
 * `{ subject_id, subject_name, title, ..., attachment_path }`; the card wants
 * `{ subject, title, ..., attachment }`. Mapping once, in `rows.ts`, means the
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
  /** Signed URL of the attached file, or null. Expires; refreshed on every load. */
  attachment: string | null;
  attachmentName?: string | null;
  /** Display name of whoever posted it. */
  postedBy?: string | null;
};

/**
 * An assignment as an owner or admin sees it: archived ones included, plus what
 * the edit form needs.
 */
export type ManagedAssignment = Assignment & {
  subjectId: string;
  /** Storage object path, so an edit can replace or remove the file. */
  attachmentPath: string | null;
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
