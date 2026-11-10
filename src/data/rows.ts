/**
 * Database rows → the shapes the UI renders.
 *
 * Shared by the student feed and the CR repository so the two can never map the
 * same column differently. Every mapper is defensive: a malformed value becomes
 * a safe default rather than a crash on a student's phone.
 */

import { ATTACHMENTS_BUCKET, supabase } from "../lib/supabase";
import type { Assignment, ClassInfo, CrAssignment, Priority, SubjectInfo } from "./types";

const PRIORITIES: Priority[] = ["none", "low", "normal", "high"];

/** Columns the student feed reads. Never `created_by`. */
export const ASSIGNMENT_PUBLIC_COLUMNS =
  "id, class_id, subject_name, title, description, due_date, due_note, priority, attachment_path, attachment_name, posted_by_name";

/** Columns the CR dashboard reads. */
export const ASSIGNMENT_CR_COLUMNS = `${ASSIGNMENT_PUBLIC_COLUMNS}, subject_id, active, contact_email`;

export const CLASS_COLUMNS = "id, name, batch, section, display_name, active";

export const SUBJECT_COLUMNS = "id, class_id, name, short_name, active";

type Row = Record<string, unknown>;

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "none";
}

/** Postgres `date` arrives as `YYYY-MM-DD`; anything else means "no date". */
function toDueDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function toDueNote(value: unknown, dueDate: string): string | null {
  if (dueDate || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

/** The public URL of a stored file. The bucket is public-read for students. */
export function attachmentUrl(path: string): string {
  return supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function toClassInfo(row: Row): ClassInfo {
  const id = toText(row.id);
  return {
    id,
    name: toText(row.name),
    batch: toText(row.batch),
    section: toText(row.section),
    displayName: toText(row.display_name) || id,
    active: row.active === true,
  };
}

export function toSubject(row: Row): SubjectInfo {
  const id = toText(row.id);
  return {
    id,
    classId: toText(row.class_id),
    name: toText(row.name, id),
    shortName: toText(row.short_name),
    active: row.active === true,
  };
}

export function toAssignment(row: Row): Assignment {
  const dueDate = toDueDate(row.due_date);
  const path = typeof row.attachment_path === "string" && row.attachment_path ? row.attachment_path : null;

  return {
    id: toText(row.id),
    classId: toText(row.class_id),
    subject: toText(row.subject_name, "General"),
    title: toText(row.title, "Untitled assignment"),
    description: toText(row.description),
    dueDate,
    dueNote: toDueNote(row.due_note, dueDate),
    priority: toPriority(row.priority),
    attachment: path ? attachmentUrl(path) : null,
    attachmentName: path ? toText(row.attachment_name) || path.split("/").pop() || "Attachment" : null,
    postedBy: typeof row.posted_by_name === "string" ? row.posted_by_name : null,
  };
}

export function toCrAssignment(row: Row): CrAssignment {
  return {
    ...toAssignment(row),
    subjectId: toText(row.subject_id),
    attachmentPath: typeof row.attachment_path === "string" && row.attachment_path ? row.attachment_path : null,
    active: row.active === true,
    contactEmail: typeof row.contact_email === "string" ? row.contact_email : null,
  };
}
