import { useEffect, useRef, useState } from "react";

import type { Assignment } from "../../data/types";
import { CloseIcon } from "../icons";
import { Agenda } from "./Agenda";

type Props = {
  open: boolean;
  onClose: () => void;
  assignments: Assignment[];
  isCompleted: (id: string) => boolean;
};

/** Must outlast the `sheet-out` animation; also the fallback when animations are off. */
const CLOSE_MS = 260;

/**
 * The calendar and upcoming list as a panel sliding in from the right, over a
 * translucent backdrop. Phone only; wider screens show the agenda in the page.
 *
 * A native modal <dialog>, so focus stays inside, Escape closes it and the page
 * behind can't be reached until it does.
 *
 * Closing is two steps. `dialog.close()` removes it from the screen at once, so
 * the sheet first plays its slide-out (marked by `data-closing`) and only then
 * closes for real. The contents stay mounted until then, so it doesn't slide
 * out empty.
 */
export function AgendaSheet({ open, onClose, assignments, isCompleted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      setClosing(false);
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (!dialog.open) return;
    setClosing(true);
    dialog.setAttribute("data-closing", "");

    const finish = () => {
      dialog.removeAttribute("data-closing");
      dialog.close();
      setClosing(false);
    };
    // animationend can be lost (reduced motion, a hidden tab), so a timer backs it up.
    const timer = window.setTimeout(finish, CLOSE_MS);
    const onEnd = (event: AnimationEvent) => {
      if (event.target !== dialog) return;
      window.clearTimeout(timer);
      finish();
    };
    dialog.addEventListener("animationend", onEnd);
    return () => {
      window.clearTimeout(timer);
      dialog.removeEventListener("animationend", onEnd);
    };
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
        {/* Mounted only while showing, so its headings aren't in the page twice. */}
        {(open || closing) && (
          <Agenda className="agenda agenda--sheet" assignments={assignments} isCompleted={isCompleted} onPick={onClose} />
        )}
      </div>
    </dialog>
  );
}
