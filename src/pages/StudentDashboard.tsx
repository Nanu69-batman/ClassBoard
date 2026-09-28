import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../components/AppShell";
import { AssignmentList } from "../components/AssignmentList";
import { EmptyState } from "../components/EmptyState";
import { FilterBar, type StatusFilter } from "../components/FilterBar";
import { StatCards } from "../components/StatCards";
import { useClassAssignments } from "../hooks/useAssignmentFeed";
import { useAssignmentStatus } from "../hooks/useAssignmentStatus";
import { useStudentClass } from "../hooks/useStudentClass";
import { countAssignments, groupAssignmentsByStatus } from "../utils/assignmentStatus";

const ALL_SUBJECTS = "all";

const CAUGHT_UP = {
  title: "You're all caught up 🎉",
  message: "No pending assignments.",
};

const LOADING = { title: "Loading assignments…", message: "Fetching your class feed." };

/**
 * Reached when a shared link names a class that cannot be shown. One message for
 * every cause — deactivated, never existed, mistyped — because from here they are
 * the same event and the fix is identical: ask the CR for a fresh link.
 */
const CLASS_UNAVAILABLE = {
  title: "This class is no longer active",
  message: "The link may be out of date. Ask your class representative for a new one.",
};

const FEED_FAILED = {
  title: "Something went wrong",
  message: "Please try again.",
};

export function StudentDashboard() {
  const { isCompleted, toggleCompleted } = useAssignmentStatus();
  const selection = useStudentClass();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);

  // The listener opens as soon as there is an id, in parallel with the class
  // read, so the two round trips overlap instead of queueing.
  const feed = useClassAssignments(selection.class?.id ?? null);
  const assignments = feed.data ?? [];

  // Subjects come from the assignments actually in hand, not from a separate
  // subject query. One listener instead of two, and the filter can never offer
  // a subject with nothing in it.
  const subjects = useMemo(() => {
    const names = new Set(assignments.map((each) => each.subject));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [assignments]);

  // A subject that no longer exists in the feed must not silently filter to
  // nothing; fall back to All so the list comes back.
  useEffect(() => {
    if (subject !== ALL_SUBJECTS && !subjects.includes(subject)) {
      setSubject(ALL_SUBJECTS);
    }
  }, [subject, subjects]);

  const counts = useMemo(
    () => countAssignments(assignments, isCompleted),
    [assignments, isCompleted],
  );

  const visibleAssignments = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    return assignments.filter((assignment) => {
      if (subject !== ALL_SUBJECTS && assignment.subject !== subject) return false;

      const done = isCompleted(assignment.id);
      if (statusFilter === "pending" && done) return false;
      if (statusFilter === "completed" && !done) return false;

      if (!searchTerm) return true;

      return (
        assignment.title.toLowerCase().includes(searchTerm) ||
        assignment.subject.toLowerCase().includes(searchTerm) ||
        assignment.description.toLowerCase().includes(searchTerm)
      );
    });
  }, [assignments, query, subject, statusFilter, isCompleted]);

  const groups = useMemo(
    () => groupAssignmentsByStatus(visibleAssignments, isCompleted),
    [visibleAssignments, isCompleted],
  );

  const isNarrowed = query.trim() !== "" || subject !== ALL_SUBJECTS;
  const isCaughtUp = counts.pending === 0;

  // Only chase focus for keyboard toggles; a pointer click should not scroll.
  const handleToggle = (id: string, viaKeyboard: boolean) => {
    toggleCompleted(id);
    setLastToggledId(viaKeyboard ? id : null);
  };

  if (selection.status === "unavailable") {
    return (
      <AppShell query={query} onQueryChange={setQuery} contextLabel={null}>
        <EmptyState {...CLASS_UNAVAILABLE} />
      </AppShell>
    );
  }

  let emptyState: { title: string; message: string } | null = null;
  if (feed.status === "loading") {
    emptyState = LOADING;
  } else if (feed.status === "error") {
    emptyState = { ...FEED_FAILED, message: feed.error };
  } else if (groups.length === 0) {
    if (isNarrowed) {
      emptyState = { title: "No assignments found", message: "Try a different search." };
    } else if (statusFilter === "completed") {
      emptyState = {
        title: "Nothing completed yet",
        message: "Mark an assignment as done and it will show up here.",
      };
    } else {
      emptyState = {
        title: "No assignments yet",
        message: "Nothing has been posted for this class so far.",
      };
    }
  } else if (isCaughtUp && statusFilter === "all") {
    emptyState = CAUGHT_UP;
  }

  return (
    <AppShell
      query={query}
      onQueryChange={setQuery}
      contextLabel={selection.class?.displayName ?? null}
    >
      <StatCards counts={counts} />

      <div className="toolbar">
        <h2 className="toolbar__title">Assignments</h2>
        <FilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          subjects={subjects}
          subject={subject}
          onSubjectChange={setSubject}
        />
      </div>

      {emptyState && <EmptyState {...emptyState} />}

      {groups.length > 0 && feed.status === "ready" && (
        <AssignmentList
          groups={groups}
          isCompleted={isCompleted}
          onToggle={handleToggle}
          lastToggledId={lastToggledId}
        />
      )}
    </AppShell>
  );
}
