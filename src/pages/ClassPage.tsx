import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { AssignmentsTab } from "../components/class/AssignmentsTab";
import { EmptyState } from "../components/EmptyState";
import { PlusIcon } from "../components/icons";
import { PageHero } from "../components/PageHero";
import { setCompleted, type ClassData } from "../data/classData";
import { canManage, ROLE_LABELS, type ClassInfo, type Loadable } from "../data/types";
import { useClassData } from "../data/useClassData";
import { countAssignments } from "../utils/assignmentStatus";
import { useAppContext } from "./AppLayout";
import { ClassManageView } from "./ClassManageView";

/**
 * `/app/:classId` and `/app/:classId/manage/:section`.
 *
 * The class itself is for the work: assignments now, practicals and files
 * later. Running the class (posting, members, settings) is a separate page, so
 * the two never compete for the same row of tabs.
 */
export function ClassPage({ view = "class" }: { view?: "class" | "manage" }) {
  const { classId = "" } = useParams<{ classId: string }>();
  const { classes } = useAppContext();

  const info = classes.data?.find((each) => each.id === classId) ?? null;

  if (classes.status === "loading") {
    return (
      <main className="content">
        <EmptyState title="Loading…" message="Fetching your class." />
      </main>
    );
  }

  if (!info) {
    return (
      <main className="content">
        <EmptyState
          title="You're not in this class"
          message="You may have left it, been removed, or the class was deleted. If you have an invite link, open it to join."
        />
        <Link className="button button--primary align-start" to="/app">
          Back to your classes
        </Link>
      </main>
    );
  }

  // Keyed so switching classes resets filters and the editor.
  return view === "manage" ? <ClassManageView key={info.id} info={info} /> : <ClassView key={info.id} info={info} />;
}

/** The kinds of work a class holds. Practicals and files will join this list. */
type Section = "assignments";

const SECTIONS: { id: Section; label: string }[] = [{ id: "assignments", label: "Assignments" }];

function ClassView({ info }: { info: ClassInfo }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const manager = canManage(info.role);

  const [section, setSection] = useState<Section>("assignments");
  const [data, setData] = useClassData(info.id, userId);
  /** Ticks the person changed that the server has not confirmed yet. */
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [toggleError, setToggleError] = useState<string | null>(null);

  const serverCompleted = data.data?.completedIds;

  const isCompleted = useCallback(
    (id: string) => pending.get(id) ?? serverCompleted?.has(id) ?? false,
    [pending, serverCompleted],
  );

  const toggleCompleted = useCallback(
    (id: string) => {
      const next = !isCompleted(id);
      setToggleError(null);
      setPending((current) => new Map(current).set(id, next));

      setCompleted(id, next, userId)
        .then(() => {
          // Fold the confirmed value into the server set, then drop the override.
          setData((current) => {
            if (current.status !== "ready") return current;
            const completedIds = new Set(current.data.completedIds);
            if (next) completedIds.add(id);
            else completedIds.delete(id);
            return { ...current, data: { ...current.data, completedIds } };
          });
        })
        .catch((cause) => setToggleError(toFriendlyError(cause)))
        .finally(() =>
          setPending((current) => {
            const copy = new Map(current);
            copy.delete(id);
            return copy;
          }),
        );
    },
    [isCompleted, userId, setData],
  );

  return (
    <main className="content content--wide">
      <PageHero
        title={info.name}
        subtitle={<PendingSummary data={data} isCompleted={isCompleted} />}
        meta={
          <>
            <span className={`badge badge--role-${info.role}`}>{ROLE_LABELS[info.role]}</span>
            {info.description && <span className="hero__description">{info.description}</span>}
          </>
        }
        actions={
          manager && (
            <Link className="button button--primary" to={`/app/${info.id}/manage/assignments?compose=1`}>
              <PlusIcon size={15} />
              Post assignment
            </Link>
          )
        }
      />

      <div className="tabs" role="tablist" aria-label="Class work">
        {SECTIONS.map((each) => (
          <button
            key={each.id}
            type="button"
            role="tab"
            id={`tab-${each.id}`}
            aria-selected={section === each.id}
            aria-controls="class-panel"
            className={`tabs__tab${section === each.id ? " tabs__tab--active" : ""}`}
            onClick={() => setSection(each.id)}
          >
            {each.label}
          </button>
        ))}
      </div>

      <div className="tab-panel" id="class-panel" role="tabpanel" aria-labelledby={`tab-${section}`}>
        {data.status === "error" && <EmptyState title="Something went wrong" message={data.error} />}

        {section === "assignments" && data.status !== "error" && (
          <AssignmentsTab
            data={data}
            isCompleted={isCompleted}
            onToggle={toggleCompleted}
            toggleError={toggleError}
          />
        )}
      </div>
    </main>
  );
}

/** "You have 5 pending assignments." — the one line of status under the class name. */
function PendingSummary({
  data,
  isCompleted,
}: {
  data: Loadable<ClassData>;
  isCompleted: (id: string) => boolean;
}) {
  if (data.status !== "ready") return null;

  const active = data.data.assignments.filter((each) => each.active);
  const counts = countAssignments(active, isCompleted);

  if (active.length === 0) return <>Nothing has been posted here yet.</>;
  if (counts.pending === 0) return <>You're all caught up.</>;

  return (
    <>
      You have <strong>{counts.pending}</strong> pending{" "}
      {counts.pending === 1 ? "assignment" : "assignments"}.
      {counts.overdue > 0 && (
        <>
          {" "}
          <span className="hero__overdue">{counts.overdue} overdue.</span>
        </>
      )}
    </>
  );
}
