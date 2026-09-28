import { useEffect, useRef, type ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { DocumentIcon } from "./icons";

export type NavItem = {
  id: string;
  label: string;
};

type PrivilegedShellProps = {
  /** Shown next to the wordmark, e.g. "CR dashboard". */
  areaLabel: string;
  /** Second line: which class or scope this area covers. */
  contextLabel: string;
  navItems: NavItem[];
  activeSection: string;
  onSelectSection: (id: string) => void;
  isNavOpen: boolean;
  onMenuClick: () => void;
  children: ReactNode;
};

/**
 * Shell for /cr and /admin. Same design system as the student dashboard, but
 * with role-specific navigation (§25).
 *
 * Navigation is in-page section state rather than routes, because §24 defines
 * exactly five routes and adding sub-routes for sections would contradict it.
 */
export function PrivilegedShell({
  areaLabel,
  contextLabel,
  navItems,
  activeSection,
  onSelectSection,
  isNavOpen,
  onMenuClick,
  children,
}: PrivilegedShellProps) {
  const { user, profile, signOut } = useAuth();
  const menuRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLButtonElement>(null);
  const wasNavOpen = useRef(false);

  useEffect(() => {
    if (isNavOpen) {
      navRef.current?.focus();
    } else if (wasNavOpen.current) {
      menuRef.current?.focus();
    }
    wasNavOpen.current = isNavOpen;
  }, [isNavOpen]);

  useEffect(() => {
    if (!isNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMenuClick();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isNavOpen, onMenuClick]);

  const close = () => {
    if (isNavOpen) onMenuClick();
  };

  return (
    <div className="app">
      <div
        className={`nav-backdrop${isNavOpen ? " nav-backdrop--open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={`sidebar${isNavOpen ? " sidebar--open" : ""}`}
        aria-label="Navigation"
      >
        <p className="brand">classboard</p>

        <nav className="nav" aria-label="Main">
          <NavLink to="/" className="nav__item" onClick={close} end>
            <DocumentIcon size={19} />
            Student dashboard
          </NavLink>
        </nav>

        <p className="nav__heading">{areaLabel}</p>
        <nav className="nav" aria-label={areaLabel}>
          {navItems.map((item) => (
            <button
              key={item.id}
              ref={item.id === navItems[0]?.id ? navRef : undefined}
              type="button"
              className={`nav__item nav__item--plain${activeSection === item.id ? " nav__item--active" : ""}`}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => {
                onSelectSection(item.id);
                close();
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="nav__footer">
          <p className="nav__identity">{profile?.displayName ?? user?.email ?? "Signed in"}</p>
          <button type="button" className="nav__item nav__item--plain" onClick={() => void signOut()}>
            Logout
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__inner">
            <button
              ref={menuRef}
              type="button"
              className="menu-button"
              aria-label="Open menu"
              aria-expanded={isNavOpen}
              aria-controls="app-sidebar"
              onClick={onMenuClick}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <p className="topbar__brand">classboard</p>

            <p className="topbar__context">{contextLabel}</p>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
