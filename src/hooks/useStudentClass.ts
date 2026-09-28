/**
 * Which class a student's dashboard is showing.
 *
 * ## A class is reached by link, never by browsing
 *
 * Students have no accounts, so there is nothing to sign in to and no directory
 * to browse. A CR posts their class link wherever the class already talks, and
 * that link is the whole onboarding flow. There is deliberately no switcher and
 * no class picker: a student is sent to their class, they do not go looking for
 * one.
 *
 * The class id comes from the route, `/class/:classId`. It is remembered on open,
 * so a refresh or a return visit lands on the same class without the link.
 *
 * ## What this is not
 *
 * Not a security boundary, and not an identity. Anyone can put any class id in
 * the URL. That is inherent to a public feed: the rules already let a visitor
 * read any *active* class, so knowing an id grants nothing a visitor did not
 * already have. A bad or deactivated id resolves to a plain message.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchClass } from "../data/feed";
import type { ClassInfo } from "../data/types";
import { loadClassId, saveClassId } from "../utils/storage";

/**
 * Where a class id got to.
 *
 * `classId` is present while resolving and on success, so the assignments
 * listener can open in parallel with the class read rather than strictly after
 * it. On `unavailable` the id is kept too — it is what the message is about, and
 * what a retry would re-check.
 */
export type ClassSelection =
  | { status: "loading"; classId: string | null; class: null }
  | { status: "ready"; classId: string; class: ClassInfo }
  | { status: "unavailable"; classId: string | null; class: null };

export function useStudentClass(): ClassSelection {
  const params = useParams<{ classId: string }>();
  const classId = sanitiseClassId(params.classId);

  const [found, setFound] = useState<ClassInfo | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!classId) {
      // The route matched but the segment is not a usable document id. Settle
      // immediately rather than leaving the caller on "loading" forever, and
      // never issue a Firestore read for it.
      setFound(null);
      setIsResolved(true);
      return;
    }

    setFound(null);
    setIsResolved(false);

    let cancelled = false;

    void fetchClass(classId).then((result) => {
      if (cancelled) return;

      if (result) {
        saveClassId(result.id);
        setFound(result);
      } else {
        // Deactivated, never existed, or a bad link — one outcome for the user.
        // Stop remembering it so this browser is not stuck re-checking.
        if (loadClassId() === classId) saveClassId(null);
      }

      setIsResolved(true);
    });

    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (found) return { status: "ready", classId: classId as string, class: found };

  if (!classId) {
    // Unusable route segment. `isResolved` is true by the time this is reached,
    // but the branch is written out rather than assumed so a future change to
    // the effect cannot silently reintroduce a permanent spinner.
    return isResolved
      ? { status: "unavailable", classId: null, class: null }
      : { status: "loading", classId: null, class: null };
  }

  return isResolved
    ? { status: "unavailable", classId, class: null }
    : { status: "loading", classId, class: null };
}

/**
 * A route parameter, validated before it is used to build a document path.
 *
 * react-router already URL-decodes, so the value here has been through a decoder
 * once. Firestore document ids are 1-1500 characters, cannot contain `/`, and
 * cannot be `.` or `..`. Anything else is refused outright, so a hostile
 * `/class/…` cannot reach a path at all.
 */
function sanitiseClassId(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1500) return null;
  if (/[/.]/.test(trimmed)) return null;
  if (/[\u0000-\u001f]/.test(trimmed)) return null;

  return trimmed;
}
