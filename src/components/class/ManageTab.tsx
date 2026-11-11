import { useEffect, useMemo, useState } from "react";

import { toFriendlyError } from "../../auth/errors";
import { setAssignmentActive } from "../../data/assignments";
import type { ClassData } from "../../data/classData";
import type { Loadable, ManagedAssignment } from "../../data/types";
import { formatDueDate, getDueLabel, sortAssignments } from "../../utils/assignmentStatus";
import { AttachmentLinks } from "../AttachmentLinks";
import { EmptyState } from "../EmptyState";
import { PlusIcon } from "../icons";
import { Listbox, type ListboxOption } from "../Listbox";
import { cssVar, fallbackColor, subjectColor } from "../../utils/subjectColor";
import { AssignmentDialog } from "./AssignmentDialog";

type Visibility = "active" | "archived" | "all";

const VISIBILITY_OPTIONS: ListboxOption[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

type Editor = { open: false } | { open: true; assignment: ManagedAssignment | null };

type Props = {
  classId: string;
  data: Loadable<ClassData>;
};

const ALL_SUBJECTS = "all";

/** Owners and admins: post, edit and archive assignments. Subjects have their own tab. */
export function ManageTab({ classId, data }: Props) {
  const [visibility, setVisibility] = useState<Visibility>("active");
  const [editor, setEditor] = useState<Editor>({ open: false });
  const [isSaving, setIsSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [subject, setSubject] = useState(ALL_SUBJECTS);

  const all = useMemo(() => data.data?.assignments ?? [], [data.data]);
  const subjects = data.data?.subjects ?? [];
  const active = useMemo(() => all.filter((each) => each.active), [all]);
  const archived = useMemo(() => all.filter((each) => !each.active), [all]);

  const visible = useMemo(() => {
    const source = visibility === "active" ? active : visibility === "archived" ? archived : all;
    return source.filter((each) => subject === ALL_SUBJECTS || each.subject === subject).sort(sortAssignments);
  }, [visibility, subject, active, archived, all]);

  // One group per subject, alphabetical; each in date order.
  const groups = useMemo(() => {
    const byId = new Map(subjects.map((each) => [each.id, each]));
    const map = new Map<string, { key: string; name: string; teacher: string; color: string; items: ManagedAssignment[] }>();
    for (const assignment of visible) {
      const key = assignment.subjectId || assignment.subject;
      const info = byId.get(assignment.subjectId);
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          name: info?.name ?? assignment.subject,
          teacher: info?.teacher ?? "",
          color: info ? subjectColor(info) : fallbackColor(assignment.subject),
          items: [],
        };
        map.set(key, group);
      }
      group.items.push(assignment);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [visible, subjects]);

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

  function openEditor(assignment: ManagedAssignment | null) {
    setWriteError(null);
    setNotice(null);
    setEditor({ open: true, assignment });
  }

  async function runWrite(action: () => Promise<void>, success: string) {
    setIsSaving(true);
    setWriteError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (error) {
      setWriteError(toFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
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
      {writeError && (
        <p className="form__error" role="alert">
          {writeError}
        </p>
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
          <button type="button" className="button button--primary" onClick={() => openEditor(null)}>
            <PlusIcon size={15} />
            Post assignment
          </button>
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

        {groups.length > 0 && (
          <div className="subject-groups">
            {groups.map((group) => (
              <section
                key={group.key}
                className="subject-group"
                style={cssVar("--subject", group.color)}
                aria-labelledby={`group-${group.key}`}
              >
                <header className="subject-group__head">
                  <span className="subject-swatch" aria-hidden="true" />
                  <span className="subject-group__titles">
                    <h3 className="subject-group__name" id={`group-${group.key}`}>
                      {group.name}
                    </h3>
                    {group.teacher && <span className="subject-group__teacher">{group.teacher}</span>}
                  </span>
                  <span className="subject-group__count">{group.items.length}</span>
                </header>

                <ul className="record-list">
                  {group.items.map((assignment) => (
                    <li key={assignment.id} className={`record${assignment.active ? "" : " record--archived"}`}>
                      <div className="record__body">
                        <p className="record__title">
                          {assignment.title}
                          {!assignment.active && <span className="badge badge--archived">Archived</span>}
                        </p>
                        {assignment.description && <p className="record__description">{assignment.description}</p>}
                        <AttachmentLinks files={assignment.attachments} />
                      </div>

                      <div className="record__aside">
                        <span className="record__date">
                          {assignment.priority !== "none" && (
                            <span className={`badge badge--priority-${assignment.priority}`}>{assignment.priority}</span>
                          )}
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
                            onClick={() => openEditor(assignment)}
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
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <AssignmentDialog
        open={editor.open}
        classId={classId}
        subjects={subjects}
        assignment={editor.open ? editor.assignment : null}
        onClose={() => setEditor({ open: false })}
        onSaved={setNotice}
      />
    </>
  );
}
