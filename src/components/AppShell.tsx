import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * The shared shell: sidebar, top bar, and the page body. Owns the mobile drawer
 * state so both halves of the shell stay in sync without threading props through
 * the tree.
 */
type AppShellProps = {
  children: ReactNode;
  /** Search lives in the top bar but belongs to the page, so the page owns it. */
  query: string;
  onQueryChange: (value: string) => void;
  /**
   * The class switcher, or null when there is no class to switch between — the
   * first-run picker and the unavailable-class notice pass null, since a
   * switcher with nothing to switch to is just noise.
   */
  switcher?: ReactNode;
};

export function AppShell({
  children,
  query,
  onQueryChange,
  switcher = null,
}: AppShellProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLAnchorElement>(null);
  const wasNavOpen = useRef(false);

  const close = useCallback(() => setIsNavOpen(false), []);

  // Move focus into the drawer when it opens and back to the menu button when it
  // closes, so keyboard users are never stranded off screen.
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
      if (event.key === "Escape") setIsNavOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isNavOpen]);

  return (
    <div className="app">
      <Sidebar isOpen={isNavOpen} onClose={close} navRef={navRef} />

      <div className="main">
        <TopBar
          query={query}
          onQueryChange={onQueryChange}
          isNavOpen={isNavOpen}
          onMenuClick={() => setIsNavOpen((value) => !value)}
          menuRef={menuRef}
          switcher={switcher}
        />

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
