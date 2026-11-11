/**
 * Assignment files in Supabase Storage.
 *
 * The browser checks size and type first so a CR gets an instant, specific
 * message — but the bucket enforces the same limits server-side (see the
 * migration), so editing this file does not let anything bigger through. The
 * bucket is private: only members of the class can read a file.
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
    return `"${file.name}" is not a supported type. Use PDF, PowerPoint, Word, Excel, text or an image.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `"${file.name}" is larger than 25 MB.`;
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
export async function removeAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  if (error) console.error("[classboard] could not remove attachments", error);
}

/** How long a file link stays valid. Lists refetch on every change, renewing them. */
const SIGNED_URL_SECONDS = 60 * 60 * 6;

/**
 * Signed URLs for a batch of object paths, in one request. The bucket is
 * private, so this is the only way to open a file; Storage checks that the
 * caller is a member of the file's class.
 */
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);

  if (error) {
    console.error("[classboard] could not sign attachment links", error);
    return result;
  }

  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl);
  }
  return result;
}
