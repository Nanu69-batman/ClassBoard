import { useEffect, useRef } from "react";

import type { Assignment } from "../../data/types";
import { CloseIcon } from "../icons";
import { Agenda } from "./Agenda";

type Props = {
  open: boolean;
  onClose: () => void;
  assignments: Assignment[];
  isCompleted: (id: string) => boolean;
};

/**
 * The calendar and upcoming list as a panel sliding in from the right, over a
 * translucent backdrop. Phone only; wider screens show the agenda in the page.
 *
 * A native modal <dialog>, so focus stays inside, Escape closes it and the page
 * behind can't be reached until it does.
 */
export function AgendaSheet({ open, onClose, assignments, isCompleted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label="Calendar"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="sheet__body">
        <button type="button" className="sheet__close" aria-label="Close calendar" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
        {/* Mounted only while open, so its headings aren't in the page twice. */}
        {open && (
          <Agenda className="agenda agenda--sheet" assignments={assignments} isCompleted={isCompleted} onPick={onClose} />
        )}
      </div>
    </dialog>
  );
}
