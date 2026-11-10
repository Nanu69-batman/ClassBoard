import { useState, type FormEvent } from "react";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { DocumentIcon } from "../components/icons";

type Role = "cr" | "superadmin";

const COPY: Record<Role, { title: string; hint: string }> = {
  cr: {
    title: "CR sign in",
    hint: "Use the account for your class. If you do not have one yet, ask your superadmin for an invite link.",
  },
  superadmin: {
    title: "Superadmin sign in",
    hint: "Restricted to ClassBoard administrators.",
  },
};

/**
 * Sign-in only. There is deliberately no "create account" option here — an
 * account is created by opening an invite link, which is the only path that can
 * grant a role. A student who types /cr gets this page and no way to register.
 */
export function LoginPage({ role }: { role: Role }) {
  const { status, profile, user, signInWithGoogle, signInWithEmail, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"google" | "email" | null>(null);

  async function run(action: () => Promise<void>, kind: "google" | "email") {
    setError(null);
    setPending(kind);
    try {
      await action();
    } catch (cause) {
      setError(toFriendlyError(cause));
      setPending(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void run(() => signInWithEmail(email, password), "email");
  }

  const copy = COPY[role];
  const isBusy = pending !== null;

  // Signed in, but not as this role. RedirectIfAlreadySignedIn handles the
  // matching case; without this branch the button would sit on "Signing in…"
  // forever with no explanation.
  if (status === "signed-in" && !(profile?.active && profile.role === role)) {
    const message = !profile
      ? "This account is not linked to a class. If you were expecting access, ask your superadmin for an invite link."
      : !profile.active
        ? "This account is no longer active. Ask your superadmin if you think that is wrong."
        : role === "cr"
          ? "This is a superadmin account, not a class representative account."
          : "This account does not have superadmin access.";

    return (
      <div className="auth-page">
        <div className="auth-card auth-card--notice">
          <h1 className="auth-card__title">No access here</h1>
          <p className="auth-card__hint">
            Signed in as <strong>{user?.email ?? "this account"}</strong>. {message}
          </p>
          <button
            type="button"
            className="button button--primary button--block"
            onClick={() => {
              setPending(null);
              void signOut();
            }}
          >
            Sign in with a different account
          </button>
          <a className="auth-card__back" href="/">
            Back to the dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <DocumentIcon size={22} />
          <span>classboard</span>
        </div>

        <h1 className="auth-card__title">{copy.title}</h1>
        <p className="auth-card__hint">{copy.hint}</p>

        <button
          type="button"
          className="button button--google"
          disabled={isBusy}
          onClick={() => void run(signInWithGoogle, "google")}
        >
          {pending === "google" ? "Opening Google…" : "Continue with Google"}
        </button>

        <div className="auth-card__divider">
          <span>or</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="button button--primary button--block" disabled={isBusy}>
            {pending === "email" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p className="auth-card__error" role="alert">
            {error}
          </p>
        )}

        <a className="auth-card__back" href="/">
          Back to the dashboard
        </a>
      </div>
    </div>
  );
}
