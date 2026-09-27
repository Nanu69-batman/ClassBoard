import { useCallback, useEffect, useMemo, useState } from "react";

import { loadCompletedIds, saveCompletedIds } from "../utils/storage";

/**
 * Owns the student's completion state.
 *
 * State is read from localStorage once on startup and written back on every
 * change, so it survives refreshes and browser restarts.
 */
export function useAssignmentStatus() {
  const [completedIds, setCompletedIds] = useState<string[]>(loadCompletedIds);

  useEffect(() => {
    saveCompletedIds(completedIds);
  }, [completedIds]);

  const completedIdSet = useMemo(() => new Set(completedIds), [completedIds]);

  const isCompleted = useCallback(
    (id: string) => completedIdSet.has(id),
    [completedIdSet],
  );

  const toggleCompleted = useCallback((id: string) => {
    setCompletedIds((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    );
  }, []);

  return { completedIdSet, isCompleted, toggleCompleted };
}
