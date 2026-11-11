import { useEffect, useId, useRef, useState, type MouseEvent } from "react";

import { CheckCircleIcon, CheckIcon, ClockIcon, DocumentIcon, PaperclipIcon } from "./icons";
import type { Assignment } from "../data/types";
import {
  formatDueDate,
  getAssignmentStatus,
  getDueDateParts,
  getDueLabel,
  getRelativeDueText,
  getShortDueText,
} from "../utils/assignmentStatus";

const PRIORITY_LABELS: Record<Assignment["priority"], string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
  none: "No priority",
};

type AssignmentCardProps = {
  assignment: Assignment;
  isCompleted: boolean;
  onToggle: (id: string, viaKeyboard: boolean) => void;
  /** Set right after a keyboard toggle so focus lands on the card's new control. */
  restoreFocus: boolean;
  /**
   * Marks the card that was just ticked, so it can animate settling into place.
   *
   * Separate from `isCompleted` on purpose: that flag stays true for as long as
   * the work is done, and a transition that fires on every render of a completed
   * card is a flicker, not an acknowledgement. This is true for one beat after the
   * click and then clears.
   */
  justCompleted?: boolean;
};

/** The DOM id of a card, so other parts of the page can link to it. */
export function assignmentAnchor(id: string): string {
  return `assignment-${id}`;
}

export function AssignmentCard({
  assignment,
  isCompleted,
  onToggle,
  restoreFocus,
  justCompleted = false,
}: AssignmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Toggling moves the card to another group, so the focused control is removed
  // from the DOM. Put focus back on it to keep keyboard use unbroken.
  useEffect(() => {
    if (restoreFocus) toggleRef.current?.focus();
  }, [restoreFocus]);

  const status = getAssignmentStatus(assignment, isCompleted);
  const detailsId = useId();

  /**
   * A click anywhere on the card opens or closes it, except on the things in it
   * that do their own job (the tick, the attachment link) or when the click
   * was the end of selecting text.
   */
  function handleCardClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as Element;
    if (target.closest("button, a")) return;
    if (window.getSelection()?.toString()) return;
    setIsExpanded((value) => !value);
  }

  // A note-based assignment has no date, so the date block has nothing to show
  // and the note goes in the body instead.
  const dateParts = getDueDateParts(assignment.dueDate);

  return (
    <article
      id={assignmentAnchor(assignment.id)}
      className={`row row--${status}${isExpanded ? " row--expanded" : ""}`}
      onClick={handleCardClick}
      // Drives the settle animation only, via a CSS attribute selector. Kept out
      // of the class string so a re-render cannot restart the transition.
      data-just-completed={justCompleted ? "true" : undefined}
    >
      {/*
        The date block. Visual shorthand only: the full wording ("Due tomorrow,
        28 Sep 2026") is given to screen readers in one piece instead.
      */}
      <div className="row__date">
        {isCompleted ? (
          <CheckCircleIcon size={28} className="row__date-done" />
        ) : dateParts ? (
          <span aria-hidden="true" className="row__date-parts">
            <span className="row__date-month">{dateParts.month}</span>
            <span className="row__date-day">{dateParts.day}</span>
            <span className="row__date-relative">{getShortDueText(assignment.dueDate)}</span>
          </span>
        ) : (
          <span aria-hidden="true" className="row__date-parts">
            <ClockIcon size={22} className="row__date-undated" />
            <span className="row__date-relative">No date</span>
          </span>
        )}
        <span className="sr-only">
          {isCompleted
            ? "Completed."
            : dateParts
              ? `${getRelativeDueText(assignment.dueDate)}, ${formatDueDate(assignment.dueDate)}.`
              : `${getDueLabel(assignment)}.`}
        </span>
      </div>

      <span className="row__icon" aria-hidden="true">
        <DocumentIcon size={20} />
      </span>

      <div className="row__body">
        <p className="row__meta">
          <span className="row__subject">{assignment.subject}</span>
          {/*
            "No priority" is not printed. A priority nobody set is not
            information, and labelling the absence would put noise on most rows.
            It stays in the data for sorting, which is where it is useful.
          */}
          {assignment.priority !== "none" && (
            <span className={`row__priority row__priority--${assignment.priority}`}>
              {PRIORITY_LABELS[assignment.priority]}
            </span>
          )}
        </p>

        {/*
          The title is the keyboard way in: a button that opens the card. A
          pointer can click anywhere on the card instead.
        */}
        <h3 className="row__title">
          <button
            type="button"
            className="row__toggle"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            onClick={() => setIsExpanded((value) => !value)}
          >
            {assignment.title}
          </button>
        </h3>

        {/* Compact: one line of the description. Open: all of it, and the rest below. */}
        {assignment.description && (
          <p className={`row__description${isExpanded ? "" : " row__description--clamped"}`}>
            {assignment.description}
          </p>
        )}

        {!dateParts && !isCompleted && (
          <p className="row__note" aria-hidden="true">
            <ClockIcon size={14} />
            {getDueLabel(assignment)}
          </p>
        )}

        <div id={detailsId} hidden={!isExpanded}>
          {(assignment.attachment || assignment.postedBy) && (
            <p className="row__footer">
              {assignment.attachment && (
                <a className="row__attachment" href={assignment.attachment} target="_blank" rel="noreferrer">
                  <PaperclipIcon size={13} />
                  {assignment.attachmentName || "Attachment"}
                </a>
              )}
              {/* Who set the work, stamped by the database from their profile. */}
              {assignment.postedBy && <span className="row__posted-by">Posted by {assignment.postedBy}</span>}
            </p>
          )}
          {dateParts && (
            <p className="row__posted-by">Due {formatDueDate(assignment.dueDate)}</p>
          )}
        </div>
      </div>

      <button
        ref={toggleRef}
        type="button"
        className="row__check"
        aria-pressed={isCompleted}
        aria-label={`${isCompleted ? "Mark as pending" : "Mark as done"}: ${assignment.title}, ${assignment.subject}`}
        onClick={(event) => onToggle(assignment.id, event.detail === 0)}
      >
        <span className="row__check-mark" aria-hidden="true">
          <CheckIcon size={18} />
        </span>
        {isCompleted && (
          <span className="row__check-text" aria-hidden="true">
            Completed
          </span>
        )}
      </button>
    </article>
  );
}
