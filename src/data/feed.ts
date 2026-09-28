/**
 * Reading the student feed from Firestore.
 *
 * This is the repository layer the student dashboard talks to. Everything above
 * it works with plain `Assignment` / `ClassInfo` objects and never sees a
 * Firestore document.
 *
 * ## Every query here filters on `active == true`, and that is not optional
 *
 * The security rules authorise a `list` once for the whole result set. A branch
 * that varies per document (`resource.data.active == true`) therefore has to be
 * matched by the query's own `where()` clause, or Firestore cannot prove the
 * result set is safe and rejects the request outright. Dropping the filter does
 * not "return more" — it returns a permission error.
 *
 * That also means a student never *sees* a deactivated class. If one is linked
 * to, the read is refused, which is exactly how `useClassFeed` learns the class
 * is gone.
 *
 * ## No listener is opened until a class is known
 *
 * Students arrive with no identity, so there is nothing to subscribe on. A
 * listener needs a concrete class id, and every listener costs a connection.
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Assignment, ClassInfo, Loadable, Priority } from "./types";

const PRIORITIES: Priority[] = ["low", "normal", "high"];

/** Anything a document claims to be a priority is one of the three we render. */
function toPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "normal";
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * A due date is only useful if it parses. A malformed or absent one becomes the
 * empty string, which `getDaysUntilDue` reports as "no due date" — the card
 * still renders, it just cannot claim to be overdue.
 */
function toDueDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function toClassInfo(id: string, data: DocumentData): ClassInfo {
  return {
    id,
    name: toText(data.name),
    batch: toText(data.batch),
    section: toText(data.section),
    displayName: toText(data.displayName, id),
    active: data.active === true,
  };
}

function toAssignment(classId: string, id: string, data: DocumentData): Assignment {
  return {
    id,
    classId,
    subject: toText(data.subjectName, "General"),
    title: toText(data.title, "Untitled assignment"),
    description: toText(data.description),
    dueDate: toDueDate(data.dueDate),
    priority: toPriority(data.priority),
    attachment: typeof data.attachmentUrl === "string" ? data.attachmentUrl : null,
    postedBy: typeof data.postedByName === "string" ? data.postedByName : null,
  };
}

/**
 * Every active class, for the switcher and the first-run picker.
 *
 * Deactivated classes are absent by construction, which is what keeps them out of
 * the picker (§4 of M4). The listener also keeps the list fresh: if a class is
 * deactivated while the page is open, it disappears from the switcher.
 */
export function subscribeToActiveClasses(
  onChange: (state: Loadable<ClassInfo[]>) => void,
): () => void {
  const q = query(collection(db, "classes"), where("active", "==", true));

  return onSnapshot(
    q,
    (snapshot) => {
      const classes = snapshot.docs
        .map((each) => toClassInfo(each.id, each.data()))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      onChange({ status: "ready", data: classes, error: null });
    },
    (error) => {
      // Logged for development; the user only ever sees the friendly text (§29).
      console.error("[classboard] class list failed", error);
      onChange({ status: "error", data: null, error: "Could not load classes." });
    },
  );
}

/**
 * One class's active assignments, live.
 *
 * `onSnapshot` rather than a one-shot read, so a CR posting something appears
 * without a refresh (§30).
 *
 * A `permission-denied` here is not necessarily a bug: an unauthenticated read of
 * a class that is no longer active is refused, and the message is accurate either
 * way. The two cases are not worth separating — from a student's side they are
 * the same event, the class they were sent to is not available.
 */
export function subscribeToClassAssignments(
  classId: string,
  onChange: (state: Loadable<Assignment[]>) => void,
): () => void {
  const q = query(
    collection(db, `classes/${classId}/assignments`),
    where("active", "==", true),
  );

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const assignments = snapshot.docs.map((each) =>
        toAssignment(classId, each.id, each.data()),
      );

      onChange({ status: "ready", data: assignments, error: null });
    },
    (error) => {
      console.error("[classboard] assignment feed failed", error);
      onChange({
        status: "error",
        data: null,
        error: "This class is no longer active.",
      });
    },
  );
}

/**
 * Whether a class is still active, for validating a link before subscribing.
 *
 * A miss here is a permission denial, not an empty result: a deactivated class
 * refuses the read. So `false` covers "deactivated", "never existed" and "bad
 * link" alike, and the caller shows one plain message for all of them.
 */
export async function isClassActive(classId: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(db, `classes/${classId}`));
    return snapshot.exists() && snapshot.data().active === true;
  } catch {
    return false;
  }
}
