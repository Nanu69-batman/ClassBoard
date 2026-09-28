/**
 * Reading and writing a class as its CR.
 *
 * The student side is read-only and lives in `feed.ts`. This is the other half:
 * the only place in the app that writes to Firestore.
 *
 * ## Why the CR's own queries carry no `active` filter
 *
 * The student feed must query `where("active", "==", true)`, because the rules'
 * public branch varies per document and Firestore can only authorise a query it
 * can prove. A CR's class queries carry no filter at all, and that is what makes
 * archived work visible to them.
 *
 * It works because `isMyClass(classId)` resolves to a single `get()` on the
 * caller's *own* profile — a value that is constant for the whole query, unlike
 * `active`. Firestore evaluates that branch for the result set as a whole, so the
 * query is authorised and every document in the class comes back, archived
 * included. The subcollection path has already fixed the class, so the check
 * cannot vary per document either.
 *
 * ## createdBy is the uid, and the rules hold it fixed
 *
 * `createdBy` carries the Firebase uid, not an email address, and the rules
 * compare it against `request.auth.uid` on create. It is the anchor for the
 * attribution a student sees via `postedByName`. Because it is what makes
 * `postedByName` trustworthy, the rules forbid changing it on update.
 *
 * ## Updates touch only the fields the form owns
 *
 * §17 is explicit: do not silently overwrite unrelated fields. Every write below
 * uses `updateDoc`, never `setDoc`, so a field the form does not render —
 * `contactEmail`, `attachmentUrl` — survives an edit untouched. `setDoc` would
 * replace the whole document and quietly drop anything it did not know about.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import type {
  Assignment,
  ClassInfo,
  CrAssignment,
  Loadable,
  Priority,
  SubjectInfo,
} from "./types";

const PRIORITIES: Priority[] = ["none", "low", "normal", "high"];

function toPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "none";
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toDueDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function toDueNote(value: unknown, dueDate: string): string | null {
  if (dueDate) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function toSubject(classId: string, id: string, data: DocumentData): SubjectInfo {
  return {
    id,
    classId,
    name: toText(data.name, id),
    shortName: toText(data.shortName, id),
    active: data.active === true,
  };
}

function toCrAssignment(classId: string, id: string, data: DocumentData): CrAssignment {
  const dueDate = toDueDate(data.dueDate);

  return {
    id,
    classId,
    // The id is what the edit form preselects; the name is what a card shows.
    // A document missing subjectId falls back to the name, so the two can never
    // disagree about which subject this is.
    subjectId: toText(data.subjectId, toText(data.subjectName)),
    subject: toText(data.subjectName, "General"),
    title: toText(data.title, "Untitled assignment"),
    description: toText(data.description),
    dueDate,
    dueNote: toDueNote(data.dueNote, dueDate),
    priority: toPriority(data.priority),
    attachment: typeof data.attachmentUrl === "string" ? data.attachmentUrl : null,
    postedBy: typeof data.postedByName === "string" ? data.postedByName : null,
    active: data.active === true,
    contactEmail: typeof data.contactEmail === "string" ? data.contactEmail : null,
  };
}

/**
 * Every assignment in the class, archived ones included.
 *
 * Unfiltered on purpose — see the note at the top of this file. A CR whose
 * account has been deactivated is refused here, which is the revocation working.
 */
export function subscribeToClassAssignmentsForCr(
  classId: string,
  onChange: (state: Loadable<CrAssignment[]>) => void,
): () => void {
  return onSnapshot(
    collection(db, `classes/${classId}/assignments`),
    (snapshot) => {
      const assignments = snapshot.docs.map((each) =>
        toCrAssignment(classId, each.id, each.data()),
      );
      onChange({ status: "ready", data: assignments, error: null });
    },
    (error) => {
      console.error("[classboard] CR assignment list failed", error);
      onChange({ status: "error", data: null, error: "Could not load your assignments." });
    },
  );
}

/**
 * The class's own subjects, for the form's subject dropdown.
 *
 * Unfiltered, so a CR can still file an assignment under a subject that has been
 * deactivated but not deleted. Ordered by name, because that is how a person
 * scans a list of subjects.
 */
export function subscribeToClassSubjectsForCr(
  classId: string,
  onChange: (state: Loadable<SubjectInfo[]>) => void,
): () => void {
  return onSnapshot(
    collection(db, `classes/${classId}/subjects`),
    (snapshot) => {
      const subjects = snapshot.docs
        .map((each) => toSubject(classId, each.id, each.data()))
        .sort((a, b) => a.name.localeCompare(b.name));

      onChange({ status: "ready", data: subjects, error: null });
    },
    (error) => {
      console.error("[classboard] subject list failed", error);
      onChange({ status: "error", data: null, error: "Could not load your subjects." });
    },
  );
}

/** The class document as a CR may read it — active or not, since they may own it. */
export async function fetchClassForCr(classId: string): Promise<ClassInfo | null> {
  try {
    const snapshot = await getDoc(doc(db, `classes/${classId}`));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      id: classId,
      name: toText(data.name),
      batch: toText(data.batch),
      section: toText(data.section),
      displayName: toText(data.displayName, classId),
      active: data.active === true,
    };
  } catch {
    return null;
  }
}

/** Everything the form collects. Mirrors §16: subject, title and due date required. */
export type AssignmentDraft = {
  subjectId: string;
  /** Denormalised from the subject document, so a student's card needs no extra read. */
  subjectName: string;
  title: string;
  description: string;
  /**
   * Empty when the CR chose a standing note instead of a date. A CR can genuinely
   * post reading that is not due on any particular day, and forcing a fake date
   * onto it would make the student dashboard claim it is overdue.
   */
  dueDate: string;
  /**
   * Shown in place of the date. Empty when there is a real date, so a document
   * never carries both. Stored as an empty string rather than null because
   * Firestore documents in this app use empty strings for "no value" consistently
   * — `attachmentUrl`, `contactEmail` — and mixing the two would be worse than
   * the redundancy. The mappers turn it back into null for the UI.
   */
  dueNote: string;
  priority: Priority;
};

/** Who is posting, and what to call them in public. */
export type Author = {
  uid: string;
  displayName: string;
};

/**
 * Posts a new assignment.
 *
 * Every field in the document is one the rules' `validAssignment()` allows and
 * nothing else — `keys().hasOnly` rejects the whole write if a single unexpected
 * key appears, which is what stops an account email being denormalised into a
 * student-readable document by accident.
 */
export async function createAssignment(
  classId: string,
  draft: AssignmentDraft,
  author: Author,
): Promise<string> {
  const created = await addDoc(collection(db, `classes/${classId}/assignments`), {
    subjectId: draft.subjectId,
    subjectName: draft.subjectName,
    title: draft.title,
    description: draft.description,
    dueDate: draft.dueDate,
    dueNote: draft.dueNote,
    priority: draft.priority,
    // M7 replaces these two with a real Storage upload. Nulls keep the document
    // shape identical to the seeded one, so nothing downstream has to branch.
    attachmentUrl: null,
    attachmentName: null,
    contactEmail: null,
    createdBy: author.uid,
    postedByName: author.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    active: true,
  });

  return created.id;
}

/**
 * Applies an edit to the fields the form owns.
 *
 * `updateDoc` rather than `setDoc`, so `createdBy`, `createdAt`, `contactEmail`
 * and any attachment survive. §17 asks for exactly this.
 */
export async function updateAssignment(
  classId: string,
  assignmentId: string,
  draft: AssignmentDraft,
): Promise<void> {
  await updateDoc(doc(db, `classes/${classId}/assignments/${assignmentId}`), {
    subjectId: draft.subjectId,
    subjectName: draft.subjectName,
    title: draft.title,
    description: draft.description,
    dueDate: draft.dueDate,
    dueNote: draft.dueNote,
    priority: draft.priority,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft delete, per §18.
 *
 * `active: false` rather than a removal, so an accidental click is recoverable
 * and a student's marked-complete state is not orphaned onto a document that no
 * longer exists. Students' dashboards drop it via their own `active == true`
 * filter; the CR keeps seeing it here, because this query is unfiltered.
 */
export async function setAssignmentActive(
  classId: string,
  assignmentId: string,
  active: boolean,
): Promise<void> {
  await updateDoc(doc(db, `classes/${classId}/assignments/${assignmentId}`), {
    active,
    updatedAt: serverTimestamp(),
  });
}

/** Re-exported so the form does not need to import from two modules. */
export type { Assignment, CrAssignment };
