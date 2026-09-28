import { useEffect, useId, useState, type FormEvent } from "react";

import type { CrAssignment, Priority, SubjectInfo } from "../data/types";

import { Listbox, type ListboxOption } from "./Listbox";

/**
 * Add / edit an assignment (§16, §17).
 *
 * One form for both, so the two can never drift apart in what they validate or
 * what fields they own. `assignment` present means edit; absent means create.
 *
 * ## What the form owns, and only that
 *
 * Subject, title, description, the due date *or* the note, priority.
 * `updateAssignment` writes exactly these and `updatedAt`. It never sends
 * `createdBy`, `createdAt`, `contactEmail` or an attachment, so editing cannot
 * quietly drop them (§17: "do not silently overwrite unrelated fields").
 *
 * ## A due date, or a note instead of one
 *
 * §16 makes the due date required, and that is the right default — most work
 * genuinely is due on a day. But a CR sometimes posts something that is not due
 * on any particular date: reading for next week, a lab slot still being arranged.
 * Forcing a date onto that would make the student dashboard confidently claim the
 * work is overdue, which is worse than saying nothing.
 *
 * So the date field can be swapped for a short standing note. Only one is ever
 * written: a document with a date has `dueNote: null`, so a card never has to
 * choose between them, and no card can show a date and a note at once.
 *
 * Attachment is absent on purpose. M7 adds the upload; until then the field is
 * not rendered at all rather than rendered disabled, because a control that cannot
 * be used should not look like one that can.
 */

/** The note written when a CR chooses "no deadline" and types nothing. */
const DEFAULT_DUE_NOTE = "No deadline for now";

const PRIORITY_OPTIONS: ListboxOption[] = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

type Draft = {
  subjectId: string;
  title: string;
  description: string;
  /** True when the CR is using a standing note instead of a date. */
  usesNote: boolean;
  dueDate: string;
  dueNote: string;
  priority: Priority;
};

const EMPTY_DRAFT: Draft = {
  subjectId: "",
  title: "",
  description: "",
  usesNote: false,
  dueDate: "",
  dueNote: DEFAULT_DUE_NOTE,
  priority: "none",
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
  onSubmit: (draft: Submission) => void;
  onCancel: () => void;
};

/** What the form hands back: the two due fields already resolved to one. */
export type Submission = Omit<Draft, "usesNote">;

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
  // since been deactivated is still listed, so editing an old assignment does not
  // silently move it — the selected value simply keeps resolving.
  const subjectOptions: ListboxOption[] = subjects
    .filter((each) => each.active || each.id === draft.subjectId)
    .map((each) => ({
      value: each.id,
      label: each.name,
      hint: each.active ? undefined : "archived",
    }));

  // Prefill once per assignment. Keyed on the id, so opening the form for a
  // different assignment resets it rather than leaking the previous values.
  useEffect(() => {
    setLocalError(null);

    if (!assignment) {
      // Default the subject to the first active one: with several subjects that
      // is one less required field to think about, and it is always valid.
      setDraft({ ...EMPTY_DRAFT, subjectId: subjectOptions[0]?.value ?? "" });
      return;
    }

    // An existing document decides the mode: no date means the CR chose a note,
    // so the form opens showing the note rather than an empty date field.
    const usesNote = !assignment.dueDate;

    setDraft({
      subjectId: assignment.subjectId,
      title: assignment.title,
      description: assignment.description,
      usesNote,
      dueDate: assignment.dueDate,
      dueNote: assignment.dueNote ?? DEFAULT_DUE_NOTE,
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
    if (!draft.usesNote && !draft.dueDate) {
      setLocalError("Pick a due date, or switch to a note instead.");
      return;
    }

    onSubmit({
      subjectId: draft.subjectId,
      title: draft.title.trim(),
      // An empty description is stored as an empty string, not null, so the
      // document shape never varies with which fields the CR filled in.
      description: draft.description.trim(),
      // Exactly one of the two is ever sent, which is what keeps a card from
      // having to decide what to show.
      dueDate: draft.usesNote ? "" : draft.dueDate,
      dueNote: draft.usesNote ? draft.dueNote.trim() || DEFAULT_DUE_NOTE : "",
      priority: draft.priority,
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
          <Listbox
            id={`${fieldId}-subject`}
            options={subjectOptions}
            value={draft.subjectId}
            onChange={(value) => update("subjectId", value)}
            placeholder="Choose a subject"
            ariaLabel="Subject"
          />
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

        <div className="field field--wide">
          <div className="field__label field__label--row">
            <span>Due</span>

            {/*
              The mode switch. A radio group rather than a checkbox, because the
              two options are mutually exclusive and a checkbox would read as
              "also show a note" instead of "instead of a date".
            */}
            <span className="segmented segmented--sm" role="radiogroup" aria-label="Due as">
              <button
                type="button"
                className="segmented__button"
                role="radio"
                aria-checked={!draft.usesNote}
                onClick={() => update("usesNote", false)}
              >
                Date
              </button>
              <button
                type="button"
                className="segmented__button"
                role="radio"
                aria-checked={draft.usesNote}
                onClick={() => update("usesNote", true)}
              >
                Note
              </button>
            </span>
          </div>

          {draft.usesNote ? (
            <>
              <label className="sr-only" htmlFor={`${fieldId}-note`}>
                Note instead of a due date
              </label>
              <input
                id={`${fieldId}-note`}
                className="input"
                type="text"
                value={draft.dueNote}
                maxLength={120}
                placeholder={DEFAULT_DUE_NOTE}
                onChange={(event) => update("dueNote", event.target.value)}
              />
              <p className="field__hint">
                Shown to your class in place of a date. Use it for work that is not
                due on a particular day.
              </p>
            </>
          ) : (
            <>
              <label className="sr-only" htmlFor={`${fieldId}-due`}>
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
            </>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-priority`}>
            Priority
          </label>
          <Listbox
            id={`${fieldId}-priority`}
            options={PRIORITY_OPTIONS}
            value={draft.priority}
            onChange={(value) => update("priority", value as Priority)}
            ariaLabel="Priority"
          />
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
        <button
          type="button"
          className="button button--ghost"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? "Saving…" : isEditing ? "Save changes" : "Post assignment"}
        </button>
      </div>
    </form>
  );
}
