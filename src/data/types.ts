/**
 * The shapes the UI renders.
 *
 * Deliberately separate from the database row shape. An assignment row is
 * `{ subject_id, subject_name, title, ..., attachment_path }`; the card wants
 * `{ subject, title, ..., attachment }`. Mapping once, in `rows.ts`, means the
 * components never learn a column name that only the backend uses — and a
 * schema rename does not ripple into the UI.
 */

/**
 * How urgent the work is, as chosen by the CR.
 *
 * `none` is the default and means "no priority was set" — the absence of a claim
 * rather than a low level of urgency. It is a real value rather than `null` so
 * that a document always has an explicit priority field, which keeps the
 * student-facing card from having to guess whether the field is meaningful.
 */
export type Priority = "none" | "low" | "normal" | "high";

export type Assignment = {
  id: string;
  /** Owning class (`assignments.class_id`). */
  classId: string;
  /** Subject display name, denormalised onto the assignment by the CR. */
  subject: string;
  title: string;
  description: string;
  /**
   * ISO date string, `YYYY-MM-DD`. Date only, no time component.
   *
   * Empty when the CR deliberately posted work with no deadline. Empty is not the
   * same as missing: a document with no due date at all is malformed data, and
   * this is a real choice the CR made, so the two are told apart in the document
   * by the presence of `dueNote`.
   */
  dueDate: string;
  /**
   * A short standing note shown in place of a date when there is no deadline —
   * "No deadline for now", "Reading for next week". Null when there *is* a date,
   * so a card never shows a date and a note at once.
   */
  dueNote: string | null;
  priority: Priority;
  /** Public URL of the attached file, or null. Never the file bytes. */
  attachment: string | null;
  /** The file's original name, for display. Null when there is no file. */
  attachmentName?: string | null;
  /**
   * Display name of whoever posted this, published deliberately onto the document
   * so a student can see who set the work without an account.
   *
   * Optional because a document may not carry it: the repository yields null when
   * it is absent, and the sample fixtures omit it. Consumers must treat a missing
   * value as "unknown" rather than rendering it.
   */
  postedBy?: string | null;
};

export type ClassInfo = {
  id: string;
  name: string;
  batch: string;
  section: string;
  displayName: string;
  active: boolean;
};

/**
 * An assignment as its class representative sees it.
 *
 * The student view never reads `active` — the feed is filtered before it reaches
 * the card — but a CR does, because a soft-deleted assignment has to stay visible
 * and restorable for them (§18). So the CR gets its own type, rather than the
 * student one carrying a field nothing on that side reads.
 */
export type CrAssignment = Assignment & {
  /**
   * The subject's row id, as distinct from `subject` which is the
   * denormalised display name. The edit form needs the id to preselect the right
   * subject; the student card only ever shows the name.
   */
  subjectId: string;
  /** Storage object path, so an edit can replace or remove the file. */
  attachmentPath: string | null;
  active: boolean;
  /** Optional address a CR publishes for submissions. Never a user's account email. */
  contactEmail: string | null;
};

export type SubjectInfo = {
  id: string;
  classId: string;
  name: string;
  shortName: string;
  active: boolean;
};

/** The three states any async read can be in. Loading and error are not optional. */
export type Loadable<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };
