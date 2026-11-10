import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { AssignmentsTab } from "../components/class/AssignmentsTab";
import { ManageTab } from "../components/class/ManageTab";
import { MembersTab } from "../components/class/MembersTab";
import { SettingsTab } from "../components/class/SettingsTab";
import { EmptyState } from "../components/EmptyState";
import { LinkIcon, PlusIcon } from "../components/icons";
import { inviteLink } from "../data/classes";
import { setCompleted, subscribeToClassData, type ClassData } from "../data/classData";
import { canManage, ROLE_LABELS, type ClassInfo, type Loadable } from "../data/types";
import { useAppContext } from "./AppLayout";

type Tab = "assignments" | "manage" | "members" | "settings";

const LOADING: Loadable<ClassData> = { status: "loading", data: null, error: null };

export function ClassPage() {
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

  // Keyed so switching classes resets tabs, filters and the editor.
  return <ClassView key={info.id} info={info} />;
}

function ClassView({ info }: { info: ClassInfo }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const manager = canManage(info.role);

  const [tab, setTab] = useState<Tab>("assignments");
  const [data, setData] = useState<Loadable<ClassData>>(LOADING);
  /** Ticks the person changed that the server has not confirmed yet. */
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Asks the Manage tab to open a blank form. */
  const [composeRequested, setComposeRequested] = useState(false);
  const onComposeHandled = useCallback(() => setComposeRequested(false), []);

  useEffect(() => {
    if (!userId) return;
    return subscribeToClassData(info.id, userId, setData);
  }, [info.id, userId]);

  // A role change can take Manage away while it is open.
  useEffect(() => {
    if (!manager && tab === "manage") setTab("assignments");
  }, [manager, tab]);

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
    [isCompleted, userId],
  );

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(info.inviteCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setTab("settings");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "assignments", label: "Assignments" },
    ...(manager ? [{ id: "manage" as const, label: "Manage" }] : []),
    { id: "members", label: `Members${data.data ? ` · ${data.data.members.length}` : ""}` },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <header className="class-header">
        <div className="class-header__inner">
          <div className="class-header__text">
            <h1 className="class-header__name">{info.name}</h1>
            <p className="class-header__meta">
              <span className={`badge badge--role-${info.role}`}>{ROLE_LABELS[info.role]}</span>
              {info.description && <span className="class-header__description">{info.description}</span>}
            </p>
          </div>
          <div className="class-header__actions">
            <button type="button" className="button button--ghost" onClick={() => void copyInvite()}>
              <LinkIcon size={15} />
              {copied ? "Link copied" : "Invite"}
            </button>
            {manager && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setTab("manage");
                  setComposeRequested(true);
                }}
              >
                <PlusIcon size={15} />
                Post assignment
              </button>
            )}
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Class sections">
          {tabs.map((each) => (
            <button
              key={each.id}
              type="button"
              role="tab"
              id={`tab-${each.id}`}
              aria-selected={tab === each.id}
              aria-controls="class-panel"
              className={`tabs__tab${tab === each.id ? " tabs__tab--active" : ""}`}
              onClick={() => setTab(each.id)}
            >
              {each.label}
            </button>
          ))}
        </div>
      </header>

      <main className="content" id="class-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {data.status === "error" && <EmptyState title="Something went wrong" message={data.error} />}

        {tab === "assignments" && data.status !== "error" && (
          <AssignmentsTab
            data={data}
            isCompleted={isCompleted}
            onToggle={toggleCompleted}
            toggleError={toggleError}
          />
        )}

        {tab === "manage" && manager && data.status !== "error" && (
          <ManageTab
            classId={info.id}
            data={data}
            composeRequested={composeRequested}
            onComposeHandled={onComposeHandled}
          />
        )}

        {tab === "members" && data.status !== "error" && (
          <MembersTab info={info} members={data.data?.members ?? null} />
        )}

        {tab === "settings" && <SettingsTab info={info} />}
      </main>
    </>
  );
}
