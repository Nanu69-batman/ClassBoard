import { useState, type FormEvent } from "react";

import { toFriendlyError } from "../../auth/errors";
import { addSubject, setSubjectActive } from "../../data/assignments";
import type { ClassData } from "../../data/classData";
import type { Loadable } from "../../data/types";
import { EmptyState } from "../EmptyState";

type Props = {
  classId: string;
  data: Loadable<ClassData>;
};

/** Owners and admins: add subjects, and archive the ones no longer taught. */
export function SubjectsTab({ classId, data }: Props) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const subjects = data.data?.subjects ?? [];
  const activeCount = subjects.filter((each) => each.active).length;

  async function runWrite(action: () => Promise<void>, success: string) {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsSaving(false);
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    void runWrite(async () => {
      await addSubject(classId, trimmed);
      setName("");
    }, `Subject "${trimmed}" added.`);
  }

  return (
    <section className="section">
      <div className="toolbar">
        <h2 className="toolbar__title">Subjects</h2>
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

      <form className="inline-form" onSubmit={handleAdd}>
        <label className="sr-only" htmlFor="new-subject">
          New subject name
        </label>
        <input
          id="new-subject"
          className="input"
          placeholder="Add a subject, e.g. Physics"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="button button--primary" disabled={isSaving || !name.trim()}>
          Add
        </button>
      </form>

      {data.status === "loading" && (
        <p className="section-lead" role="status">
          Loading…
        </p>
      )}

      {data.status === "ready" && subjects.length === 0 && (
        <EmptyState title="No subjects yet" message="Add one above, then pick it when you post an assignment." />
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
              </div>
              <p className="record__aside">
                <button
                  type="button"
                  className="link-button"
                  disabled={isSaving}
                  onClick={() =>
                    void runWrite(
                      () => setSubjectActive(subject.id, !subject.active),
                      subject.active ? `"${subject.name}" archived.` : `"${subject.name}" restored.`,
                    )
                  }
                >
                  {subject.active ? "Archive" : "Restore"}
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
