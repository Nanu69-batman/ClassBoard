/**
 * Reading the student feed from Supabase.
 *
 * Students have no account; they read as the `anon` role, and row-level
 * security only ever returns active assignments of active classes to them. The
 * `active` filters below are therefore belt-and-braces, not the boundary.
 *
 * ## How "live" works
 *
 * Firestore pushed whole documents. Here, every write to a class's assignments
 * pings a public broadcast topic `class:<id>` carrying no data (see
 * `notify_class_change` in the migration), and the feed refetches through RLS.
 * A plain postgres-changes subscription would not do: it filters by RLS on the
 * *new* row, so a student would never hear that an assignment was archived.
 */

import { supabase } from "../lib/supabase";
import { ASSIGNMENT_PUBLIC_COLUMNS, CLASS_COLUMNS, toAssignment, toClassInfo } from "./rows";
import type { Assignment, ClassInfo, Loadable } from "./types";

/**
 * Calls `load` now and again whenever the class's topic says something changed.
 * Late results from a superseded load are dropped, so a slow response can never
 * overwrite a newer one. Returns the unsubscribe function.
 */
export function watchClass(classId: string, load: () => Promise<void>): () => void {
  const channel = supabase
    .channel(`class:${classId}`)
    .on("broadcast", { event: "changed" }, () => void load())
    .subscribe((status) => {
      // A reconnect may have missed pings; catch up.
      if (status === "SUBSCRIBED") void load();
    });

  void load();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** One class's active assignments, kept fresh. */
export function subscribeToClassAssignments(
  classId: string,
  onChange: (state: Loadable<Assignment[]>) => void,
): () => void {
  let latest = 0;
  let closed = false;

  async function load() {
    const ticket = ++latest;
    const { data, error } = await supabase
      .from("assignments")
      .select(ASSIGNMENT_PUBLIC_COLUMNS)
      .eq("class_id", classId)
      .eq("active", true);

    if (closed || ticket !== latest) return;

    if (error) {
      console.error("[classboard] assignment feed failed", error);
      onChange({
        status: "error",
        data: null,
        error: "Could not load assignments. Check your connection and try again.",
      });
      return;
    }

    onChange({ status: "ready", data: (data ?? []).map(toAssignment), error: null });
  }

  const stop = watchClass(classId, load);
  return () => {
    closed = true;
    stop();
  };
}

/**
 * The class behind a shared link, or null if it cannot be shown.
 *
 * RLS hides an inactive class from anonymous readers, so "deactivated", "never
 * existed" and "bad link" all come back as no row, and the caller shows one
 * message for all of them.
 */
export async function fetchClass(classId: string): Promise<ClassInfo | null> {
  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("id", classId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return toClassInfo(data);
}
