/**
 * Sample classes and subjects.
 *
 * These mirror the Firestore shape from M2 and are what the seed script in M9
 * will write. The privileged dashboards read them for now so the screens can be
 * reviewed before the Firestore wiring lands in M6 and M8.
 */

export type ClassInfo = {
  id: string;
  name: string;
  batch: string;
  section: string;
  displayName: string;
  active: boolean;
};

export type SubjectInfo = {
  id: string;
  classId: string;
  name: string;
  shortName: string;
  active: boolean;
};

export const sampleClasses: ClassInfo[] = [
  {
    id: "ece-2026-a",
    name: "ECE",
    batch: "2026",
    section: "A",
    displayName: "ECE • 2026 • Section A",
    active: true,
  },
  {
    id: "cse-2026-a",
    name: "CSE",
    batch: "2026",
    section: "A",
    displayName: "CSE • 2026 • Section A",
    active: true,
  },
  {
    id: "it-2026-b",
    name: "IT",
    batch: "2026",
    section: "B",
    displayName: "IT • 2026 • Section B",
    active: false,
  },
];

export const sampleSubjects: SubjectInfo[] = [
  { id: "maths", classId: "ece-2026-a", name: "Engineering Mathematics", shortName: "Maths", active: true },
  { id: "physics", classId: "ece-2026-a", name: "Physics", shortName: "Physics", active: true },
  { id: "eee", classId: "ece-2026-a", name: "Basic Electrical Engineering", shortName: "EEE", active: true },
  { id: "prog", classId: "ece-2026-a", name: "Programming", shortName: "Prog", active: true },
  { id: "electronics", classId: "ece-2026-a", name: "Electronics", shortName: "Electronics", active: true },
  { id: "drawing", classId: "ece-2026-a", name: "Engineering Drawing", shortName: "Drawing", active: true },
  { id: "os", classId: "cse-2026-a", name: "Operating Systems", shortName: "OS", active: true },
  { id: "networks", classId: "cse-2026-a", name: "Computer Networks", shortName: "Networks", active: true },
  { id: "dbms", classId: "cse-2026-a", name: "Database Management Systems", shortName: "DBMS", active: true },
  { id: "it-101", classId: "it-2026-b", name: "Introduction to Information Technology", shortName: "IT-101", active: false },
];

export function getClass(classId: string | undefined): ClassInfo | undefined {
  return sampleClasses.find((each) => each.id === classId);
}

export function getSubjectsFor(classId: string | undefined): SubjectInfo[] {
  if (!classId) return [];
  return sampleSubjects.filter((subject) => subject.classId === classId);
}
