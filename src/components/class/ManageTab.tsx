import { useEffect, useMemo, useRef, useState } from "react";

import { toFriendlyError } from "../../auth/errors";
import { createAssignment, setAssignmentActive, updateAssignment } from "../../data/assignments";
import type { ClassData } from "../../data/classData";
import type { Loadable, ManagedAssignment } from "../../data/types";
import { formatDueDate, getDueLabel, sortAssignments } from "../../utils/assignmentStatus";
import { AssignmentForm, type Submission } from "../AssignmentForm";
import { EmptyState } from "../EmptyState";
import { PaperclipIcon } from "../icons";
import { Listbox, type ListboxOption } from "../Listbox";

type Visibility = "active" | "archived" | "all";

const VISIBILITY_OPTIONS: ListboxOption[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

type Editor = { mode: "closed" } | { mode: "create" } | { mode: "edit"; assignment: ManagedAssignment };

type Props = {
  classId: string;
  data: Loadable<ClassData>;
  /** True after the header's "Post assignment" is pressed, until handled. */
  composeRequested: boolean;
  onComposeHandled: () => void;
};

const ALL_SUBJECTS = "all";

/** Owners and admins: post, edit and archive assignments. Subjects have their own tab. */
export function ManageTab({ classId, data, composeRequested, onComposeHandled }: Props) {
  const [visibility, setVisibility] = useState<Visibility>("active");
  const [editor, setEditor] = useState<Editor>({ mode: "closed" });
  const [isSaving, setIsSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [subject, setSubject] = useState(ALL_SUBJECTS);

  useEffect(() => {
    if (!composeRequested) return;
    setWriteError(null);
    setNotice(null);
    setEditor({ mode: "create" });
    onComposeHandled();
  }, [composeRequested, onComposeHandled]);

  useEffect(() => {
    if (editor.mode !== "closed") panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editor]);

  const all = useMemo(() => data.data?.assignments ?? [], [data.data]);
  const subjects = data.data?.subjects ?? [];
  const active = useMemo(() => all.filter((each) => each.active), [all]);
  const archived = useMemo(() => all.filter((each) => !each.active), [all]);

  const visible = useMemo(() => {
    const source = visibility === "active" ? active : visibility === "archived" ? archived : all;
    return source.filter((each) => subject === ALL_SUBJECTS || each.subject === subject).sort(sortAssignments);
  }, [visibility, subject, active, archived, all]);

  // Every subject that has work posted under it, archived subjects included,
  // so old assignments can still be found.
  const subjectOptions: ListboxOption[] = useMemo(() => {
    const names = [...new Set(all.map((each) => each.subject))].sort((a, b) => a.localeCompare(b));
    return [{ value: ALL_SUBJECTS, label: "All subjects" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [all]);

  // A subject whose last assignment went away: fall back to all of them.
  useEffect(() => {
    if (subject !== ALL_SUBJECTS && !subjectOptions.some((each) => each.value === subject)) setSubject(ALL_SUBJECTS);
  }, [subject, subjectOptions]);

  function closeEditor() {
    setEditor({ mode: "closed" });
    setWriteError(null);
  }

  async function runWrite(action: () => Promise<void>, success: string, closeAfter = true) {
    setIsSaving(true);
    setWriteError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      if (closeAfter) closeEditor();
    } catch (error) {
      setWriteError(toFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit({ attachment, ...draft }: Submission) {
    if (editor.mode === "edit") {
      const current = editor.assignment;
      void runWrite(() => updateAssignment(current, draft, attachment), "Assignment updated.");
      return;
    }
    void runWrite(async () => {
      await createAssignment(classId, draft, attachment);
    }, "Assignment posted. Your class can see it now.");
  }

  function handleToggleActive(assignment: ManagedAssignment) {
    const next = !assignment.active;
    void runWrite(
      () => setAssignmentActive(assignment.id, next),
      next ? "Assignment restored." : "Assignment archived. Members no longer see it.",
    );
  }

  return (
    <>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {/* With the editor open, the form shows the error itself. */}
      {writeError && editor.mode === "closed" && (
        <p className="form__error" role="alert">
          {writeError}
        </p>
      )}

      {editor.mode !== "closed" && (
        <div className="panel" ref={panelRef}>
          <h3 className="panel__title">{editor.mode === "edit" ? "Edit assignment" : "New assignment"}</h3>
          <AssignmentForm
            assignment={editor.mode === "edit" ? editor.assignment : null}
            subjects={subjects}
            isSaving={isSaving}
            error={writeError}
            onSubmit={handleSubmit}
            onCancel={closeEditor}
          />
        </div>
      )}

      <section className="section">
        <div className="toolbar">
          <h2 className="toolbar__title">Assignments</h2>
          <div className="filters filters--manage">
            <Listbox
              id="visibility-filter"
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(value) => setVisibility(value as Visibility)}
              ariaLabel="Show active or archived assignments"
            />
            <Listbox
              id="manage-subject-filter"
              options={subjectOptions}
              value={subject}
              onChange={setSubject}
              ariaLabel="Filter by subject"
            />
          </div>
        </div>

        <p className="section-lead">
          {active.length} active, {archived.length} archived. Archiving hides an assignment from members
          without deleting it.
        </p>

        {data.status === "loading" && (
          <p className="section-lead" role="status">
            Loading…
          </p>
        )}

        {data.status === "ready" && visible.length === 0 && (
          <EmptyState
            title={
              subject !== ALL_SUBJECTS
                ? `Nothing here for ${subject}`
                : visibility === "archived"
                  ? "Nothing archived"
                  : "No assignments yet"
            }
            message={
              subject !== ALL_SUBJECTS
                ? "Try another subject, or show all of them."
                : visibility === "archived"
                  ? "Archived assignments show up here."
                  : "Post your first assignment and everyone in the class sees it straight away."
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
                  {assignment.description && <p className="record__description">{assignment.description}</p>}
                  {assignment.attachment && (
                    <a className="row__attachment" href={assignment.attachment} target="_blank" rel="noreferrer">
                      <PaperclipIcon size={13} />
                      {assignment.attachmentName || "Attachment"}
                    </a>
                  )}
                </div>

                <p className="record__aside">
                  {assignment.priority !== "none" && (
                    <span className={`badge badge--priority-${assignment.priority}`}>{assignment.priority}</span>
                  )}
                  <span className="record__date">
                    {/* Archived work shows the plain date, not "Overdue by…". */}
                    {assignment.active || !assignment.dueDate
                      ? getDueLabel(assignment)
                      : formatDueDate(assignment.dueDate)}
                  </span>
                  <span className="record__actions">
                    <button
                      type="button"
                      className="link-button"
                      disabled={isSaving}
                      onClick={() => {
                        setWriteError(null);
                        setNotice(null);
                        setEditor({ mode: "edit", assignment });
                      }}
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
      </section>

    </>
  );
}
