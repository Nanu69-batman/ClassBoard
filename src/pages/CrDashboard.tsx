import { useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { AssignmentForm, type AssignmentDraftValues } from "../components/AssignmentForm";
import { EmptyState } from "../components/EmptyState";
import { PrivilegedShell, type NavItem } from "../components/PrivilegedShell";
import { StatCards } from "../components/StatCards";
import {
  createAssignment,
  setAssignmentActive,
  updateAssignment,
  type AssignmentDraft,
} from "../data/crRepository";
import type { CrAssignment } from "../data/types";
import { useCrAssignments, useCrClass, useCrSubjects } from "../hooks/useCrData";
import { countAssignments, getRelativeDueText, sortAssignments } from "../utils/assignmentStatus";

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "assignments", label: "Assignments" },
  { id: "subjects", label: "Subjects" },
  { id: "account", label: "Account" },
];

/** Which assignments the list is showing. Archived work is never mixed in silently. */
type Visibility = "active" | "archived" | "all";

const VISIBILITY_LABELS: Record<Visibility, string> = {
  active: "Active",
  archived: "Archived",
  all: "All",
};

type Editor = { mode: "closed" } | { mode: "create" } | { mode: "edit"; assignment: CrAssignment };

/**
 * The CR's dashboard: everything scoped to their own class.
 *
 * ## The class comes from the profile, never from the URL
 *
 * `profile.classId` is the only class this page will read or write. There is no
 * class picker and no `:classId` route parameter, so there is no input to tamper
 * with. That is only half of the guarantee — the rules independently refuse every
 * write outside this class — but it means the UI never even offers the attempt.
 */
export function CrDashboard() {
  const { profile, user } = useAuth();
  const classId = profile?.classId ?? null;

  const [section, setSection] = useState("dashboard");
  const [isNavOpen, setIsNavOpen] = useState(false);

  const classInfo = useCrClass(classId);
  const assignments = useCrAssignments(classId);
  const subjects = useCrSubjects(classId);

  const [visibility, setVisibility] = useState<Visibility>("active");
  const [editor, setEditor] = useState<Editor>({ mode: "closed" });
  const [isSaving, setIsSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The name a student will see against this assignment. Falls back through the
  // profile and then the auth record, so a CR whose profile has no displayName
  // still publishes something rather than an empty string.
  const authorName = profile?.displayName?.trim() || user?.displayName || "Your CR";

  const all = assignments.data ?? [];
  const active = useMemo(() => all.filter((each) => each.active), [all]);
  const archived = useMemo(() => all.filter((each) => !each.active), [all]);

  const visible = useMemo(() => {
    const source = visibility === "active" ? active : visibility === "archived" ? archived : all;
    return [...source].sort(sortAssignments);
  }, [visibility, active, archived, all]);

  // Nothing here is student completion — this is the CR's own view, so nothing is
  // "completed". Overdue and due-soon come straight from the due dates.
  const counts = useMemo(() => countAssignments(active, () => false), [active]);

  const hasClass = Boolean(classId);

  function closeEditor() {
    setEditor({ mode: "closed" });
    setWriteError(null);
  }

  async function runWrite(action: () => Promise<void>, successMessage: string) {
    setIsSaving(true);
    setWriteError(null);
    setNotice(null);

    try {
      await action();
      setNotice(successMessage);
      closeEditor();
    } catch (error) {
      // toFriendlyError, never the raw SDK message: it can carry internal detail
      // and a permission denial is not something a CR can act on anyway (§29).
      setWriteError(toFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(draft: AssignmentDraftValues) {
    if (!classId) return;

    // The display name is denormalised from the subject document, so a student
    // sees it without a second read and a later subject rename cannot silently
    // rewrite history on assignments already posted.
    const subject = subjects.data?.find((each) => each.id === draft.subjectId);
    const payload: AssignmentDraft = {
      ...draft,
      subjectName: subject?.name ?? "General",
    };

    if (editor.mode === "edit") {
      const id = editor.assignment.id;
      void runWrite(
        () => updateAssignment(classId, id, payload),
        "Assignment updated.",
      );
      return;
    }

    void runWrite(
      async () => {
        await createAssignment(classId, payload, {
          uid: user?.uid ?? "",
          displayName: authorName,
        });
      },
      "Assignment posted. Your class can see it now.",
    );
  }

  function handleToggleActive(assignment: CrAssignment) {
    if (!classId) return;
    const next = !assignment.active;
    void runWrite(
      () => setAssignmentActive(classId, assignment.id, next),
      next ? "Assignment restored." : "Assignment archived. Students no longer see it.",
    );
  }

  const contextLabel = classInfo.data?.displayName ?? classId ?? "No class assigned";

  if (!hasClass) {
    return (
      <PrivilegedShell
        areaLabel="CR dashboard"
        contextLabel="No class assigned"
        navItems={NAV}
        activeSection={section}
        onSelectSection={setSection}
        isNavOpen={isNavOpen}
        onMenuClick={() => setIsNavOpen((value) => !value)}
      >
        <EmptyState
          title="No class assigned to your account"
          message="A class representative is bound to exactly one class. Ask your superadmin to assign you to one."
        />
      </PrivilegedShell>
    );
  }

  const listBody = (
    <>
      {assignments.status === "loading" && (
        <p className="section-lead" role="status">
          Loading your assignments…
        </p>
      )}

      {assignments.status === "error" && (
        <EmptyState title="Something went wrong" message={assignments.error} />
      )}

      {assignments.status === "ready" && visible.length === 0 && (
        <EmptyState
          title={
            visibility === "archived"
              ? "Nothing archived"
              : visibility === "active"
                ? "No assignments yet"
                : "Nothing here yet"
          }
          message={
            visibility === "active"
              ? "Post your first assignment and it appears on your class page straight away."
              : "Archived assignments show up here once you remove one."
          }
        />
      )}

      {visible.length > 0 && (
        <ul className="record-list">
          {visible.map((assignment) => (
            <li key={assignment.id} className={`record${assignment.active ? "" : " record--archived"}`}>
              <div className="record__body">
                <p className="record__meta">
                  {assignment.subject}
                  {!assignment.active && <span className="badge badge--archived">Archived</span>}
                </p>
                <p className="record__title">{assignment.title}</p>
                {assignment.description && (
                  <p className="record__description">{assignment.description}</p>
                )}
              </div>

              <p className="record__aside">
                <span className={`badge badge--priority-${assignment.priority}`}>
                  {assignment.priority}
                </span>
                <span className="record__date">
                  {assignment.active
                    ? getRelativeDueText(assignment.dueDate)
                    : assignment.dueDate}
                </span>

                <span className="record__actions">
                  <button
                    type="button"
                    className="link-button"
                    disabled={isSaving}
                    onClick={() =>
                      setEditor({ mode: "edit", assignment })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    disabled={isSaving}
                    onClick={() => handleToggleActive(assignment)}
                  >
                    {assignment.active ? "Archive" : "Restore"}
                  </button>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <PrivilegedShell
      areaLabel="CR dashboard"
      contextLabel={contextLabel}
      navItems={NAV}
      activeSection={section}
      onSelectSection={setSection}
      isNavOpen={isNavOpen}
      onMenuClick={() => setIsNavOpen((value) => !value)}
    >
      {section === "dashboard" && (
        <>
          <div className="greeting">
            <h1 className="greeting__title">
              {contextLabel} <span aria-hidden="true">📋</span>
            </h1>
            <p className="greeting__subtitle">
              Everything here is scoped to your class. Students see these assignments without an
              account.
            </p>
          </div>

          <StatCards counts={counts} />

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {writeError && !editor.mode.startsWith("create") && (
            <p className="form__error" role="alert">
              {writeError}
            </p>
          )}

          <div className="toolbar">
            <h2 className="toolbar__title">Your assignments</h2>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setWriteError(null);
                setNotice(null);
                setEditor({ mode: "create" });
              }}
            >
              Post assignment
            </button>
          </div>

          {editor.mode !== "closed" && (
            <div className="panel">
              <h3 className="panel__title">
                {editor.mode === "edit" ? "Edit assignment" : "New assignment"}
              </h3>
              <AssignmentForm
                assignment={editor.mode === "edit" ? editor.assignment : null}
                subjects={subjects.data ?? []}
                isSaving={isSaving}
                error={writeError}
                onSubmit={handleSubmit}
                onCancel={closeEditor}
              />
            </div>
          )}

          {listBody}
        </>
      )}

      {section === "assignments" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Assignments</h2>
            <div className="segmented" role="group" aria-label="Filter by status">
              {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="segmented__button"
                  aria-pressed={visibility === value}
                  onClick={() => setVisibility(value)}
                >
                  {VISIBILITY_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <p className="section-lead">
            {active.length} active, {archived.length} archived. Archiving hides an assignment from
            students without deleting it.
          </p>

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {writeError && (
            <p className="form__error" role="alert">
              {writeError}
            </p>
          )}

          {editor.mode !== "closed" && (
            <div className="panel">
              <h3 className="panel__title">
                {editor.mode === "edit" ? "Edit assignment" : "New assignment"}
              </h3>
              <AssignmentForm
                assignment={editor.mode === "edit" ? editor.assignment : null}
                subjects={subjects.data ?? []}
                isSaving={isSaving}
                error={writeError}
                onSubmit={handleSubmit}
                onCancel={closeEditor}
              />
            </div>
          )}

          {listBody}
        </>
      )}

      {section === "subjects" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Subjects</h2>
            <span className="badge badge--upcoming">{(subjects.data ?? []).length} subjects</span>
          </div>

          {subjects.status === "loading" && (
            <p className="section-lead" role="status">
              Loading subjects…
            </p>
          )}

          {subjects.status === "error" && (
            <EmptyState title="Something went wrong" message={subjects.error} />
          )}

          {subjects.status === "ready" && (subjects.data ?? []).length === 0 && (
            <EmptyState
              title="No subjects yet"
              message="Subjects are managed by your superadmin. An assignment needs one before you can post it."
            />
          )}

          <ul className="record-list">
            {(subjects.data ?? []).map((subject) => (
              <li
                key={subject.id}
                className={`record${subject.active ? "" : " record--archived"}`}
              >
                <div className="record__body">
                  <p className="record__title">{subject.name}</p>
                </div>
                <p className="record__aside">
                  <span className="badge badge--upcoming">{subject.shortName}</span>
                  {!subject.active && <span className="badge badge--archived">Archived</span>}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {section === "account" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Account</h2>
          </div>
          <dl className="detail-list">
            <div className="detail">
              <dt className="detail__label">Name</dt>
              <dd className="detail__value">{profile?.displayName ?? "—"}</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Email</dt>
              <dd className="detail__value">{user?.email ?? "—"}</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Role</dt>
              <dd className="detail__value">Class representative</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Class</dt>
              <dd className="detail__value">{contextLabel}</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Class link</dt>
              <dd className="detail__value">
                {window.location.origin}/class/{classId}
              </dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Sign-in method</dt>
              <dd className="detail__value">
                {user?.providerData?.some((provider) => provider.providerId === "google.com")
                  ? "Google"
                  : "Email and password"}
              </dd>
            </div>
          </dl>
          <p className="section-lead">
            Share the class link above with your class. Password changes go through your superadmin
            in the Firebase console. Email self-service is optional and not enabled.
          </p>
        </>
      )}
    </PrivilegedShell>
  );
}
