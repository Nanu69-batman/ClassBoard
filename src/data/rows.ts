/**
 * Database rows → the shapes the UI renders.
 *
 * Every mapper is defensive: a malformed value becomes a safe default rather
 * than a crash.
 */

import type {
  Assignment,
  ClassInfo,
  ManagedAssignment,
  Member,
  MemberRole,
  Priority,
  SubjectInfo,
} from "./types";

const PRIORITIES: Priority[] = ["none", "low", "normal", "high"];
const ROLES: MemberRole[] = ["owner", "admin", "member"];

/** Columns every member reads. Never `created_by`. */
export const ASSIGNMENT_COLUMNS =
  "id, class_id, subject_id, subject_name, title, description, due_date, due_note, priority, attachment_path, attachment_name, posted_by_name, active";

export const SUBJECT_COLUMNS = "id, class_id, name, active";

type Row = Record<string, unknown>;

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "none";
}

export function toRole(value: unknown): MemberRole {
  return ROLES.includes(value as MemberRole) ? (value as MemberRole) : "member";
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

/** A `classes` row joined with the caller's membership role. */
export function toClassInfo(row: Row, role: unknown): ClassInfo {
  return {
    id: toText(row.id),
    name: toText(row.name, "Untitled class"),
    description: toText(row.description),
    inviteCode: toText(row.invite_code),
    role: toRole(role),
  };
}

export function toMember(row: Row): Member {
  const profile = (row.profiles ?? {}) as Row;
  return {
    userId: toText(row.user_id),
    displayName: toText(profile.display_name, "Unknown"),
    role: toRole(row.role),
    joinedAt: toText(row.joined_at),
  };
}

export function toSubject(row: Row): SubjectInfo {
  const id = toText(row.id);
  return {
    id,
    classId: toText(row.class_id),
    name: toText(row.name, id),
    active: row.active === true,
  };
}

export function attachmentPathOf(row: Row): string | null {
  return typeof row.attachment_path === "string" && row.attachment_path ? row.attachment_path : null;
}

/** `signedUrls` maps object path → signed URL, fetched in one batch by the caller. */
export function toAssignment(row: Row, signedUrls: Map<string, string>): ManagedAssignment {
  const dueDate = toDueDate(row.due_date);
  const path = attachmentPathOf(row);

  const base: Assignment = {
    id: toText(row.id),
    classId: toText(row.class_id),
    subject: toText(row.subject_name, "General"),
    title: toText(row.title, "Untitled assignment"),
    description: toText(row.description),
    dueDate,
    dueNote: toDueNote(row.due_note, dueDate),
    priority: toPriority(row.priority),
    attachment: path ? (signedUrls.get(path) ?? null) : null,
    attachmentName: path ? toText(row.attachment_name) || path.split("/").pop() || "Attachment" : null,
    postedBy: typeof row.posted_by_name === "string" ? row.posted_by_name : null,
  };

  return {
    ...base,
    subjectId: toText(row.subject_id),
    attachmentPath: path,
    active: row.active === true,
  };
}
