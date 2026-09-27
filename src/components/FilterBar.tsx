export const STATUS_FILTERS = ["all", "pending", "completed"] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  pending: "Pending",
  completed: "Completed",
};

type FilterBarProps = {
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  subjects: string[];
  subject: string;
  onSubjectChange: (value: string) => void;
};

export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  subjects,
  subject,
  onSubjectChange,
}: FilterBarProps) {
  return (
    <div className="filters">
      <div className="segmented" role="group" aria-label="Filter assignments by completion">
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className="segmented__button"
            aria-pressed={statusFilter === value}
            onClick={() => onStatusFilterChange(value)}
          >
            {STATUS_FILTER_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="filters__subject">
        <label className="filters__label" htmlFor="subject-filter">
          Subject
        </label>
        <select
          id="subject-filter"
          className="select"
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
        >
          <option value="all">All subjects</option>
          {subjects.map((each) => (
            <option key={each} value={each}>
              {each}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
