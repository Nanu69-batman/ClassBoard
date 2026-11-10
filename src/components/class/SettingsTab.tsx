import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthProvider";
import { toFriendlyError } from "../../auth/errors";
import { deleteClass, inviteLink, regenerateInviteCode, removeMember, updateClass } from "../../data/classes";
import { canManage, type ClassInfo } from "../../data/types";

/**
 * Invite link for everyone; details for the owner; leave or delete at the bottom.
 */
export function SettingsTab({ info }: { info: ClassInfo }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = info.role === "owner";

  const [name, setName] = useState(info.name);
  const [description, setDescription] = useState(info.description);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = inviteLink(info.inviteCode);

  async function run(key: string, action: () => Promise<void>, success: string | null) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it yourself.");
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("The class needs a name.");
      return;
    }
    void run("save", () => updateClass(info.id, name, description), "Class details saved.");
  }

  return (
    <>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <section className="panel panel--plain">
        <h2 className="panel__title">Invite people</h2>
        <p className="section-lead">Anyone with this link can join as a member.</p>
        <div className="invite-box">
          <input className="input invite-box__link" value={link} readOnly onFocus={(event) => event.target.select()} aria-label="Invite link" />
          <button type="button" className="button button--primary" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="field__hint">
          Invite code: <strong className="invite-box__code">{info.inviteCode}</strong>
        </p>
        {canManage(info.role) && (
          <button
            type="button"
            className="link-button"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Make a new invite link? The current one will stop working.")) return;
              void run("code", async () => {
                await regenerateInviteCode(info.id);
              }, "New invite link created. The old one no longer works.");
            }}
          >
            Reset invite link
          </button>
        )}
      </section>

      {isOwner && (
        <section className="panel panel--plain">
          <h2 className="panel__title">Class details</h2>
          <form className="dialog__form" onSubmit={handleSave}>
            <div className="field">
              <label className="field__label" htmlFor="settings-name">
                Name
              </label>
              <input
                id="settings-name"
                className="input"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="settings-description">
                Description <span className="field__optional">optional</span>
              </label>
              <textarea
                id="settings-description"
                className="input textarea"
                rows={2}
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="form__actions">
              <button type="submit" className="button button--primary" disabled={busy !== null}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel panel--plain panel--danger">
        <h2 className="panel__title">{isOwner ? "Delete class" : "Leave class"}</h2>
        <p className="section-lead">
          {isOwner
            ? "Deletes the class with all its assignments, files and members. This can't be undone. To leave instead, make someone else the owner first."
            : "You'll stop seeing this class. You can rejoin with an invite link."}
        </p>
        <button
          type="button"
          className="button button--danger align-start"
          disabled={busy !== null}
          onClick={() => {
            if (isOwner) {
              const typed = window.prompt(`Type the class name to delete it:\n${info.name}`);
              if (typed?.trim() !== info.name.trim()) return;
              void run("delete", async () => {
                await deleteClass(info.id);
                navigate("/app", { replace: true });
              }, null);
            } else {
              if (!window.confirm(`Leave ${info.name}?`)) return;
              void run("leave", async () => {
                await removeMember(info.id, user?.id ?? "");
                navigate("/app", { replace: true });
              }, null);
            }
          }}
        >
          {isOwner ? "Delete this class" : "Leave this class"}
        </button>
      </section>
    </>
  );
}
