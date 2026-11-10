/**
 * Classes and membership: listing, creating, joining, managing.
 *
 * Anything that changes who holds which role goes through a database function
 * (see the migration), so the client cannot write a role or an invite code
 * directly — the grants do not even allow the attempt.
 */

import { supabase } from "../lib/supabase";
import { watchTopic } from "./realtime";
import { toClassInfo } from "./rows";
import type { ClassInfo, Loadable, MemberRole } from "./types";

/** Every class the person belongs to, oldest membership first, kept fresh. */
export function subscribeToMyClasses(
  userId: string,
  onChange: (state: Loadable<ClassInfo[]>) => void,
): () => void {
  let latest = 0;
  let closed = false;

  async function load() {
    const ticket = ++latest;
    const { data, error } = await supabase
      .from("class_members")
      .select("role, joined_at, classes(id, name, description, invite_code)")
      .eq("user_id", userId)
      .order("joined_at");

    if (closed || ticket !== latest) return;

    if (error) {
      console.error("[classboard] class list failed", error);
      onChange({ status: "error", data: null, error: "Could not load your classes." });
      return;
    }

    const classes = (data ?? [])
      .filter((row) => row.classes)
      .map((row) => toClassInfo(row.classes as unknown as Record<string, unknown>, row.role));
    onChange({ status: "ready", data: classes, error: null });
  }

  const stop = watchTopic(`user:${userId}`, () => void load());
  return () => {
    closed = true;
    stop();
  };
}

export async function createClass(name: string, description: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_class", {
    p_name: name.trim(),
    p_description: description.trim(),
  });
  if (error) throw error;
  return String(data);
}

export type ClassPreview = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isMember: boolean;
};

/** The class an invite code points at, or null when the code is not valid. */
export async function peekClass(code: string): Promise<ClassPreview | null> {
  const { data, error } = await supabase.rpc("peek_class", { p_code: code });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    memberCount: Number(row.member_count ?? 0),
    isMember: row.is_member === true,
  };
}

/** Joins by invite code and returns the class id. Joining twice is harmless. */
export async function joinClass(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_class", { p_code: code });
  if (error) throw error;
  return String(data);
}

/**
 * Pulls the code out of whatever was pasted: a bare code, or a full join link
 * such as `https://…/join/abcd23efgh`.
 */
export function parseInviteCode(input: string): string {
  const trimmed = input.trim();
  const fromLink = /\/join\/([A-Za-z0-9]+)/.exec(trimmed);
  return (fromLink ? fromLink[1] : trimmed).toLowerCase();
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export async function updateClass(classId: string, name: string, description: string): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ name: name.trim(), description: description.trim() })
    .eq("id", classId);
  if (error) throw error;
}

export async function regenerateInviteCode(classId: string): Promise<string> {
  const { data, error } = await supabase.rpc("regenerate_invite_code", { p_class: classId });
  if (error) throw error;
  return String(data);
}

export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) throw error;
}

/** Leaving (your own id) and kicking (someone else's) are the same delete. */
export async function removeMember(classId: string, userId: string): Promise<void> {
  const { error, count } = await supabase
    .from("class_members")
    .delete({ count: "exact" })
    .eq("class_id", classId)
    .eq("user_id", userId);
  if (error) throw error;
  // RLS turns a refused delete into "0 rows", not an error.
  if (count === 0) throw { code: "42501" };
}

export async function setMemberRole(classId: string, userId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase.rpc("set_member_role", {
    p_class: classId,
    p_user: userId,
    p_role: role,
  });
  if (error) throw error;
}
