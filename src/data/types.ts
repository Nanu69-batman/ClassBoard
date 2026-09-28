/**
 * The shapes the UI renders.
 *
 * Deliberately separate from the Firestore document shape. A Firestore
 * assignment is `{ subjectId, subjectName, title, ..., attachmentUrl }`; the card
 * wants `{ subject, title, ..., attachment }`. Mapping once, in the repository,
 * means the components never learn a field name that only the backend uses — and
 * a backend rename does not ripple into the UI.
 */

export type Priority = "low" | "normal" | "high";

export type Assignment = {
  id: string;
  /**
   * Owning class. In Firestore this is implicit in the path
   * `classes/{classId}/assignments/{id}` and is not stored on the document; the
   * repository adds it so the privileged screens can scope by it.
   */
  classId: string;
  /** Subject display name, denormalised onto the assignment by the CR. */
  subject: string;
  title: string;
  description: string;
  /** ISO date string, `YYYY-MM-DD`. Date only, no time component. */
  dueDate: string;
  priority: Priority;
  /** Public URL of an attachment, or null. Never the file bytes. */
  attachment: string | null;
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
   * The subject's document id, as distinct from `subject` which is the
   * denormalised display name. The edit form needs the id to preselect the right
   * subject; the student card only ever shows the name.
   */
  subjectId: string;
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
