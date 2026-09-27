/**
 * All date / status reasoning for an assignment lives here so the UI never has
 * to do calendar math itself.
 */

import type { Assignment, Priority } from "../data/assignments";

export type AssignmentStatus =
  | "overdue"
  | "today"
  | "soon"
  | "upcoming"
  | "completed";

/** Assignments due within this many days (after today) count as "due soon". */
export const DUE_SOON_DAYS = 3;

const MS_PER_DAY = 86_400_000;

const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

/**
 * Parses a `YYYY-MM-DD` string as a *local* date.
 * Returns `null` for anything malformed, so bad data degrades instead of throwing.
 */
function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Whole calendar days from today until the due date.
 * Negative = the due date has passed, `0` = due today, `null` = unusable date.
 */
export function getDaysUntilDue(dueDate: string): number | null {
  const due = parseISODate(dueDate);
  if (!due) return null;

  // Both sides are local midnights, so rounding absorbs any DST offset.
  return Math.round((due.getTime() - startOfToday().getTime()) / MS_PER_DAY);
}

/** Completion wins visually: a completed assignment is never shown as active work. */
export function getAssignmentStatus(
  assignment: Assignment,
  isCompleted: boolean,
): AssignmentStatus {
  if (isCompleted) return "completed";

  const days = getDaysUntilDue(assignment.dueDate);
  if (days === null) return "upcoming";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "upcoming";
}

/** Human-readable due date, e.g. `28 Sep 2026`. */
export function formatDueDate(dueDate: string): string {
  const date = parseISODate(dueDate);
  if (!date) return "No due date";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Short due text such as `Due tomorrow` or `Overdue by 2 days`. */
export function getRelativeDueText(dueDate: string): string {
  const days = getDaysUntilDue(dueDate);
  if (days === null) return "No due date";

  if (days < -1) return `Overdue by ${Math.abs(days)} days`;
  if (days === -1) return "Overdue by 1 day";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= DUE_SOON_DAYS) return `Due in ${days} days`;

  return `Due ${formatDueDate(dueDate)}`;
}

/** Text label for a status, so status is never communicated by colour alone. */
export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  upcoming: "Upcoming",
  completed: "Completed",
};

export type AssignmentGroup = {
  status: AssignmentStatus;
  title: string;
  items: Assignment[];
};

/** Group order, most urgent first. */
export const GROUP_ORDER: Array<{ status: AssignmentStatus; title: string }> = [
  { status: "overdue", title: "Overdue" },
  { status: "today", title: "Due today" },
  { status: "soon", title: "Due soon" },
  { status: "upcoming", title: "Upcoming" },
  { status: "completed", title: "Completed" },
];

/** Headline counts for the summary cards. */
export function countAssignments(
  source: Assignment[],
  isCompleted: (id: string) => boolean,
): { pending: number; overdue: number; soon: number; completed: number } {
  const counts = { pending: 0, overdue: 0, soon: 0, completed: 0 };

  for (const assignment of source) {
    const status = getAssignmentStatus(assignment, isCompleted(assignment.id));

    if (status === "completed") {
      counts.completed += 1;
    } else {
      counts.pending += 1;
    }

    if (status === "overdue") counts.overdue += 1;
    if (status === "soon") counts.soon += 1;
  }

  return counts;
}

/** Earliest due date first; higher priority breaks ties on the same date. */
export function sortAssignments(a: Assignment, b: Assignment): number {
  const byDueDate = a.dueDate.localeCompare(b.dueDate);
  if (byDueDate !== 0) return byDueDate;

  return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
}

/** Buckets assignments into ordered groups, dropping empty ones. */
export function groupAssignmentsByStatus(
  source: Assignment[],
  isCompleted: (id: string) => boolean,
): AssignmentGroup[] {
  const groups = GROUP_ORDER.map((group) => ({
    ...group,
    items: source.filter(
      (assignment) =>
        getAssignmentStatus(assignment, isCompleted(assignment.id)) === group.status,
    ),
  }));

  for (const group of groups) {
    group.items.sort(sortAssignments);
  }

  return groups.filter((group) => group.items.length > 0);
}
