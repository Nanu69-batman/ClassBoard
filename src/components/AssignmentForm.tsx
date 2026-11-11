import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { ACCEPTED_EXTENSIONS, validateAttachment } from "../data/attachments";
import { MAX_FILES, type StoredFile } from "../data/assignments";
import type { ManagedAssignment, Priority, SubjectInfo } from "../data/types";

import { CloseIcon, DocumentIcon, UploadIcon } from "./icons";
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
 * `createdBy`, `createdAt` or `contactEmail`, so editing cannot
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
 * So the date field can be swapped for a short standing note. The field's label
 * follows whichever input is showing — "Due date" or "Note" — so the label and
 * the control never disagree. Only one of the two is ever written: a document
 * with a date has `dueNote: null`, so a card never has to choose between them,
 * and no card can show a date and a note at once.
 *
 * ## Files
 *
 * Up to ten: PDF, PowerPoint, Word, Excel, text or images, 25 MB each. Picked
 * with the button or dropped onto it. The form only records which existing
 * files to keep and which new ones to add; the repository does the upload, so
 * a cancelled form never leaves a file behind.
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
  /** Files already on the assignment that stay. */
  keep: StoredFile[];
  /** Files picked in this form, uploaded on save. */
  add: File[];
};

const EMPTY_DRAFT: Draft = {
  subjectId: "",
  title: "",
  description: "",
  usesNote: false,
  dueDate: "",
  dueNote: DEFAULT_DUE_NOTE,
  priority: "none",
  keep: [],
  add: [],
};

/** The native `max` for a date input is fine, but cap the far future too. */
const MAX_DUE_DATE = "2100-12-31";

type AssignmentFormProps = {
  /** Null for a new assignment; the one being edited otherwise. */
  assignment: ManagedAssignment | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      keep: assignment.attachments.map(({ path, name }) => ({ path, name })),
      add: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);

  // If the form opened before subjects loaded, fill in the default subject once
  // they arrive. Never overrides a subject that is already chosen.
  const firstSubjectId = subjectOptions[0]?.value ?? "";
  useEffect(() => {
    if (assignment || !firstSubjectId) return;
    setDraft((current) => (current.subjectId ? current : { ...current, subjectId: firstSubjectId }));
  }, [assignment, firstSubjectId]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const [isDragging, setIsDragging] = useState(false);

  function addFiles(list: FileList | null) {
    const picked = [...(list ?? [])];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (picked.length === 0) return;

    const problems: string[] = [];
    const next = [...draft.add];
    for (const file of picked) {
      const problem = validateAttachment(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      // The same file picked twice is added once.
      const duplicate = next.some(
        (each) => each.name === file.name && each.size === file.size && each.lastModified === file.lastModified,
      );
      if (!duplicate) next.push(file);
    }

    const room = MAX_FILES - draft.keep.length;
    if (next.length > room) {
      problems.push(`An assignment can have up to ${MAX_FILES} files.`);
      next.length = Math.max(0, room);
    }

    setLocalError(problems.length > 0 ? problems.join(" ") : null);
    update("add", next);
  }

  const fileCount = draft.keep.length + draft.add.length;
  const existingUrls = new Map((assignment?.attachments ?? []).map((each) => [each.path, each.url]));

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
      keep: draft.keep,
      add: draft.add,
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
          {/*
            The label is whichever field is actually showing, so it always names
            the thing the CR is looking at. An earlier version labelled the row
            "Due" with a Date/Note switch beside it, which meant the label and
            the control disagreed — the row said one thing while the input
            underneath was another.

            The switch is now a single text button under the input, saying what it
            will do ("use a note instead"), rather than a two-state control
            restating the two options the label already switches between.
          */}
          <label className="field__label" htmlFor={draft.usesNote ? `${fieldId}-note` : `${fieldId}-due`}>
            {draft.usesNote ? "Note" : "Due date"}
            {draft.usesNote && <span className="field__optional">optional</span>}
          </label>

          {draft.usesNote ? (
            <>
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

          {/*
            Not a checkbox, and not a pressed-state toggle. A checkbox beside a
            date field reads as "also send a note", when the real relationship is
            that the note replaces the date. A button whose label names the change
            it will make — "use a note instead" / "use a due date instead" —
            cannot be misread that way, and needs no second control kept in step.
          */}
          <button
            type="button"
            className="link-button field__switch"
            onClick={() => update("usesNote", !draft.usesNote)}
          >
            {draft.usesNote ? "Use a due date instead" : "No due date? Use a note instead"}
          </button>
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

        <div className="field field--wide">
          <span className="field__label" id={`${fieldId}-files-label`}>
            Files <span className="field__optional">optional</span>
          </span>

          {fileCount > 0 && (
            <ul className="files" aria-labelledby={`${fieldId}-files-label`}>
              {draft.keep.map((file) => {
                const url = existingUrls.get(file.path);
                return (
                  <li key={file.path} className="files__item">
                    <span className="files__icon" aria-hidden="true">
                      <DocumentIcon size={16} />
                    </span>
                    {url ? (
                      <a className="files__name" href={url} target="_blank" rel="noreferrer">
                        {file.name}
                      </a>
                    ) : (
                      <span className="files__name">{file.name}</span>
                    )}
                    <button
                      type="button"
                      className="files__remove"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => update("keep", draft.keep.filter((each) => each.path !== file.path))}
                    >
                      <CloseIcon size={16} />
                    </button>
                  </li>
                );
              })}
              {draft.add.map((file, index) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="files__item">
                  <span className="files__icon files__icon--new" aria-hidden="true">
                    <DocumentIcon size={16} />
                  </span>
                  <span className="files__name">{file.name}</span>
                  <span className="files__size">{formatSize(file.size)}</span>
                  <button
                    type="button"
                    className="files__remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => update("add", draft.add.filter((_, at) => at !== index))}
                  >
                    <CloseIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fileCount < MAX_FILES && (
            <>
              {/* The real input stays focusable; the label is what's seen and clicked. */}
              <input
                ref={fileInputRef}
                id={`${fieldId}-file`}
                className="files__input"
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS}
                onChange={(event) => addFiles(event.target.files)}
              />
              <label
                htmlFor={`${fieldId}-file`}
                className={`files__drop${isDragging ? " files__drop--over" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                <span className="files__drop-icon" aria-hidden="true">
                  <UploadIcon size={20} />
                </span>
                <span className="files__drop-text">
                  <span>
                    <strong>{fileCount > 0 ? "Add more files" : "Choose files"}</strong> or drop them here
                  </span>
                  <span className="files__drop-hint">
                    PDF, PowerPoint, Word, Excel, text or images · 25 MB each · up to {MAX_FILES}
                  </span>
                </span>
              </label>
            </>
          )}
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

/** 1536 → "1.5 KB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
