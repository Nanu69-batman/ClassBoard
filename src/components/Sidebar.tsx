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
 * Only Assignments is listed, which is what student navigation is: a class
 * switcher, search and filters (§25). It deliberately does not read auth state
 * — students have no account, and pulling the Firebase SDK into the dashboard
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
          <NavLink to="/" className="nav__item nav__item--active" end onClick={onClose} ref={navRef}>
            <DocumentIcon size={19} />
            Assignments
          </NavLink>
        </nav>
      </aside>
    </>
  );
}
