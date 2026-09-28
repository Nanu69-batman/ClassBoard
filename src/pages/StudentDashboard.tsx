import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../components/AppShell";
import { AssignmentList } from "../components/AssignmentList";
import { ClassPicker, ClassSwitcher } from "../components/ClassSwitcher";
import { EmptyState } from "../components/EmptyState";
import { FilterBar, type StatusFilter } from "../components/FilterBar";
import { Greeting } from "../components/Greeting";
import { StatCards } from "../components/StatCards";
import { useActiveClasses, useClassAssignments } from "../hooks/useAssignmentFeed";
import { useAssignmentStatus } from "../hooks/useAssignmentStatus";
import { isClassStillListed, useStudentClass } from "../hooks/useStudentClass";
import { countAssignments, groupAssignmentsByStatus } from "../utils/assignmentStatus";

const ALL_SUBJECTS = "all";

const CAUGHT_UP = {
  title: "You're all caught up 🎉",
  message: "No pending assignments.",
};

const LOADING = { title: "Loading assignments…", message: "Fetching your class feed." };

const CLASS_UNAVAILABLE = {
  title: "This class is no longer active",
  message: "The link may be out of date. Pick another class to continue.",
};

const FEED_FAILED = {
  title: "Something went wrong",
  message: "Please try again.",
};

export function StudentDashboard() {
  const { isCompleted, toggleCompleted } = useAssignmentStatus();
  const { selection, selectClass, clearClass } = useStudentClass();
  const classes = useActiveClasses();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);

  const classId = selection.status === "ready" ? selection.classId : null;
  const feed = useClassAssignments(classId);

  // A class deactivated while the page is open stops being offered, and the
  // student is returned to the picker rather than left on a dead dashboard.
  const classIsListed = isClassStillListed(selection, classes);
  useEffect(() => {
    if (classId && !classIsListed && classes.status === "ready") clearClass();
  }, [classId, classIsListed, classes.status, clearClass]);

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

  // No class chosen yet: the first-run picker, unless the link named one that
  // turned out to be unavailable.
  if (selection.status === "unavailable") {
    return (
      <AppShell query={query} onQueryChange={setQuery} switcher={null}>
        <EmptyState {...CLASS_UNAVAILABLE} />
        {classes.status === "ready" && classes.data.length > 0 && (
          <ClassPicker classes={classes.data} onSelect={selectClass} />
        )}
      </AppShell>
    );
  }

  // No class at all. This is the fallback path, not the front door — the shared
  // link is how students normally arrive.
  if (!classId) {
    if (classes.status === "loading") {
      return (
        <AppShell query={query} onQueryChange={setQuery} switcher={null}>
          <EmptyState {...LOADING} />
        </AppShell>
      );
    }

    if (classes.status === "error") {
      return (
        <AppShell query={query} onQueryChange={setQuery} switcher={null}>
          <EmptyState {...FEED_FAILED} />
        </AppShell>
      );
    }

    return (
      <AppShell query={query} onQueryChange={setQuery} switcher={null}>
        {classes.data.length === 0 ? (
          <EmptyState
            title="No classes are open yet"
            message="Check back once your class representative has posted."
          />
        ) : (
          <ClassPicker classes={classes.data} onSelect={selectClass} />
        )}
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

  const switcher =
    classes.status === "ready" && classes.data.length > 0 ? (
      <ClassSwitcher
        classes={classes.data}
        selectedId={classId}
        onSelect={selectClass}
      />
    ) : null;

  return (
    <AppShell query={query} onQueryChange={setQuery} switcher={switcher}>
      <Greeting />

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
