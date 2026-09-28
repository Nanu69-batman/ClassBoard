/**
 * Which class a student is looking at.
 *
 * ## The shareable link is the real entry point
 *
 * A CR posts `https://…/?class=ece-2026-a` wherever their class already talks,
 * and that link *is* how students join. So `?class=` wins over anything stored
 * locally: a link someone was sent must never be quietly ignored in favour of
 * whatever class this browser looked at last.
 *
 * Once read, the id is remembered, so refreshing or coming back later lands on
 * the same class without the link.
 *
 * ## What this is not
 *
 * Not a security boundary, and not an identity. Students have no accounts, so
 * any class id can be put in the URL by anyone. That is inherent to a public
 * feed: the rules already let a visitor read any *active* class, so switching
 * classes grants nothing. A bad or deactivated id resolves to a plain message
 * rather than an empty dashboard.
 */

import { useCallback, useEffect, useState } from "react";

import { isClassActive } from "../data/feed";
import type { ClassInfo, Loadable } from "../data/types";
import { loadClassId, saveClassId } from "../utils/storage";

/** How a class id in the URL becomes the class being viewed. */
export type ClassSelection =
  /** Reading the link, or validating an unknown id. Nothing to show yet. */
  | { status: "loading"; classId: string | null; error: null }
  /** A class is chosen and readable. */
  | { status: "ready"; classId: string; error: null }
  /** The id does not name a class a student may see. */
  | { status: "unavailable"; classId: string | null; error: null };

export function useStudentClass() {
  const [selection, setSelection] = useState<ClassSelection>(() => {
    const fromLink = readClassFromLocation();
    // A remembered class is trusted without a round trip: it was validated the
    // first time, and the feed listener will still surface a deactivation.
    const remembered = loadClassId();

    if (fromLink && fromLink !== remembered) {
      saveClassId(fromLink);
      return { status: "loading", classId: fromLink, error: null };
    }

    if (fromLink || remembered) {
      return { status: "ready", classId: (fromLink ?? remembered) as string, error: null };
    }

    return { status: "loading", classId: null, error: null };
  });

  const { classId } = selection;

  useEffect(() => {
    if (!classId || selection.status === "ready") return;

    let cancelled = false;

    void isClassActive(classId).then((isActive) => {
      if (cancelled) return;

      if (isActive) {
        setSelection({ status: "ready", classId, error: null });
      } else {
        // Forget it, so the next visit offers the picker instead of re-showing
        // a link that will not resolve.
        saveClassId(null);
        setSelection({ status: "unavailable", classId, error: null });
      }
    });

    return () => {
      cancelled = true;
    };
    // `selection.status` is intentionally not a dependency: this validates the
    // id it was given, and including the status would re-run it after setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  /** Point the browser at a class, so the URL stays shareable and back works. */
  const selectClass = useCallback((next: string) => {
    saveClassId(next);

    const url = new URL(window.location.href);
    url.searchParams.set("class", next);
    window.history.replaceState(null, "", url);

    setSelection({ status: "ready", classId: next, error: null });
  }, []);

  /** Forget the class and show the picker again. */
  const clearClass = useCallback(() => {
    saveClassId(null);

    const url = new URL(window.location.href);
    url.searchParams.delete("class");
    window.history.replaceState(null, "", url);

    setSelection({ status: "loading", classId: null, error: null });
  }, []);

  return { selection, selectClass, clearClass };
}

/** The `?class=` value, if the link names one. Never trusted, only read. */
function readClassFromLocation(): string | null {
  const raw = new URLSearchParams(window.location.search).get("class");
  if (!raw) return null;

  const trimmed = raw.trim();
  // Firestore document ids are 1-1500 chars of anything but `/`, `.`, `..` and
  // control characters. Rejecting the rest keeps a hostile `?class=` from
  // reaching a document path at all.
  if (!trimmed || trimmed.length > 1500) return null;
  if (/[/.]/.test(trimmed) || trimmed === "." || trimmed === "..") return null;
  if (/[\u0000-\u001f]/.test(trimmed)) return null;

  return trimmed;
}

/**
 * True when the selected class is still in the list of active classes.
 *
 * Used to react to a class being deactivated while the page is open: the feed
 * listener is what reports it, but the switcher also has to stop offering a class
 * that no longer exists, or the student can select one that renders nothing.
 */
export function isClassStillListed(
  selection: ClassSelection,
  classes: Loadable<ClassInfo[]>,
): boolean {
  const { classId } = selection;
  if (selection.status !== "ready" || classes.status !== "ready" || !classId) return true;

  return classes.data.some((each) => each.id === classId);
}
