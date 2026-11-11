import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AddClassDialog, type AddClassMode } from "../components/AddClassDialog";
import { Avatar } from "../components/Avatar";
import { Brand } from "../components/Brand";
import { HomeIcon, PlusIcon } from "../components/icons";
import { CampusIllustration } from "../components/illustrations";
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
      {/*
        One nav, two widths. On a wide screen every item shows its label; below
        that the labels hide and it collapses to a rail of icons and initials.
        The accessible names are on the links themselves, so nothing changes for
        a screen reader between the two.
      */}
      <nav className="rail" aria-label="Your classes">
        <NavLink to="/app" end className="rail__brand" aria-label="Classboard home">
          <Brand size={24} />
        </NavLink>

        <NavLink to="/app" end className="rail__item" title="Home">
          <span className="rail__icon" aria-hidden="true">
            <HomeIcon size={20} />
          </span>
          <span className="rail__label">Home</span>
        </NavLink>

        <span className="rail__divider" aria-hidden="true" />
        <p className="rail__heading">Classes</p>

        <ul className="rail__classes">
          {(classes.data ?? []).map((each) => (
            <li key={each.id}>
              <NavLink to={`/app/${each.id}`} className="rail__item" title={each.name}>
                <span className="rail__icon rail__icon--initials" aria-hidden="true">
                  {initials(each.name)}
                </span>
                <span className="rail__label">{each.name}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="rail__item rail__item--add"
              title="Create or join a class"
              onClick={() => openAddClass()}
            >
              <span className="rail__icon" aria-hidden="true">
                <PlusIcon size={20} />
              </span>
              <span className="rail__label">Create or join</span>
              <span className="sr-only">a class</span>
            </button>
          </li>
        </ul>

        <CampusIllustration className="rail__art" />

        <NavLink to="/app/account" className="rail__item rail__item--me" title={displayName}>
          <span className="rail__icon" aria-hidden="true">
            <Avatar name={displayName} size="sm" />
          </span>
          <span className="rail__label">
            {displayName}
            <span className="rail__sublabel">Account</span>
          </span>
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
