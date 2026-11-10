/**
 * Writing a class's assignments and subjects, as an owner or admin.
 *
 * Row-level security refuses all of this for a plain member. `created_by`,
 * `posted_by_name`, `created_at` and `subject_name` are stamped by a database
 * trigger and pinned on update, so nothing below sends them.
 *
 * `update()` only sends the columns the form owns, so nothing else is
 * overwritten by an edit.
 */

import { supabase } from "../lib/supabase";
import { removeAttachment, uploadAttachment } from "./attachments";
import type { ManagedAssignment, Priority } from "./types";

/** Everything the form collects: subject, title and a due date (or note). */
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
 * exists; members never see a row pointing at a file that is not there yet. If
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
  assignment: ManagedAssignment,
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
 * Soft delete. `active: false` rather than a removal, so an accidental
 * click is recoverable. The file is kept, so restoring brings it back too.
 */
export async function setAssignmentActive(assignmentId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("assignments").update({ active }).eq("id", assignmentId);
  if (error) throw error;
}

export async function addSubject(classId: string, name: string): Promise<void> {
  const { error } = await supabase.from("subjects").insert({ class_id: classId, name: name.trim() });
  if (error) throw error;
}

/** Archived subjects stay on old assignments but are not offered for new ones. */
export async function setSubjectActive(subjectId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("subjects").update({ active }).eq("id", subjectId);
  if (error) throw error;
}
