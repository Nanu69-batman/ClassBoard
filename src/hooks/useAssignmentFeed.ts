/**
 * Subscribes to a class's assignments and to the list of active classes.
 *
 * A thin wrapper over `src/data/feed.ts` that turns a push-based Firestore
 * listener into React state. The listener is torn down whenever the class
 * changes, so switching classes does not leave a stale feed running, and nothing
 * subscribes at all until there is a class to subscribe on.
 */

import { useEffect, useState } from "react";

import { subscribeToActiveClasses, subscribeToClassAssignments } from "../data/feed";
import type { Assignment, ClassInfo, Loadable } from "../data/types";

const CLASSES_LOADING: Loadable<ClassInfo[]> = {
  status: "loading",
  data: null,
  error: null,
};

const FEED_LOADING: Loadable<Assignment[]> = {
  status: "loading",
  data: null,
  error: null,
};

/** Every active class. Open for as long as the dashboard is mounted. */
export function useActiveClasses() {
  const [state, setState] = useState<Loadable<ClassInfo[]>>(CLASSES_LOADING);

  useEffect(() => subscribeToActiveClasses(setState), []);

  return state;
}

/**
 * One class's assignments, live. `null` classId means no class chosen yet, and
 * the result stays in its loading state rather than reporting a failure.
 */
export function useClassAssignments(classId: string | null) {
  const [state, setState] = useState<Loadable<Assignment[]>>(FEED_LOADING);

  useEffect(() => {
    if (!classId) {
      setState(FEED_LOADING);
      return;
    }

    setState(FEED_LOADING);
    return subscribeToClassAssignments(classId, setState);
  }, [classId]);

  return state;
}
