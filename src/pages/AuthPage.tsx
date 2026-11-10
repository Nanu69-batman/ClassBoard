import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { safeNext } from "../auth/RequireAuth";
import { FullPageStatus } from "../components/FullPageStatus";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; hint: string; submit: string; busy: string }> = {
  login: {
    title: "Welcome back",
    hint: "Log in to see your classes.",
    submit: "Log in",
    busy: "Logging in…",
  },
  signup: {
    title: "Create your account",
    hint: "One account for every class you're in.",
    submit: "Sign up",
    busy: "Creating account…",
  },
};

/** Log in and sign up share one page; the mode only changes the form. */
export function AuthPage({ mode }: { mode: Mode }) {
  const { status, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const nextQuery = params.get("next") ? `?next=${encodeURIComponent(next)}` : "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  if (status === "loading") return <FullPageStatus title="Loading…" />;
  if (status === "signed-in") return <Navigate to={next} replace />;

  const copy = COPY[mode];
  const isBusy = pending !== null;

  async function run(kind: "google" | "email", action: () => Promise<void>) {
    setError(null);
    setPending(kind);
    try {
      await action();
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      // Google navigates away on success; email sign-in flips `status` above.
      setPending(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (mode === "signup") {
      if (!name.trim()) {
        setError("Enter the name your classmates will see.");
        return;
      }
      if (password.length < 8) {
        setError("Use a password of at least 8 characters.");
        return;
      }
      void run("email", async () => {
        const result = await signUpWithEmail(name, email, password, next);
        if (result.needsConfirmation) setConfirmationSentTo(email);
      });
      return;
    }

    void run("email", () => signInWithEmail(email, password));
  }

  if (confirmationSentTo) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--notice">
          <h1 className="auth-card__title">Check your email</h1>
          <p className="auth-card__hint">
            We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Open it to finish
            creating your account.
          </p>
          <Link className="auth-card__back" to={`/login${nextQuery}`}>
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="auth-card__brand" to="/">
          classboard
        </Link>

        <h1 className="auth-card__title">{copy.title}</h1>
        <p className="auth-card__hint">{copy.hint}</p>

        <button
          type="button"
          className="button button--google"
          disabled={isBusy}
          onClick={() => void run("google", () => signInWithGoogle(next))}
        >
          {pending === "google" ? "Opening Google…" : "Continue with Google"}
        </button>

        <div className="auth-card__divider">
          <span>or</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label className="field__label" htmlFor="auth-name">
                Your name
              </label>
              <input
                id="auth-name"
                className="input"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          )}

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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="button button--primary button--block" disabled={isBusy}>
            {pending === "email" ? copy.busy : copy.submit}
          </button>
        </form>

        {error && (
          <p className="auth-card__error" role="alert">
            {error}
          </p>
        )}

        <p className="auth-card__switch">
          {mode === "login" ? (
            <>
              New here? <Link to={`/signup${nextQuery}`}>Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to={`/login${nextQuery}`}>Log in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
