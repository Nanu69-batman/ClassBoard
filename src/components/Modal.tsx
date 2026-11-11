import { useEffect, useId, useRef, type ReactNode } from "react";

import { CloseIcon } from "./icons";

type Props = {
  open: boolean;
  /** Asked to close: the ✕, Escape, or a click on the backdrop. */
  onClose: () => void;
  title: string;
  /** A line under the title. */
  hint?: ReactNode;
  /** Roomier, for long forms. */
  wide?: boolean;
  /** While true, nothing closes it (a save is in flight). */
  busy?: boolean;
  children: ReactNode;
};

/**
 * A centred dialog over a dimmed page. A native <dialog>, so focus trapping,
 * Escape and the backdrop come from the browser. Its content is only mounted
 * while open, so every opening starts from fresh state.
 */
export function Modal({ open, onClose, title, hint, wide = false, busy = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start in the first text field rather than on the ✕.
      dialog
        .querySelector<HTMLElement>(".dialog__content input:not([type=file]), .dialog__content textarea")
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function requestClose() {
    if (!busy) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? " dialog--wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onMouseDown={(event) => {
        // A press on the backdrop lands on the <dialog> element itself. Mouse
        // down rather than click, so dragging out of a text field doesn't close it.
        if (event.target === ref.current) requestClose();
      }}
    >
      {open && (
        <div className="dialog__body">
          <button type="button" className="dialog__close" aria-label="Close" onClick={requestClose}>
            <CloseIcon />
          </button>
          <h2 className="dialog__title" id={titleId}>
            {title}
          </h2>
          {hint && <p className="dialog__hint">{hint}</p>}
          <div className="dialog__content">{children}</div>
        </div>
      )}
    </dialog>
  );
}
