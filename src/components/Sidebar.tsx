import type { RefObject } from "react";

import { DocumentIcon } from "./icons";

type SidebarProps = {
  /** Drawer state. Only meaningful below the large breakpoint. */
  isOpen: boolean;
  onClose: () => void;
  navRef: RefObject<HTMLButtonElement | null>;
};

/**
 * Fixed sidebar on large screens, slide-in drawer on small ones. It lists one
 * destination because Assignments is the only screen.
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
          <button
            ref={navRef}
            type="button"
            className="nav__item nav__item--active"
            aria-current="page"
            onClick={onClose}
          >
            <DocumentIcon size={19} />
            Assignments
          </button>
        </nav>
      </aside>
    </>
  );
}
