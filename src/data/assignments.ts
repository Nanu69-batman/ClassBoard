/**
 * Local assignment dataset.
 *
 * These are *application data* — the definition of what exists. A student's
 * completion state is personal state and lives separately in localStorage
 * (see `src/utils/storage.ts`).
 */

export type Priority = "low" | "normal" | "high";

export type Assignment = {
  id: string;
  subject: string;
  title: string;
  description: string;
  /** ISO date string, `YYYY-MM-DD`. Date only, no time component. */
  dueDate: string;
  priority: Priority;
  /** Optional link to a file in `public/` or an external URL. */
  attachment?: string | null;
};

/**
 * Builds an ISO `YYYY-MM-DD` string for a day relative to today.
 *
 * The sample data is written as offsets so the dashboard always has something
 * overdue, something due today, something due soon and something further out.
 * Real data coming from a backend later would carry fixed ISO dates instead.
 */
function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const assignments: Assignment[] = [
  {
    id: "math-001",
    subject: "Engineering Mathematics",
    title: "Assignment 1",
    description:
      "Complete questions 1-15 from Unit 1 and show all working. Final answers without steps will not be graded.",
    dueDate: isoDateFromToday(-4),
    priority: "high",
    attachment: "/files/math-assignment-1-sheet.txt",
  },
  {
    id: "math-002",
    subject: "Engineering Mathematics",
    title: "Assignment 2",
    description: "Solve questions 1-10 from Unit 2.",
    dueDate: isoDateFromToday(0),
    priority: "high",
    attachment: "/files/math-assignment-2-sheet.txt",
  },
  {
    id: "math-003",
    subject: "Engineering Mathematics",
    title: "Unit Test 1 Preparation",
    description:
      "Read Units 1 to 3 and make a single-page formula sheet you can revise from the night before the test.",
    dueDate: isoDateFromToday(6),
    priority: "low",
    attachment: null,
  },
  {
    id: "physics-003",
    subject: "Physics",
    title: "Lab Record 2",
    description:
      "Complete Experiment 2 on the moment of inertia of a disc and attach the observation table with units.",
    dueDate: isoDateFromToday(-2),
    priority: "normal",
    attachment: "/files/physics-lab-record-2.txt",
  },
  {
    id: "physics-004",
    subject: "Physics",
    title: "Lab Record 3",
    description:
      "Complete Experiment 3 and attach the observations together with the calculated value of the coefficient of friction. Include the graph of friction force against normal load, state the sources of error, and write the conclusion in two lines. The observation table must have units in every column heading.",
    dueDate: isoDateFromToday(1),
    priority: "normal",
    attachment: null,
  },
  {
    id: "eee-001",
    subject: "Basic Electrical Engineering",
    title: "Tutorial Sheet 1",
    description: "Complete the numerical problems from Unit 1 on network theorems.",
    dueDate: isoDateFromToday(2),
    priority: "normal",
    attachment: null,
  },
  {
    id: "eee-002",
    subject: "Basic Electrical Engineering",
    title: "Mini Project Proposal",
    description:
      "Write a half-page proposal for a simple circuit you want to build this semester. Keep it to one page.",
    dueDate: isoDateFromToday(12),
    priority: "low",
    attachment: null,
  },
  {
    id: "programming-001",
    subject: "Programming",
    title: "Assignment 1",
    description:
      "Write C programs for the linear data structure problems in the lab manual and submit the output for each test case. Do the whole submission in one folder named your-roll-number, and add a two-line comment at the top of each file describing what it does.",
    dueDate: isoDateFromToday(-1),
    priority: "normal",
    attachment: null,
  },
  {
    id: "programming-002",
    subject: "Programming",
    title: "Assignment 2",
    description: "Implement the given array problems.",
    dueDate: isoDateFromToday(3),
    priority: "high",
    attachment: null,
  },
  {
    id: "programming-003",
    subject: "Programming",
    title: "Mini Project Proposal",
    description:
      "Pick a small project and describe the problem, your approach, and the languages you plan to use.",
    dueDate: isoDateFromToday(15),
    priority: "low",
    attachment: null,
  },
  {
    id: "electronics-002",
    subject: "Electronics",
    title: "Diode Characteristics Lab",
    description:
      "Plot the V-I characteristics of a silicon diode from the lab data sheet and mark the knee voltage.",
    dueDate: isoDateFromToday(0),
    priority: "normal",
    attachment: null,
  },
  {
    id: "electronics-004",
    subject: "Electronics",
    title: "Transistor Biasing Problem Set",
    description: "Solve the eight biasing problems given in the class notes.",
    dueDate: isoDateFromToday(9),
    priority: "normal",
    attachment: null,
  },
  {
    id: "drawing-001",
    subject: "Engineering Drawing",
    title: "Projection of Points Exercise",
    description:
      "Draw the six principal positions of a point and label each quadrant clearly.",
    dueDate: isoDateFromToday(-1),
    priority: "high",
    attachment: null,
  },
  {
    id: "drawing-002",
    subject: "Engineering Drawing",
    title: "Sectional Views Sheet",
    description:
      "Draw the given object in full section and label all hidden edges. Use a proper cutting plane line.",
    dueDate: isoDateFromToday(5),
    priority: "normal",
    attachment: null,
  },
];

/** Every subject present in the dataset, alphabetically. */
export function getSubjects(source: Assignment[] = assignments): string[] {
  return [...new Set(source.map((assignment) => assignment.subject))].sort((a, b) =>
    a.localeCompare(b),
  );
}
