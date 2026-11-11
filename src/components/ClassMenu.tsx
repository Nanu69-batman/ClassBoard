import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { inviteLink } from "../data/classes";
import { canManage, type ClassInfo } from "../data/types";
import { DotsIcon, LinkIcon, SettingsIcon } from "./icons";

/** What the way into a class's settings is called: running it, or just its settings. */
export function manageLabel(info: ClassInfo): string {
  return canManage(info.role) ? "Manage class" : "Class settings";
}

const MENU_WIDTH = 216;
const GAP = 6;
const COPIED_MS = 1600;

type Props = {
  info: ClassInfo;
  /** Extra class on the trigger, for where it sits. */
  className?: string;
};

/**
 * The "⋯" on a class: copy its invite link, or go to its settings.
 *
 * The menu is positioned `fixed` from the button's on-screen box rather than
 * `absolute` inside it, because it opens from places that clip their overflow
 * (the sidebar's scrolling class list). It closes on Escape, Tab, a click
 * outside, scrolling and resizing; arrow keys move between the items.
 */
export function ClassMenu({ info, className = "" }: Props) {
  const navigate = useNavigate();
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  // Place it under the button, right edges aligned, kept inside the window.
  // Flips above the button when there's no room below.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const box = buttonRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 100;
    const below = box.bottom + GAP;
    const top = below + height > window.innerHeight - 8 ? box.top - GAP - height : below;
    const left = Math.min(Math.max(8, box.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    const onMove = () => close(false);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(info.inviteCode));
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        close();
      }, COPIED_MS);
    } catch {
      // No clipboard access: the settings page shows the link to copy by hand.
      close(false);
      navigate(`/app/${info.id}/manage/settings`);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`kebab ${className}`.trim()}
        aria-label={`Options for ${info.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // Never let the click reach a card or link it sits on.
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <DotsIcon size={18} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Options for ${info.name}`}
          className="menu"
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: MENU_WIDTH }}
          onKeyDown={onMenuKey}
        >
          <button type="button" role="menuitem" className="menu__item" onClick={() => void copyInvite()}>
            <LinkIcon size={16} />
            {copied ? "Invite link copied" : "Copy invite link"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu__item"
            onClick={() => {
              close(false);
              navigate(`/app/${info.id}/manage`);
            }}
          >
            <SettingsIcon size={16} />
            {manageLabel(info)}
          </button>
        </div>
      )}
    </>
  );
}
