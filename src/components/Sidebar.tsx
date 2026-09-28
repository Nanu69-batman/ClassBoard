import type { RefObject } from "react";
import { NavLink } from "react-router-dom";

import { DocumentIcon } from "./icons";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Focused when the drawer opens, so keyboard users land inside it. */
  navRef: RefObject<HTMLAnchorElement | null>;
};

/**
 * Fixed sidebar on large screens, slide-in drawer on small ones.
 *
 * A class dashboard is one page reached by link, so there is nothing to navigate
 * between inside it — only the way back out. It deliberately does not read auth
 * state: students have no account, and pulling the auth SDK into the dashboard
 * just to render one conditional link would cost every student that download.
 * Privileged surfaces carry their own navigation.
 */
export function Sidebar({ isOpen, onClose, navRef }: SidebarProps) {
  return (
    <>
      <div
        className={`nav-backdrop${isOpen ? " nav-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={`sidebar${isOpen ? " sidebar--open" : ""}`}
        aria-label="Navigation"
      >
        <p className="brand">classboard</p>

        <nav className="nav" aria-label="Main">
          <NavLink to="/" className="nav__item" end onClick={onClose} ref={navRef}>
            <DocumentIcon size={19} />
            Home
          </NavLink>
        </nav>
      </aside>
    </>
  );
}
