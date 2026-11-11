import { useEffect, useId, useState, type FormEvent } from "react";

import { toFriendlyError } from "../../auth/errors";
import { addSubject, updateSubject } from "../../data/assignments";
import type { SubjectInfo } from "../../data/types";
import { cssVar, nextFreeColor, SUBJECT_PALETTE, subjectColor } from "../../utils/subjectColor";
import { CheckIcon } from "../icons";
import { Modal } from "../Modal";

type Props = {
  open: boolean;
  classId: string;
  /** The one being edited, or null to add a new one. */
  subject: SubjectInfo | null;
  /** The class's subjects, so a new one starts on a colour nobody has. */
  subjects: SubjectInfo[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Add a subject, or change its name, teacher or colour. */
export function SubjectDialog({ open, classId, subject, subjects, onClose, onSaved }: Props) {
  const fieldId = useId();
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [color, setColor] = useState<string>(SUBJECT_PALETTE[0].value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh fields each time it opens.
  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? "");
    setTeacher(subject?.teacher ?? "");
    setColor(subject ? subjectColor(subject) : nextFreeColor(subjects.map(subjectColor)));
    setError(null);
    // Only on opening: a live update to the list shouldn't reset a pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject]);

  const isCustom = !SUBJECT_PALETTE.some((each) => each.value === color);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const draft = { name: name.trim(), teacher: teacher.trim(), color };
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

        <fieldset className="field swatches-field">
          <legend className="field__label">Colour</legend>
          <div className="swatches">
            {SUBJECT_PALETTE.map((each) => (
              <label key={each.value} className="swatch" style={cssVar("--swatch", each.value)}>
                <input
                  type="radio"
                  name={`${fieldId}-color`}
                  className="swatch__input"
                  value={each.value}
                  checked={color === each.value}
                  onChange={() => setColor(each.value)}
                />
                <span className="swatch__dot" aria-hidden="true">
                  <CheckIcon size={14} />
                </span>
                <span className="sr-only">{each.name}</span>
              </label>
            ))}

            {/* Any other colour, from the browser's own picker. */}
            <label
              className={`swatch swatch--custom${isCustom ? " swatch--picked" : ""}`}
              style={cssVar("--swatch", color)}
              title="Pick any colour"
            >
              <input
                type="color"
                className="swatch__picker"
                value={color}
                onChange={(event) => setColor(event.target.value.toLowerCase())}
                aria-label="Custom colour"
              />
              <span className="swatch__dot" aria-hidden="true">
                {isCustom ? <CheckIcon size={14} /> : "+"}
              </span>
            </label>
          </div>
          <p className="swatches__preview">
            <span className="subject-chip" style={cssVar("--subject", color)}>
              {name.trim() || "Subject"}
            </span>
            <span className="field__hint">How it looks on assignments</span>
          </p>
        </fieldset>

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
