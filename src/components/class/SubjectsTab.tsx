import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { toFriendlyError } from "../../auth/errors";
import { setSubjectActive } from "../../data/assignments";
import type { ClassData } from "../../data/classData";
import type { Loadable, SubjectInfo } from "../../data/types";
import { EmptyState } from "../EmptyState";
import { PlusIcon } from "../icons";
import { SubjectDialog } from "./SubjectDialog";

type Props = {
  classId: string;
  data: Loadable<ClassData>;
};

type Editor = { open: false } | { open: true; subject: SubjectInfo | null };

/** Owners and admins: add subjects with their teachers, edit them, archive old ones. */
export function SubjectsTab({ classId, data }: Props) {
  const [editor, setEditor] = useState<Editor>({ open: false });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // "Add a subject" from the post-assignment dialog lands here with ?add=1.
  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    setEditor({ open: true, subject: null });
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("add");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const subjects = data.data?.subjects ?? [];
  const activeCount = subjects.filter((each) => each.active).length;

  async function toggleActive(subject: SubjectInfo) {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await setSubjectActive(subject.id, !subject.active);
      setNotice(subject.active ? `"${subject.name}" archived.` : `"${subject.name}" restored.`);
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsSaving(false);
    }
  }

  function openEditor(subject: SubjectInfo | null) {
    setError(null);
    setNotice(null);
    setEditor({ open: true, subject });
  }

  return (
    <section className="section">
      <div className="toolbar">
        <h2 className="toolbar__title">Subjects</h2>
        <button type="button" className="button button--primary" onClick={() => openEditor(null)}>
          <PlusIcon size={15} />
          Add subject
        </button>
      </div>

      {subjects.length > 0 && (
        <p className="section-lead">
          {activeCount} in use, {subjects.length - activeCount} archived. Archived subjects can't be picked for new
          work; anything already posted under them stays.
        </p>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {data.status === "loading" && (
        <p className="section-lead" role="status">
          Loading…
        </p>
      )}

      {data.status === "ready" && subjects.length === 0 && (
        <EmptyState
          title="No subjects yet"
          message="Add the subjects your class takes, with who teaches each one. Assignments are posted under them."
        />
      )}

      {subjects.length > 0 && (
        <ul className="record-list">
          {subjects.map((subject) => (
            <li key={subject.id} className={`record${subject.active ? "" : " record--archived"}`}>
              <div className="record__body">
                <p className="record__title">
                  {subject.name}
                  {!subject.active && <span className="badge badge--archived">Archived</span>}
                </p>
                <p className="record__description">
                  {subject.teacher ? `Taught by ${subject.teacher}` : "No teacher added"}
                </p>
              </div>
              <p className="record__aside">
                <span className="record__actions">
                  <button
                    type="button"
                    className="link-button"
                    disabled={isSaving}
                    onClick={() => openEditor(subject)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    disabled={isSaving}
                    onClick={() => void toggleActive(subject)}
                  >
                    {subject.active ? "Archive" : "Restore"}
                  </button>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <SubjectDialog
        open={editor.open}
        classId={classId}
        subject={editor.open ? editor.subject : null}
        onClose={() => setEditor({ open: false })}
        onSaved={setNotice}
      />
    </section>
  );
}
