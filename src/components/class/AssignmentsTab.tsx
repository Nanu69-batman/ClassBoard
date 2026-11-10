import { useEffect, useMemo, useState } from "react";

import type { ClassData } from "../../data/classData";
import type { Loadable } from "../../data/types";
import { countAssignments, groupAssignmentsByStatus } from "../../utils/assignmentStatus";
import { AssignmentList } from "../AssignmentList";
import { EmptyState } from "../EmptyState";
import { FilterBar, type StatusFilter } from "../FilterBar";
import { SearchIcon } from "../icons";
import { StatCards } from "../StatCards";

const ALL_SUBJECTS = "all";

/**
 * How long a completed card is allowed to animate settling into its new group.
 * Must outlast the CSS animation.
 */
const SETTLE_MS = 620;

type Props = {
  data: Loadable<ClassData>;
  isCompleted: (id: string) => boolean;
  onToggle: (id: string) => void;
  toggleError: string | null;
};

/** What everyone in the class sees: what's due, grouped by urgency, with their own ticks. */
export function AssignmentsTab({ data, isCompleted, onToggle, toggleError }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);

  useEffect(() => {
    if (!justCompletedId) return;
    const timer = window.setTimeout(() => setJustCompletedId(null), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [justCompletedId]);

  // Owners and admins also receive archived work; this view never shows it.
  const assignments = useMemo(
    () => (data.data?.assignments ?? []).filter((each) => each.active),
    [data.data],
  );

  const subjects = useMemo(() => {
    const names = new Set(assignments.map((each) => each.subject));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [assignments]);

  useEffect(() => {
    if (subject !== ALL_SUBJECTS && !subjects.includes(subject)) setSubject(ALL_SUBJECTS);
  }, [subject, subjects]);

  const counts = useMemo(() => countAssignments(assignments, isCompleted), [assignments, isCompleted]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return assignments.filter((assignment) => {
      if (subject !== ALL_SUBJECTS && assignment.subject !== subject) return false;
      const done = isCompleted(assignment.id);
      if (statusFilter === "pending" && done) return false;
      if (statusFilter === "completed" && !done) return false;
      if (!term) return true;
      return (
        assignment.title.toLowerCase().includes(term) ||
        assignment.subject.toLowerCase().includes(term) ||
        assignment.description.toLowerCase().includes(term)
      );
    });
  }, [assignments, query, subject, statusFilter, isCompleted]);

  const groups = useMemo(() => groupAssignmentsByStatus(visible, isCompleted), [visible, isCompleted]);

  function handleToggle(id: string, viaKeyboard: boolean) {
    if (!isCompleted(id)) setJustCompletedId(id);
    onToggle(id);
    setLastToggledId(viaKeyboard ? id : null);
  }

  const isNarrowed = query.trim() !== "" || subject !== ALL_SUBJECTS;

  let empty: { title: string; message: string } | null = null;
  if (data.status === "loading") {
    empty = { title: "Loading assignments…", message: "Fetching your class." };
  } else if (groups.length === 0) {
    if (isNarrowed) empty = { title: "No assignments found", message: "Try a different search." };
    else if (statusFilter === "completed")
      empty = { title: "Nothing completed yet", message: "Tick an assignment off and it shows up here." };
    else if (statusFilter === "pending" || assignments.length > 0)
      empty = { title: "You're all caught up 🎉", message: "No pending assignments." };
    else empty = { title: "No assignments yet", message: "Nothing has been posted in this class so far." };
  } else if (counts.pending === 0 && statusFilter === "all") {
    empty = { title: "You're all caught up 🎉", message: "No pending assignments." };
  }

  return (
    <>
      <StatCards counts={counts} />

      <div className="toolbar">
        <div className="search-field">
          <SearchIcon size={18} />
          <label className="sr-only" htmlFor="assignment-search">
            Search assignments
          </label>
          <input
            id="assignment-search"
            className="search-input"
            type="search"
            value={query}
            placeholder="Search assignments…"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <FilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          subjects={subjects}
          subject={subject}
          onSubjectChange={setSubject}
        />
      </div>

      {toggleError && (
        <p className="form__error" role="alert">
          {toggleError}
        </p>
      )}

      {empty && <EmptyState {...empty} />}

      {groups.length > 0 && data.status === "ready" && (
        <AssignmentList
          groups={groups}
          isCompleted={isCompleted}
          onToggle={handleToggle}
          lastToggledId={lastToggledId}
          justCompletedId={justCompletedId}
        />
      )}
    </>
  );
}
