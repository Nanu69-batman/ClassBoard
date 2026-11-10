import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { Avatar } from "../components/Avatar";

/** `/app/account`: your name, how you sign in, and signing out. */
export function AccountPage() {
  const { user, profile, displayName, updateDisplayName, signOut } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.displayName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? "");
  }, [profile?.displayName]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Your name can't be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayName(trimmed);
      setNotice("Name updated. New assignments you post will use it.");
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsSaving(false);
    }
  }

  const provider = user?.app_metadata?.provider === "google" ? "Google" : "Email and password";

  return (
    <main className="content content--narrow">
      <div className="account-head">
        <Avatar name={displayName} />
        <div>
          <h1 className="greeting__title">{displayName}</h1>
          <p className="greeting__subtitle">{user?.email}</p>
        </div>
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="panel panel--plain">
        <h2 className="panel__title">Your name</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="account-name">
            Display name
          </label>
          <input
            id="account-name"
            className="input"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </button>
        </form>
        <p className="field__hint">This is what your classmates see in member lists and on work you post.</p>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="panel panel--plain">
        <h2 className="panel__title">Sign-in</h2>
        <dl className="detail-list">
          <div className="detail">
            <dt className="detail__label">Email</dt>
            <dd className="detail__value">{user?.email ?? "—"}</dd>
          </div>
          <div className="detail">
            <dt className="detail__label">Method</dt>
            <dd className="detail__value">{provider}</dd>
          </div>
        </dl>
        <button type="button" className="button button--ghost align-start" onClick={() => void signOut().then(() => navigate("/", { replace: true }))}>
          Log out
        </button>
      </section>
    </main>
  );
}
