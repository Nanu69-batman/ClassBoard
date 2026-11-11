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
 * The completion filter and the subject filter, as two matching dropdowns.
 *
 * Neither has a visible label: what each one holds ("All", "All subjects")
 * says what it filters, and each has an accessible name for screen readers.
 */
export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  subjects,
  subject,
  onSubjectChange,
}: FilterBarProps) {
  const statusOptions: ListboxOption[] = STATUS_FILTERS.map((value) => ({
    value,
    label: STATUS_FILTER_LABELS[value],
  }));

  // "All subjects" is prepended rather than being a null value, so the trigger
  // always has something to display.
  const subjectOptions: ListboxOption[] = [
    { value: ALL_SUBJECTS, label: "All subjects" },
    ...subjects.map((name) => ({ value: name, label: name })),
  ];

  return (
    <div className="filters">
      <Listbox
        id="status-filter"
        options={statusOptions}
        value={statusFilter}
        onChange={(value) => onStatusFilterChange(value as StatusFilter)}
        ariaLabel="Show assignments"
      />
      <Listbox
        id="subject-filter"
        options={subjectOptions}
        value={subject}
        onChange={onSubjectChange}
        ariaLabel="Filter by subject"
      />
    </div>
  );
}
