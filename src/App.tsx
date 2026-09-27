import { useEffect, useMemo, useRef, useState } from "react";

import { AssignmentList } from "./components/AssignmentList";
import { EmptyState } from "./components/EmptyState";
import { FilterBar, type StatusFilter } from "./components/FilterBar";
import { Greeting } from "./components/Greeting";
import { Sidebar } from "./components/Sidebar";
import { StatCards } from "./components/StatCards";
import { TopBar } from "./components/TopBar";
import { assignments, getSubjects } from "./data/assignments";
import { useAssignmentStatus } from "./hooks/useAssignmentStatus";
import { countAssignments, groupAssignmentsByStatus } from "./utils/assignmentStatus";

const ALL_SUBJECTS = "all";

const SUBJECTS = getSubjects();

const CAUGHT_UP = {
  title: "You're all caught up 🎉",
  message: "No pending assignments.",
};

export default function App() {
  const { isCompleted, toggleCompleted } = useAssignmentStatus();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  const menuRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLButtonElement>(null);
  const wasNavOpen = useRef(false);

  // Move focus into the drawer when it opens and back to the button when it
  // closes, so keyboard users are never stranded off screen.
  useEffect(() => {
    if (isNavOpen) {
      navRef.current?.focus();
    } else if (wasNavOpen.current) {
      menuRef.current?.focus();
    }
    wasNavOpen.current = isNavOpen;
  }, [isNavOpen]);

  useEffect(() => {
    if (!isNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNavOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isNavOpen]);

  const counts = useMemo(
    () => countAssignments(assignments, isCompleted),
    [isCompleted],
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
  }, [query, subject, statusFilter, isCompleted]);

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

  let emptyState: { title: string; message: string } | null = null;
  if (groups.length === 0) {
    if (isNarrowed) {
      emptyState = {
        title: "No assignments found",
        message: "Try a different search.",
      };
    } else if (statusFilter === "completed") {
      emptyState = {
        title: "Nothing completed yet",
        message: "Mark an assignment as done and it will show up here.",
      };
    } else {
      emptyState = CAUGHT_UP;
    }
  } else if (isCaughtUp && statusFilter === "all") {
    emptyState = CAUGHT_UP;
  }

  return (
    <div className="app">
      <Sidebar
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        navRef={navRef}
      />

      <div className="main">
        <TopBar
          query={query}
          onQueryChange={setQuery}
          isNavOpen={isNavOpen}
          onMenuClick={() => setIsNavOpen((value) => !value)}
          menuRef={menuRef}
        />

        <main className="content">
          <Greeting />

          <StatCards counts={counts} />

          <div className="toolbar">
            <h2 className="toolbar__title">Assignments</h2>
            <FilterBar
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              subjects={SUBJECTS}
              subject={subject}
              onSubjectChange={setSubject}
            />
          </div>

          {emptyState && <EmptyState {...emptyState} />}

          {groups.length > 0 && (
            <AssignmentList
              groups={groups}
              isCompleted={isCompleted}
              onToggle={handleToggle}
              lastToggledId={lastToggledId}
            />
          )}
        </main>
      </div>
    </div>
  );
}
