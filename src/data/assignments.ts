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
import { removeAttachments, uploadAttachment } from "./attachments";
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

/**
 * What should happen to an assignment's files on save: the existing ones to
 * keep (any left out are deleted), and new ones to upload.
 */
export type FileChanges = {
  keep: StoredFile[];
  add: File[];
};

export type StoredFile = { path: string; name: string };

/** At most this many files on one assignment (the table checks it too). */
export const MAX_FILES = 10;

/**
 * Uploads every file, all or nothing: if one fails, the ones that made it are
 * removed again and the first error is thrown.
 */
async function uploadAll(classId: string, assignmentId: string, files: File[]): Promise<StoredFile[]> {
  const results = await Promise.allSettled(files.map((file) => uploadAttachment(classId, assignmentId, file)));
  const failed = results.find((each) => each.status === "rejected");
  if (failed) {
    await removeAttachments(results.flatMap((each) => (each.status === "fulfilled" ? [each.value] : [])));
    throw failed.reason;
  }
  return results.map((each, index) => ({
    path: (each as PromiseFulfilledResult<string>).value,
    name: files[index].name.slice(0, 200),
  }));
}

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
 * Posts a new assignment, uploading its files first.
 *
 * The id is minted here so the files can be stored under it before the row
 * exists; members never see a row pointing at a file that is not there yet. If
 * the insert fails, the uploaded files are removed again.
 */
export async function createAssignment(classId: string, draft: AssignmentDraft, files: File[]): Promise<string> {
  const id = crypto.randomUUID();
  const uploaded = await uploadAll(classId, id, files);

  const { error } = await supabase.from("assignments").insert({
    id,
    class_id: classId,
    ...draftColumns(draft),
    attachments: uploaded,
    active: true,
  });

  if (error) {
    await removeAttachments(uploaded.map((each) => each.path));
    throw error;
  }

  return id;
}

/**
 * Applies an edit to the fields the form owns, plus the file changes.
 *
 * Files dropped from the list are removed only after the row stops pointing at
 * them, so a failed save never leaves an assignment linking to a deleted file.
 */
export async function updateAssignment(
  assignment: ManagedAssignment,
  draft: AssignmentDraft,
  changes: FileChanges,
): Promise<void> {
  const uploaded = await uploadAll(assignment.classId, assignment.id, changes.add);

  const { error } = await supabase
    .from("assignments")
    .update({ ...draftColumns(draft), attachments: [...changes.keep, ...uploaded] })
    .eq("id", assignment.id);

  if (error) {
    await removeAttachments(uploaded.map((each) => each.path));
    throw error;
  }

  const kept = new Set(changes.keep.map((each) => each.path));
  await removeAttachments(assignment.attachments.map((each) => each.path).filter((path) => !kept.has(path)));
}

/**
 * Soft delete. `active: false` rather than a removal, so an accidental
 * click is recoverable. The file is kept, so restoring brings it back too.
 */
export async function setAssignmentActive(assignmentId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("assignments").update({ active }).eq("id", assignmentId);
  if (error) throw error;
}

export type SubjectDraft = { name: string; teacher: string };

export async function addSubject(classId: string, draft: SubjectDraft): Promise<void> {
  const { error } = await supabase
    .from("subjects")
    .insert({ class_id: classId, name: draft.name.trim(), teacher: draft.teacher.trim() });
  if (error) throw error;
}

/** Renaming also renames it on its assignments (a database trigger). */
export async function updateSubject(subjectId: string, draft: SubjectDraft): Promise<void> {
  const { error } = await supabase
    .from("subjects")
    .update({ name: draft.name.trim(), teacher: draft.teacher.trim() })
    .eq("id", subjectId);
  if (error) throw error;
}

/** Archived subjects stay on old assignments but are not offered for new ones. */
export async function setSubjectActive(subjectId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("subjects").update({ active }).eq("id", subjectId);
  if (error) throw error;
}
