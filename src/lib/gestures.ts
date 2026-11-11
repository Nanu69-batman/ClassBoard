import { useEffect, useRef, useState } from "react";

/** Phone layout: the nav becomes a full-screen drawer and the calendar a sheet. Keep in step with the CSS. */
export const PHONE_QUERY = "(max-width: 39.99rem)";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** True while the drawer or any modal dialog is showing. A swipe that would open another overlay waits. */
function isOverlayOpen(): boolean {
  return document.querySelector("dialog[open], .rail--open") !== null;
}

/** How far a finger has to travel, and how straight, before it counts as a swipe. */
const MIN_DISTANCE = 64;
const MAX_DURATION = 700;
const STRAIGHTNESS = 1.6;

/**
 * Touches starting on these are left alone: they scroll sideways or take text,
 * and a swipe there means something to them already.
 */
const IGNORE = "input, textarea, select, .tabs, .manage__nav, .listbox__menu, [data-swipe-ignore]";

/**
 * Whether the drawer or a dialog was showing when the finger went down. Taken
 * then rather than when the handlers run, because several handlers hear the
 * same swipe and one may already have closed what another is asking about.
 */
export type SwipeInfo = { overlayWasOpen: boolean };

type SwipeHandlers = {
  onSwipeRight?: (info: SwipeInfo) => void;
  onSwipeLeft?: (info: SwipeInfo) => void;
  enabled?: boolean;
};

/**
 * Calls back on a quick, mostly horizontal swipe anywhere on the page.
 * Listens passively, so it never delays scrolling.
 */
export function useHorizontalSwipe({ onSwipeRight, onSwipeLeft, enabled = true }: SwipeHandlers) {
  // Kept in a ref so the listeners don't re-register on every render.
  const handlers = useRef({ onSwipeRight, onSwipeLeft });
  handlers.current = { onSwipeRight, onSwipeLeft };

  useEffect(() => {
    if (!enabled) return;

    let start: { id: number; x: number; y: number; t: number; overlayWasOpen: boolean } | null = null;

    // Follows one finger by its identifier rather than counting touches on the
    // screen. A touch whose element is hidden mid-swipe (the drawer closing
    // under the finger) doesn't always clear from that count, and a stale count
    // would make every later swipe look like a pinch.
    function onStart(event: TouchEvent) {
      const touch = event.changedTouches[0];
      const target = event.target as Element | null;
      // A second finger joining in makes it a pinch or a scroll, not a swipe.
      if (start || event.changedTouches.length !== 1 || target?.closest(IGNORE)) {
        start = null;
        return;
      }
      start = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        t: event.timeStamp,
        overlayWasOpen: isOverlayOpen(),
      };
    }

    function onEnd(event: TouchEvent) {
      if (!start) return;
      const touch = [...event.changedTouches].find((each) => each.identifier === start?.id);
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const quick = event.timeStamp - start.t < MAX_DURATION;
      const info = { overlayWasOpen: start.overlayWasOpen };
      start = null;

      if (!quick || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * STRAIGHTNESS) return;
      if (dx > 0) handlers.current.onSwipeRight?.(info);
      else handlers.current.onSwipeLeft?.(info);
    }

    function onCancel() {
      start = null;
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, [enabled]);
}
