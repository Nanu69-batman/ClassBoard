import { CheckSquareIcon, ClockIcon, DocumentIcon } from "./icons";

export type StatusCounts = {
  pending: number;
  overdue: number;
  soon: number;
  completed: number;
};

type StatCardsProps = {
  counts: StatusCounts;
};

/**
 * The at-a-glance summary. Overdue work is folded into the pending card so the
 * most urgent signal is never buried.
 */
export function StatCards({ counts }: StatCardsProps) {
  const hasOverdue = counts.overdue > 0;

  return (
    <div className="stats">
      <div className={`stat stat--pending${hasOverdue ? " stat--urgent" : ""}`}>
        <span className="stat__icon">
          <DocumentIcon size={20} />
        </span>
        <span className="stat__text">
          <span className="stat__value">{counts.pending}</span>
          <span className="stat__label">pending</span>
          {hasOverdue && <span className="stat__note">{counts.overdue} overdue</span>}
        </span>
      </div>

      <div className="stat stat--soon">
        <span className="stat__icon">
          <ClockIcon size={20} />
        </span>
        <span className="stat__text">
          <span className="stat__value">{counts.soon}</span>
          <span className="stat__label">due soon</span>
        </span>
      </div>

      <div className="stat stat--completed">
        <span className="stat__icon">
          <CheckSquareIcon size={20} />
        </span>
        <span className="stat__text">
          <span className="stat__value">{counts.completed}</span>
          <span className="stat__label">completed</span>
        </span>
      </div>
    </div>
  );
}
