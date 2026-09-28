import type { ListboxOption } from "./Listbox";

import { Listbox } from "./Listbox";

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

const ALL_SUBJECTS = "all";

/**
 * The completion filter and the subject filter.
 *
 * Both are listboxes rather than segmented buttons and a native select. The
 * subject list grows with the class and is sorted alphabetically, so a dropdown
 * is the right control; and having the two filters behave identically — same
 * open, same animation, same keyboard handling — is worth more than two
 * different-looking controls.
 */
export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  subjects,
  subject,
  onSubjectChange,
}: FilterBarProps) {
  // "All subjects" is prepended rather than being a null value, so the trigger
  // always has something to display.
  const subjectOptions: ListboxOption[] = [
    { value: ALL_SUBJECTS, label: "All subjects" },
    ...subjects.map((name) => ({ value: name, label: name })),
  ];

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
        <Listbox
          id="subject-filter"
          options={subjectOptions}
          value={subject}
          onChange={onSubjectChange}
          ariaLabel="Filter by subject"
        />
      </div>
    </div>
  );
}
