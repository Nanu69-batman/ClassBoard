import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AddClassDialog, type AddClassMode } from "../components/AddClassDialog";
import { Avatar } from "../components/Avatar";
import { HomeIcon, PlusIcon } from "../components/icons";
import { subscribeToMyClasses } from "../data/classes";
import type { ClassInfo, Loadable } from "../data/types";

export type AppContext = {
  classes: Loadable<ClassInfo[]>;
  openAddClass: (mode?: AddClassMode) => void;
};

const LOADING: Loadable<ClassInfo[]> = { status: "loading", data: null, error: null };

/**
 * The signed-in app: a rail of your classes down the left (like a server list),
 * and the selected page beside it.
 */
export function AppLayout() {
  const { user, displayName } = useAuth();
  const userId = user?.id ?? null;

  const [classes, setClasses] = useState<Loadable<ClassInfo[]>>(LOADING);
  const [dialogMode, setDialogMode] = useState<AddClassMode | null>(null);

  useEffect(() => {
    if (!userId) return;
    setClasses(LOADING);
    return subscribeToMyClasses(userId, setClasses);
  }, [userId]);

  const openAddClass = useCallback((mode: AddClassMode = "choose") => setDialogMode(mode), []);

  const context: AppContext = { classes, openAddClass };

  return (
    <div className="workspace">
      <nav className="rail" aria-label="Your classes">
        <NavLink to="/app" end className="rail__item rail__item--home" aria-label="Home" title="Home">
          <HomeIcon size={22} />
        </NavLink>

        <span className="rail__divider" aria-hidden="true" />

        <ul className="rail__classes">
          {(classes.data ?? []).map((each) => (
            <li key={each.id}>
              <NavLink
                to={`/app/${each.id}`}
                className="rail__item"
                aria-label={each.name}
                title={each.name}
              >
                <span className="rail__initials" aria-hidden="true">
                  {initials(each.name)}
                </span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="rail__item rail__item--add"
              aria-label="Create or join a class"
              title="Create or join a class"
              onClick={() => openAddClass()}
            >
              <PlusIcon size={22} />
            </button>
          </li>
        </ul>

        <NavLink to="/app/account" className="rail__item rail__item--me" aria-label="Your account" title={displayName}>
          <Avatar name={displayName} />
        </NavLink>
      </nav>

      <div className="workspace__main">
        <Outlet context={context} />
      </div>

      <AddClassDialog mode={dialogMode} onModeChange={setDialogMode} />
    </div>
  );
}

export function useAppContext(): AppContext {
  return useOutletContext<AppContext>();
}

/** "ECE 2026 Section A" → "EA". Up to two letters, from the first and last words. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
