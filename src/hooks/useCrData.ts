/**
 * React bindings for the CR's Firestore data.
 *
 * Deliberately thin: each one owns exactly one listener and nothing else, so the
 * subscription lifecycle is obvious. A listener is only opened once there is a
 * class to open it for — a CR with no class assigned costs no connection, and
 * cannot accidentally read a class they do not own.
 */

import { useEffect, useState } from "react";

import {
  fetchClassForCr,
  subscribeToClassAssignmentsForCr,
  subscribeToClassSubjectsForCr,
} from "../data/crRepository";
import type { ClassInfo, CrAssignment, Loadable, SubjectInfo } from "../data/types";

const NO_CLASS: Loadable<ClassInfo | null> = { status: "ready", data: null, error: null };
const NO_DATA: Loadable<CrAssignment[]> = { status: "ready", data: [], error: null };
const NO_SUBJECTS: Loadable<SubjectInfo[]> = { status: "ready", data: [], error: null };

/** The CR's own class document. Null means they have no class assigned. */
export function useCrClass(classId: string | null | undefined) {
  const [state, setState] = useState<Loadable<ClassInfo | null>>(NO_CLASS);

  useEffect(() => {
    if (!classId) {
      setState(NO_CLASS);
      return;
    }

    let cancelled = false;
    setState({ status: "loading", data: null, error: null });

    void fetchClassForCr(classId).then((found) => {
      if (!cancelled) setState({ status: "ready", data: found, error: null });
    });

    return () => {
      cancelled = true;
    };
  }, [classId]);

  return state;
}

/** Every assignment in the CR's class, archived included. */
export function useCrAssignments(classId: string | null | undefined) {
  const [state, setState] = useState<Loadable<CrAssignment[]>>(NO_DATA);

  useEffect(() => {
    if (!classId) {
      setState(NO_DATA);
      return;
    }

    return subscribeToClassAssignmentsForCr(classId, setState);
  }, [classId]);

  return state;
}

/** The CR's class subjects, for the form's subject dropdown. */
export function useCrSubjects(classId: string | null | undefined) {
  const [state, setState] = useState<Loadable<SubjectInfo[]>>(NO_SUBJECTS);

  useEffect(() => {
    if (!classId) {
      setState(NO_SUBJECTS);
      return;
    }

    return subscribeToClassSubjectsForCr(classId, setState);
  }, [classId]);

  return state;
}
