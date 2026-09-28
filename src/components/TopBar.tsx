import type { ReactNode, RefObject } from "react";

import { MenuIcon, SearchIcon } from "./icons";

type TopBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  isNavOpen: boolean;
  onMenuClick: () => void;
  menuRef: RefObject<HTMLButtonElement | null>;
  /** The class switcher, rendered between the brand and the search field. */
  switcher?: ReactNode;
};

/** Top bar: menu button and brand (small screens), class switcher, search. */
export function TopBar({
  query,
  onQueryChange,
  isNavOpen,
  onMenuClick,
  menuRef,
  switcher = null,
}: TopBarProps) {
  return (
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
          <MenuIcon size={22} />
        </button>

        <p className="topbar__brand">classboard</p>

        {switcher}

        <div className="topbar__search">
          <SearchIcon size={19} />
          <label className="sr-only" htmlFor="assignment-search">
            Search assignments
          </label>
          <input
            id="assignment-search"
            className="search-input"
            type="search"
            value={query}
            placeholder="Search assignments..."
            autoComplete="off"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>
    </header>
  );
}
