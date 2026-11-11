import { useEffect, useState } from "react";

import { subscribeToClassData, type ClassData } from "./classData";
import type { Loadable } from "./types";

const LOADING: Loadable<ClassData> = { status: "loading", data: null, error: null };

/**
 * A live view of one class: its assignments, subjects, members and your ticks.
 * Returns the setter too, so a page can fold a confirmed write in without
 * waiting for the realtime echo.
 */
export function useClassData(classId: string, userId: string) {
  const [data, setData] = useState<Loadable<ClassData>>(LOADING);

  useEffect(() => {
    if (!userId) return;
    setData(LOADING);
    return subscribeToClassData(classId, userId, setData);
  }, [classId, userId]);

  return [data, setData] as const;
}
