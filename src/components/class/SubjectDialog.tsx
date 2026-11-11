import { useEffect, useId, useState, type FormEvent } from "react";

import { toFriendlyError } from "../../auth/errors";
import { addSubject, updateSubject } from "../../data/assignments";
import type { SubjectInfo } from "../../data/types";
import { Modal } from "../Modal";

type Props = {
  open: boolean;
  classId: string;
  /** The one being edited, or null to add a new one. */
  subject: SubjectInfo | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Add a subject, or change its name or teacher. */
export function SubjectDialog({ open, classId, subject, onClose, onSaved }: Props) {
  const fieldId = useId();
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh fields each time it opens.
  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? "");
    setTeacher(subject?.teacher ?? "");
    setError(null);
  }, [open, subject]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const draft = { name: name.trim(), teacher: teacher.trim() };
    if (!draft.name) {
      setError("Give the subject a name.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (subject) {
        await updateSubject(subject.id, draft);
        onSaved(`"${draft.name}" updated.`);
      } else {
        await addSubject(classId, draft);
        onSaved(`Subject "${draft.name}" added.`);
      }
      onClose();
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={isSaving}
      title={subject ? "Edit subject" : "Add a subject"}
      hint={subject ? undefined : "Assignments are posted under a subject."}
    >
      <form className="dialog__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-name`}>
            Subject name
          </label>
          <input
            id={`${fieldId}-name`}
            className="input"
            placeholder="e.g. Operating Systems"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-teacher`}>
            Teacher's name <span className="field__optional">optional</span>
          </label>
          <input
            id={`${fieldId}-teacher`}
            className="input"
            placeholder="e.g. Dr. Meera Iyer"
            maxLength={120}
            value={teacher}
            onChange={(event) => setTeacher(event.target.value)}
          />
        </div>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <div className="form__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={isSaving || !name.trim()}>
            {isSaving ? "Saving…" : subject ? "Save changes" : "Add subject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
