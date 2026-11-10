/**
 * Turns the class feed subscription into React state.
 *
 * The subscription is torn down whenever the class changes, so switching
 * classes does not leave a stale feed running, and nothing subscribes at all
 * until there is a class to subscribe on.
 */

import { useEffect, useState } from "react";

import { subscribeToClassAssignments } from "../data/feed";
import type { Assignment, Loadable } from "../data/types";

const FEED_LOADING: Loadable<Assignment[]> = {
  status: "loading",
  data: null,
  error: null,
};

/**
 * One class's assignments, live. `null` classId means no class chosen yet, and
 * the result stays in its loading state rather than reporting a failure.
 */
export function useClassAssignments(classId: string | null) {
  const [state, setState] = useState<Loadable<Assignment[]>>(FEED_LOADING);

  useEffect(() => {
    setState(FEED_LOADING);
    if (!classId) return;
    return subscribeToClassAssignments(classId, setState);
  }, [classId]);

  return state;
}
