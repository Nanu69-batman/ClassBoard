import { useEffect, useId, useMemo, useState, type FormEvent } from "react";

import type { CrAssignment, Priority, SubjectInfo } from "../data/types";

import { ChevronIcon } from "./icons";

/**
 * Add / edit an assignment (§16, §17).
 *
 * One form for both, so the two can never drift apart in what they validate or
 * what fields they own. `assignment` present means edit; absent means create.
 *
 * ## What the form owns, and only that
 *
 * Subject, title, description, due date, priority. `updateAssignment` writes
 * exactly these and `updatedAt`. It never sends `createdBy`, `createdAt`,
 * `contactEmail` or an attachment, so editing cannot quietly drop them (§17:
 * "do not silently overwrite unrelated fields").
 *
 * Attachment is absent on purpose. M7 adds the upload; until then the field is
 * not rendered at all rather than rendered disabled, because a control that
 * cannot be used should not look like one that can.
 */

/** §16: subject, title and due date are required. The rest are optional. */
type Draft = {
  subjectId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
};

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const EMPTY_DRAFT: Draft = {
  subjectId: "",
  title: "",
  description: "",
  dueDate: "",
  priority: "normal",
};

/** The native `max` for a date input is fine, but cap the far future too. */
const MAX_DUE_DATE = "2100-12-31";

type AssignmentFormProps = {
  /** Null for a new assignment; the one being edited otherwise. */
  assignment: CrAssignment | null;
  subjects: SubjectInfo[];
  /** Set while a write is in flight, to disable the submit button (§28). */
  isSaving: boolean;
  error: string | null;
  onSubmit: (draft: Draft) => void;
  onCancel: () => void;
};

export type { Draft as AssignmentDraftValues };

export function AssignmentForm({
  assignment,
  subjects,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: AssignmentFormProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [localError, setLocalError] = useState<string | null>(null);

  const isEditing = assignment !== null;

  // Only active subjects are offered. An archived subject stays in the document
  // history but is not a sensible place to post new work. A subject that has
  // since been deactivated is still shown, so editing an old assignment does not
  // silently move it — the select's value simply keeps resolving.
  const options = useMemo(
    () => subjects.filter((each) => each.active || each.id === draft.subjectId),
    [subjects, draft.subjectId],
  );

  // Prefill once per assignment. Keyed on the id so opening the form for a
  // different assignment resets it, rather than leaking the previous values.
  useEffect(() => {
    setLocalError(null);

    if (!assignment) {
      // Default the subject to the first active one: with several subjects that
      // is one less required field to think about, and it is always a valid value.
      setDraft({ ...EMPTY_DRAFT, subjectId: options[0]?.id ?? "" });
      return;
    }

    setDraft({
      subjectId: assignment.subjectId,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      priority: assignment.priority,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (!draft.subjectId) {
      setLocalError("Choose a subject.");
      return;
    }
    if (!draft.title.trim()) {
      setLocalError("Give the assignment a title.");
      return;
    }
    if (!draft.dueDate) {
      setLocalError("Pick a due date.");
      return;
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      // An empty description is stored as an empty string, not null, so the
      // document shape never varies with which fields the CR filled in.
      description: draft.description.trim(),
    });
  }

  const shownError = localError ?? error;

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form__grid">
        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-subject`}>
            Subject
          </label>
          <div className="select-wrap">
            <select
              id={`${fieldId}-subject`}
              className="select"
              value={draft.subjectId}
              required
              onChange={(event) => update("subjectId", event.target.value)}
            >
              <option value="" disabled>
                Choose a subject
              </option>
              {options.map((each) => (
                <option key={each.id} value={each.id}>
                  {each.name}
                  {each.active ? "" : " (archived)"}
                </option>
              ))}
            </select>
            <ChevronIcon size={15} className="select-wrap__chevron" aria-hidden="true" />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-title`}>
            Title
          </label>
          <input
            id={`${fieldId}-title`}
            className="input"
            type="text"
            value={draft.title}
            maxLength={200}
            required
            onChange={(event) => update("title", event.target.value)}
          />
        </div>

        <div className="field field--wide">
          <label className="field__label" htmlFor={`${fieldId}-description`}>
            Description <span className="field__optional">optional</span>
          </label>
          <textarea
            id={`${fieldId}-description`}
            className="input textarea"
            rows={4}
            value={draft.description}
            maxLength={4000}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-due`}>
            Due date
          </label>
          <input
            id={`${fieldId}-due`}
            className="input"
            type="date"
            value={draft.dueDate}
            max={MAX_DUE_DATE}
            required
            onChange={(event) => update("dueDate", event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-priority`}>
            Priority <span className="field__optional">optional</span>
          </label>
          <div className="select-wrap">
            <select
              id={`${fieldId}-priority`}
              className="select"
              value={draft.priority}
              onChange={(event) => update("priority", event.target.value as Priority)}
            >
              {PRIORITY_OPTIONS.map((each) => (
                <option key={each.value} value={each.value}>
                  {each.label}
                </option>
              ))}
            </select>
            <ChevronIcon size={15} className="select-wrap__chevron" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/*
        role="alert" so the message is announced the moment it appears. Without a
        save in flight, it is about something the CR just did, not a background
        state change.
      */}
      {shownError && (
        <p className="form__error" role="alert">
          {shownError}
        </p>
      )}

      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? "Saving…" : isEditing ? "Save changes" : "Post assignment"}
        </button>
      </div>
    </form>
  );
}
