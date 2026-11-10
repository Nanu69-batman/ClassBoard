/**
 * React bindings for the CR's class data.
 *
 * A subscription is only opened once there is a class to open it for — a CR
 * with no class assigned costs no connection.
 */

import { useEffect, useState } from "react";

import { fetchClassForCr, subscribeToClassForCr } from "../data/crRepository";
import type { ClassInfo, CrAssignment, Loadable, SubjectInfo } from "../data/types";

const NO_CLASS: Loadable<ClassInfo | null> = { status: "ready", data: null, error: null };
const LOADING = { status: "loading", data: null, error: null } as const;
const NO_ASSIGNMENTS: Loadable<CrAssignment[]> = { status: "ready", data: [], error: null };
const NO_SUBJECTS: Loadable<SubjectInfo[]> = { status: "ready", data: [], error: null };

/** The CR's own class row. Null means they have no class assigned. */
export function useCrClass(classId: string | null | undefined) {
  const [state, setState] = useState<Loadable<ClassInfo | null>>(NO_CLASS);

  useEffect(() => {
    if (!classId) {
      setState(NO_CLASS);
      return;
    }

    let cancelled = false;
    setState(LOADING);

    void fetchClassForCr(classId).then((found) => {
      if (!cancelled) setState({ status: "ready", data: found, error: null });
    });

    return () => {
      cancelled = true;
    };
  }, [classId]);

  return state;
}

/** Every assignment (archived included) and subject in the CR's class, live. */
export function useCrClassData(classId: string | null | undefined) {
  const [assignments, setAssignments] = useState<Loadable<CrAssignment[]>>(NO_ASSIGNMENTS);
  const [subjects, setSubjects] = useState<Loadable<SubjectInfo[]>>(NO_SUBJECTS);

  useEffect(() => {
    if (!classId) {
      setAssignments(NO_ASSIGNMENTS);
      setSubjects(NO_SUBJECTS);
      return;
    }

    setAssignments(LOADING);
    setSubjects(LOADING);
    return subscribeToClassForCr(classId, setAssignments, setSubjects);
  }, [classId]);

  return { assignments, subjects };
}
