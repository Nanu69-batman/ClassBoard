import { useEffect, useRef, useState } from "react";

import { CalendarIcon, CheckIcon, PaperclipIcon } from "./icons";
import type { Assignment } from "../data/types";
import {
  formatDueDate,
  getAssignmentStatus,
  getDueLabel,
  STATUS_LABELS,
} from "../utils/assignmentStatus";

/** Descriptions longer than this get a show more / show less toggle. */
const LONG_DESCRIPTION_LENGTH = 150;

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
  const isLongDescription = assignment.description.length > LONG_DESCRIPTION_LENGTH;
  const isCollapsed = isLongDescription && !isExpanded;

  // A note-based assignment has no date, so there is no absolute date to print
  // underneath — the note is the whole of the due information.
  const hasDate = assignment.dueDate !== "";
  const dueLabel = isCompleted
    ? STATUS_LABELS.completed
    : getDueLabel(assignment);

  return (
    <article
      className={`row row--${status}`}
      // Drives the settle animation only, via a CSS attribute selector. Kept out
      // of the class string so a re-render cannot restart the transition.
      data-just-completed={justCompleted ? "true" : undefined}
    >
      {/*
        The check is a second element rather than a drawn tick inside the button,
        so the tick can have its own stroke animation without fighting the
        button's press feedback.
      */}
      <button
        ref={toggleRef}
        type="button"
        className="row__check"
        aria-pressed={isCompleted}
        aria-label={`${isCompleted ? "Mark as pending" : "Mark as done"}: ${assignment.title}, ${assignment.subject}`}
        onClick={(event) => onToggle(assignment.id, event.detail === 0)}
      >
        <span className="row__check-mark" aria-hidden="true">
          <CheckIcon size={13} />
        </span>
      </button>

      <div className="row__body">
        <h3 className="row__title">{assignment.title}</h3>

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

        <p
          className={`row__description${isCollapsed ? " row__description--clamped" : ""}`}
        >
          {assignment.description}
        </p>

        {isLongDescription && (
          <button
            type="button"
            className="link-button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}

        {assignment.attachment && (
          <a
            className="row__attachment"
            href={assignment.attachment}
            target="_blank"
            rel="noreferrer"
          >
            <PaperclipIcon size={13} />
            {assignment.attachment.startsWith("http") ? "Open link" : "Attachment"}
          </a>
        )}

        {/* Who set the work. Denormalised onto the document by the CR on purpose,
            so a student can see it without any account or extra read. */}
        {assignment.postedBy && (
          <p className="row__posted-by">Posted by {assignment.postedBy}</p>
        )}
      </div>

      <p className="row__due">
        <span className="row__due-relative">
          {hasDate ? <CalendarIcon size={17} /> : null}
          {dueLabel}
        </span>
        {hasDate && <span className="row__due-date">{formatDueDate(assignment.dueDate)}</span>}
      </p>
    </article>
  );
}
