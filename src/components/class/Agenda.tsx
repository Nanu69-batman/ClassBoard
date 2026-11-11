import { useId, useMemo, useState } from "react";

import type { Assignment } from "../../data/types";
import {
  getAssignmentStatus,
  sortAssignments,
  type AssignmentStatus,
} from "../../utils/assignmentStatus";
import { assignmentAnchor } from "../AssignmentCard";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

type Props = {
  assignments: Assignment[];
  isCompleted: (id: string) => boolean;
  /** Called when a day is followed, e.g. to close the sheet it sits in. */
  onPick?: () => void;
};

/** The side column of the assignments tab: a month of due dates. */
export function Agenda({ assignments, isCompleted, onPick, className = "agenda" }: Props & { className?: string }) {
  return (
    <aside className={className} aria-label="Due dates">
      <MonthCalendar assignments={assignments} isCompleted={isCompleted} onPick={onPick} />
    </aside>
  );
}

/* ---------------------------------------------------------------- calendar -- */

const WEEKDAYS = [
  ["S", "Sunday"],
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
] as const;

/** How a day is tinted: by the most urgent work still pending on it. */
type DayTone = "overdue" | "soon" | "upcoming" | "done";

const TONE_RANK: Record<DayTone, number> = { overdue: 0, soon: 1, upcoming: 2, done: 3 };

function toneFor(status: AssignmentStatus): DayTone {
  if (status === "overdue") return "overdue";
  if (status === "today" || status === "soon") return "soon";
  if (status === "completed") return "done";
  return "upcoming";
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MonthCalendar({ assignments, isCompleted, onPick }: Props) {
  const titleId = useId();
  const today = new Date();
  const todayKey = isoDay(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));

  /** Due date → the work due that day. */
  const byDay = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const each of assignments) {
      if (!each.dueDate) continue;
      map.set(each.dueDate, [...(map.get(each.dueDate) ?? []), each]);
    }
    return map;
  }, [assignments]);

  const { year, month } = cursor;
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <section className="side-card" aria-labelledby={titleId}>
      <div className="side-card__head">
        <h2 className="side-card__title" id={titleId}>
          {isCurrentMonth ? "This month" : "Calendar"}
        </h2>
        {!isCurrentMonth && (
          <button
            type="button"
            className="link-button calendar__today"
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
          >
            Today
          </button>
        )}
      </div>

      <div className="calendar__nav">
        <button type="button" className="calendar__step" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeftIcon size={18} />
        </button>
        <p className="calendar__month" aria-live="polite">
          {monthLabel}
        </p>
        <button type="button" className="calendar__step" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <table className="calendar__grid">
        <thead>
          <tr>
            {WEEKDAYS.map(([letter, name]) => (
              <th key={name} scope="col" abbr={name}>
                {letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((day, column) => {
                if (day === null) return <td key={column} />;

                const key = isoDay(year, month, day);
                const due = byDay.get(key) ?? [];
                const isToday = key === todayKey;

                let tone: DayTone | null = null;
                for (const each of due) {
                  const next = toneFor(getAssignmentStatus(each, isCompleted(each.id)));
                  if (tone === null || TONE_RANK[next] < TONE_RANK[tone]) tone = next;
                }

                const className = [
                  "calendar__day",
                  tone ? `calendar__day--${tone}` : "",
                  isToday ? "calendar__day--today" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                if (due.length === 0) {
                  return (
                    <td key={column}>
                      <span className={className} aria-current={isToday ? "date" : undefined}>
                        {day}
                      </span>
                    </td>
                  );
                }

                // A day with work on it links to the first card due then.
                const titles = due.map((each) => each.title).join(", ");
                const first = [...due].sort(sortAssignments)[0];
                return (
                  <td key={column}>
                    <a
                      className={className}
                      href={`#${assignmentAnchor(first.id)}`}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${day} ${monthLabel}: ${titles}`}
                      title={titles}
                      onClick={onPick}
                    >
                      {day}
                    </a>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="calendar__legend" aria-label="Key">
        <li className="calendar__key calendar__key--overdue">Overdue</li>
        <li className="calendar__key calendar__key--soon">Due soon</li>
        <li className="calendar__key calendar__key--upcoming">Later</li>
      </ul>
    </section>
  );
}
