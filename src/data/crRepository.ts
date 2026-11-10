/**
 * Reading and writing a class as its CR (or as a superadmin).
 *
 * The student side is read-only and lives in `feed.ts`. This is the other half.
 *
 * ## Why the CR's reads carry no `active` filter
 *
 * Row-level security returns every row of the caller's own class to an active
 * CR of an active class, archived ones included, so the dashboard can show and
 * restore them. A student asking the same question gets active rows only.
 *
 * ## What the client does not get to choose
 *
 * `created_by`, `posted_by_name`, `created_at` and `subject_name` are stamped by
 * a database trigger from the caller's own profile and the subject row, and are
 * pinned on update. Nothing below sends them; sending them would change nothing.
 *
 * ## Updates touch only the fields the form owns
 *
 * §17: do not silently overwrite unrelated fields. `update()` only sends the
 * listed columns, so `contact_email` and anything else survive an edit.
 */

import { supabase } from "../lib/supabase";
import { removeAttachment, uploadAttachment } from "./attachments";
import { watchClass } from "./feed";
import {
  ASSIGNMENT_CR_COLUMNS,
  CLASS_COLUMNS,
  SUBJECT_COLUMNS,
  toClassInfo,
  toCrAssignment,
  toSubject,
} from "./rows";
import type { ClassInfo, CrAssignment, Loadable, Priority, SubjectInfo } from "./types";

/**
 * Every assignment and subject in the class, kept fresh.
 *
 * One subscription for both, because both tables ping the same `class:<id>`
 * topic and a client should hold one channel per topic.
 */
export function subscribeToClassForCr(
  classId: string,
  onAssignments: (state: Loadable<CrAssignment[]>) => void,
  onSubjects: (state: Loadable<SubjectInfo[]>) => void,
): () => void {
  let latest = 0;
  let closed = false;

  async function load() {
    const ticket = ++latest;
    const [assignments, subjects] = await Promise.all([
      supabase.from("assignments").select(ASSIGNMENT_CR_COLUMNS).eq("class_id", classId),
      supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", classId).order("name"),
    ]);

    if (closed || ticket !== latest) return;

    if (assignments.error) {
      console.error("[classboard] CR assignment list failed", assignments.error);
      onAssignments({ status: "error", data: null, error: "Could not load your assignments." });
    } else {
      onAssignments({ status: "ready", data: (assignments.data ?? []).map(toCrAssignment), error: null });
    }

    if (subjects.error) {
      console.error("[classboard] subject list failed", subjects.error);
      onSubjects({ status: "error", data: null, error: "Could not load your subjects." });
    } else {
      onSubjects({ status: "ready", data: (subjects.data ?? []).map(toSubject), error: null });
    }
  }

  const stop = watchClass(classId, load);
  return () => {
    closed = true;
    stop();
  };
}

/** The class row as a CR may read it — active or not, since they own it. */
export async function fetchClassForCr(classId: string): Promise<ClassInfo | null> {
  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("id", classId)
    .maybeSingle();

  if (error || !data) return null;
  return toClassInfo(data);
}

/** Everything the form collects. §16: subject, title and a due date (or note). */
export type AssignmentDraft = {
  subjectId: string;
  title: string;
  description: string;
  /** Empty when the CR chose a standing note instead of a date. */
  dueDate: string;
  /** Shown in place of the date. Empty when there is a real date. */
  dueNote: string;
  priority: Priority;
};

/** What should happen to the assignment's file on save. */
export type AttachmentChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; file: File };

/** The due columns: exactly one of the two is ever non-null (a table CHECK too). */
function dueColumns(draft: AssignmentDraft) {
  return draft.dueDate
    ? { due_date: draft.dueDate, due_note: null }
    : { due_date: null, due_note: draft.dueNote || "No deadline for now" };
}

function draftColumns(draft: AssignmentDraft) {
  return {
    subject_id: draft.subjectId || null,
    title: draft.title,
    description: draft.description,
    priority: draft.priority,
    ...dueColumns(draft),
  };
}

/**
 * Posts a new assignment, uploading its file first when there is one.
 *
 * The id is minted here so the file can be stored under it before the row
 * exists; students never see a row pointing at a file that is not there yet. If
 * the insert fails, the uploaded file is removed again.
 */
export async function createAssignment(
  classId: string,
  draft: AssignmentDraft,
  attachment: AttachmentChange,
): Promise<string> {
  const id = crypto.randomUUID();

  let path: string | null = null;
  let name: string | null = null;
  if (attachment.kind === "replace") {
    path = await uploadAttachment(classId, id, attachment.file);
    name = attachment.file.name.slice(0, 200);
  }

  const { error } = await supabase.from("assignments").insert({
    id,
    class_id: classId,
    ...draftColumns(draft),
    attachment_path: path,
    attachment_name: name,
    active: true,
  });

  if (error) {
    await removeAttachment(path);
    throw error;
  }

  return id;
}

/**
 * Applies an edit to the fields the form owns, plus the file change.
 *
 * The old file is removed only after the row points away from it, so a failed
 * save never leaves an assignment linking to a deleted file.
 */
export async function updateAssignment(
  assignment: CrAssignment,
  draft: AssignmentDraft,
  attachment: AttachmentChange,
): Promise<void> {
  let fileColumns: { attachment_path: string | null; attachment_name: string | null } | null = null;
  let uploaded: string | null = null;

  if (attachment.kind === "replace") {
    uploaded = await uploadAttachment(assignment.classId, assignment.id, attachment.file);
    fileColumns = { attachment_path: uploaded, attachment_name: attachment.file.name.slice(0, 200) };
  } else if (attachment.kind === "remove") {
    fileColumns = { attachment_path: null, attachment_name: null };
  }

  const { error } = await supabase
    .from("assignments")
    .update({ ...draftColumns(draft), ...(fileColumns ?? {}) })
    .eq("id", assignment.id);

  if (error) {
    await removeAttachment(uploaded);
    throw error;
  }

  if (fileColumns && assignment.attachmentPath) {
    await removeAttachment(assignment.attachmentPath);
  }
}

/**
 * Soft delete, per §18. `active: false` rather than a removal, so an accidental
 * click is recoverable. The file is kept, so restoring brings it back too.
 */
export async function setAssignmentActive(assignmentId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("assignments").update({ active }).eq("id", assignmentId);
  if (error) throw error;
}
