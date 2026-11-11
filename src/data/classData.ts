/**
 * Everything one class page shows, loaded together and kept fresh.
 *
 * Row-level security decides what comes back: a member gets active assignments
 * and subjects; an owner or admin also gets archived ones. Completions are
 * always only the caller's own.
 */

import { supabase } from "../lib/supabase";
import { signedUrls } from "./attachments";
import { watchTopic } from "./realtime";
import { ASSIGNMENT_COLUMNS, SUBJECT_COLUMNS, attachmentPathsOf, toAssignment, toMember, toSubject } from "./rows";
import type { Loadable, ManagedAssignment, Member, SubjectInfo } from "./types";

export type ClassData = {
  assignments: ManagedAssignment[];
  subjects: SubjectInfo[];
  members: Member[];
  completedIds: Set<string>;
};

export function subscribeToClassData(
  classId: string,
  userId: string,
  onChange: (state: Loadable<ClassData>) => void,
): () => void {
  let latest = 0;
  let closed = false;

  async function load() {
    const ticket = ++latest;

    const [assignments, subjects, members, completions] = await Promise.all([
      supabase.from("assignments").select(ASSIGNMENT_COLUMNS).eq("class_id", classId),
      supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", classId).order("name"),
      supabase
        .from("class_members")
        .select("user_id, role, joined_at, profiles(display_name)")
        .eq("class_id", classId)
        .order("joined_at"),
      supabase.from("completions").select("assignment_id").eq("class_id", classId).eq("user_id", userId),
    ]);

    const failed = assignments.error ?? subjects.error ?? members.error ?? completions.error;
    if (failed) {
      if (closed || ticket !== latest) return;
      console.error("[classboard] class load failed", failed);
      onChange({
        status: "error",
        data: null,
        error: "Could not load this class. Check your connection and try again.",
      });
      return;
    }

    const rows = (assignments.data ?? []) as Record<string, unknown>[];
    const paths = rows.flatMap(attachmentPathsOf);
    const urls = await signedUrls(paths);

    if (closed || ticket !== latest) return;

    const subjectList = (subjects.data ?? []).map(toSubject);
    const teachers = new Map(subjectList.filter((each) => each.teacher).map((each) => [each.id, each.teacher]));

    onChange({
      status: "ready",
      error: null,
      data: {
        assignments: rows.map((row) => {
          const assignment = toAssignment(row, urls);
          const teacher = teachers.get(assignment.subjectId);
          return teacher ? { ...assignment, teacher } : assignment;
        }),
        subjects: subjectList,
        members: (members.data ?? []).map((row) => toMember(row as Record<string, unknown>)),
        completedIds: new Set((completions.data ?? []).map((row) => String(row.assignment_id))),
      },
    });
  }

  const stop = watchTopic(`class:${classId}`, () => void load());
  return () => {
    closed = true;
    stop();
  };
}

export async function setCompleted(assignmentId: string, done: boolean, userId: string): Promise<void> {
  if (done) {
    // class_id is filled in by a trigger from the assignment.
    const { error } = await supabase
      .from("completions")
      .upsert({ assignment_id: assignmentId, user_id: userId }, {
        onConflict: "user_id,assignment_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("completions")
      .delete()
      .eq("assignment_id", assignmentId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}
