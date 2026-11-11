import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AddClassDialog, type AddClassMode } from "../components/AddClassDialog";
import { Avatar } from "../components/Avatar";
import { Brand } from "../components/Brand";
import { CloseIcon, HomeIcon, LinkIcon, MenuIcon, PlusIcon } from "../components/icons";
import { CampusIllustration } from "../components/illustrations";
import { subscribeToMyClasses } from "../data/classes";
import type { ClassInfo, Loadable } from "../data/types";
import { PHONE_QUERY, useHorizontalSwipe, useMediaQuery } from "../lib/gestures";

export type AppContext = {
  classes: Loadable<ClassInfo[]>;
  openAddClass: (mode?: AddClassMode) => void;
};

const LOADING: Loadable<ClassInfo[]> = { status: "loading", data: null, error: null };

/**
 * The signed-in app: the nav on the left and the selected page beside it.
 *
 * On a phone the nav leaves the page entirely. A top bar's menu button, or a
 * swipe from left to right, brings it back as a full-screen drawer with the
 * account and other shortcuts floating along the bottom.
 */
export function AppLayout() {
  const { user, displayName, signOut } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [classes, setClasses] = useState<Loadable<ClassInfo[]>>(LOADING);
  const [dialogMode, setDialogMode] = useState<AddClassMode | null>(null);

  const isPhone = useMediaQuery(PHONE_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!userId) return;
    setClasses(LOADING);
    return subscribeToMyClasses(userId, setClasses);
  }, [userId]);

  // Going anywhere closes the drawer, and so does growing out of phone size.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!isPhone) setDrawerOpen(false);
  }, [isPhone]);

  useHorizontalSwipe({
    enabled: isPhone,
    onSwipeRight: ({ overlayWasOpen }) => {
      if (!overlayWasOpen) setDrawerOpen(true);
    },
    onSwipeLeft: () => setDrawerOpen(false),
  });

  // While open: Escape closes, the page behind doesn't scroll, focus moves in
  // and comes back to the menu button afterwards.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (drawerOpen) {
      wasOpen.current = true;
      closeButtonRef.current?.focus();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") setDrawerOpen(false);
      };
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = overflow;
        document.removeEventListener("keydown", onKey);
      };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      menuButtonRef.current?.focus();
    }
  }, [drawerOpen]);

  const openAddClass = useCallback((mode: AddClassMode = "choose") => {
    setDrawerOpen(false);
    setDialogMode(mode);
  }, []);

  const context: AppContext = { classes, openAddClass };

  return (
    <div className="workspace">
      {/*
        One nav, three shapes. Wide: a labelled sidebar. Tablet: a rail of icons
        and initials, labels kept for screen readers. Phone: hidden until opened,
        then a full-screen drawer with the labels back.
      */}
      <nav id="app-nav" className={`rail${drawerOpen ? " rail--open" : ""}`} aria-label="Your classes">
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

        {/* Phone drawer only: shortcuts floating at the bottom of the screen. */}
        <div className="rail__dock">
          <NavLink to="/app/account" className="dock-button dock-button--profile">
            <Avatar name={displayName} size="sm" />
            <span className="dock-button__text">
              {displayName}
              <span className="dock-button__sub">Profile &amp; settings</span>
            </span>
          </NavLink>
          <button type="button" className="dock-button" onClick={() => openAddClass("join")}>
            <LinkIcon size={18} />
            Join
          </button>
          <button
            type="button"
            className="dock-button"
            onClick={() => void signOut().then(() => navigate("/", { replace: true }))}
          >
            Sign out
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="dock-button dock-button--round"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <CloseIcon size={20} />
          </button>
        </div>
      </nav>

      <div className="workspace__main" inert={drawerOpen}>
        {/* Phone only: the way into the drawer for anyone who doesn't swipe. */}
        <header className="topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="topbar__button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="app-nav"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon size={22} />
          </button>
          <NavLink to="/app" end className="topbar__brand" aria-label="Classboard home">
            <Brand size={20} />
          </NavLink>
          <NavLink to="/app/account" className="topbar__button" aria-label="Your account">
            <Avatar name={displayName} size="sm" />
          </NavLink>
        </header>

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
