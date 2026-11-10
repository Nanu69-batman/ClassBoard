import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { toFriendlyError } from "../auth/errors";
import { createClass, joinClass, parseInviteCode } from "../data/classes";
import { CloseIcon, LinkIcon, PlusIcon } from "./icons";

export type AddClassMode = "choose" | "create" | "join";

type Props = {
  /** Null keeps the dialog closed. */
  mode: AddClassMode | null;
  onModeChange: (mode: AddClassMode | null) => void;
};

/**
 * Create a class or join one with an invite code. A native <dialog>, so focus
 * trapping, Escape and the backdrop come from the browser.
 */
export function AddClassDialog({ mode, onModeChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isOpen = mode !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // Fresh fields every time it opens or switches screen.
  useEffect(() => {
    setError(null);
    if (mode === "choose" || mode === null) {
      setName("");
      setDescription("");
      setCode("");
    }
  }, [mode]);

  function close() {
    if (!isBusy) onModeChange(null);
  }

  async function submit(action: () => Promise<string>) {
    setIsBusy(true);
    setError(null);
    try {
      const classId = await action();
      onModeChange(null);
      navigate(`/app/${classId}`);
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsBusy(false);
    }
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give your class a name.");
      return;
    }
    void submit(() => createClass(name, description));
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const parsed = parseInviteCode(code);
    if (!parsed) {
      setError("Paste an invite link or code.");
      return;
    }
    void submit(() => joinClass(parsed));
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="add-class-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === ref.current) close();
      }}
    >
      <div className="dialog__body">
        <button type="button" className="dialog__close" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>

        {mode === "choose" && (
          <>
            <h2 className="dialog__title" id="add-class-title">
              Add a class
            </h2>
            <p className="dialog__hint">Start a new class, or join one you've been invited to.</p>
            <div className="choice-list">
              <button type="button" className="choice" onClick={() => onModeChange("create")}>
                <span className="choice__icon">
                  <PlusIcon size={20} />
                </span>
                <span>
                  <span className="choice__title">Create a class</span>
                  <span className="choice__text">You'll be the owner and can invite everyone.</span>
                </span>
              </button>
              <button type="button" className="choice" onClick={() => onModeChange("join")}>
                <span className="choice__icon">
                  <LinkIcon size={20} />
                </span>
                <span>
                  <span className="choice__title">Join a class</span>
                  <span className="choice__text">Use the invite link or code someone shared.</span>
                </span>
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="dialog__form">
            <h2 className="dialog__title" id="add-class-title">
              Create a class
            </h2>
            <p className="dialog__hint">You can change these later in the class settings.</p>
            <div className="field">
              <label className="field__label" htmlFor="class-name">
                Class name
              </label>
              <input
                id="class-name"
                className="input"
                placeholder="e.g. ECE 2026 · Section A"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="class-description">
                Description <span className="field__optional">optional</span>
              </label>
              <textarea
                id="class-description"
                className="input textarea"
                rows={2}
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            {error && (
              <p className="form__error" role="alert">
                {error}
              </p>
            )}
            <div className="form__actions">
              <button type="button" className="button button--ghost" onClick={() => onModeChange("choose")} disabled={isBusy}>
                Back
              </button>
              <button type="submit" className="button button--primary" disabled={isBusy}>
                {isBusy ? "Creating…" : "Create class"}
              </button>
            </div>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="dialog__form">
            <h2 className="dialog__title" id="add-class-title">
              Join a class
            </h2>
            <p className="dialog__hint">Paste the invite link or code your class rep shared.</p>
            <div className="field">
              <label className="field__label" htmlFor="invite-code">
                Invite link or code
              </label>
              <input
                id="invite-code"
                className="input"
                placeholder="https://…/join/k7d2mpq9xa or k7d2mpq9xa"
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <p className="form__error" role="alert">
                {error}
              </p>
            )}
            <div className="form__actions">
              <button type="button" className="button button--ghost" onClick={() => onModeChange("choose")} disabled={isBusy}>
                Back
              </button>
              <button type="submit" className="button button--primary" disabled={isBusy}>
                {isBusy ? "Joining…" : "Join class"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
