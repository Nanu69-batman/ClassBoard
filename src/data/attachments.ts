/**
 * Assignment files in Supabase Storage.
 *
 * The browser checks size and type first so a CR gets an instant, specific
 * message — but the bucket enforces the same limits server-side (see the
 * migration), so editing this file does not let anything bigger through.
 *
 * Objects live at `<class_id>/<assignment_id>/<file name>`. The first folder is
 * what the storage policies check against the caller's class.
 */

import { ATTACHMENTS_BUCKET, supabase } from "../lib/supabase";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Extension → content type. Sent explicitly because browsers often report an
 * empty type for .ppt/.pptx, which the bucket's MIME allow-list would reject.
 */
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** For the file input's `accept`. */
export const ACCEPTED_EXTENSIONS = Object.keys(CONTENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** A human-readable problem with the file, or null when it can be uploaded. */
export function validateAttachment(file: File): string | null {
  if (!CONTENT_TYPES[extensionOf(file.name)]) {
    return "That file type is not supported. Use PDF, PowerPoint, Word, Excel, text or an image.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "That file is larger than 25 MB.";
  return null;
}

/**
 * Storage keys are restricted, and a name like "Unit 1 – notes (final).pptx"
 * is common. Keep it readable but safe; the original name is stored separately
 * for display.
 */
function safeObjectName(name: string): string {
  const ext = extensionOf(name);
  const base = name.slice(0, name.length - (ext ? ext.length + 1 : 0));
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${cleaned || "file"}.${ext}`;
}

/** Uploads a file for an assignment and returns its object path. */
export async function uploadAttachment(
  classId: string,
  assignmentId: string,
  file: File,
): Promise<string> {
  const path = `${classId}/${assignmentId}/${Date.now()}-${safeObjectName(file.name)}`;

  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: CONTENT_TYPES[extensionOf(file.name)],
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;

  return path;
}

/** Best-effort removal. A leftover object costs storage, never correctness. */
export async function removeAttachment(path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
  if (error) console.error("[classboard] could not remove attachment", error);
}
