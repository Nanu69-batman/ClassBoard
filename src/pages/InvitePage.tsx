import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { DocumentIcon } from "../components/icons";
import { claimInvite, peekInvite, readInviteToken, type InviteFailure } from "../data/invites";

/**
 * Where an invite link lands, and the only place an account can be created.
 *
 * ## The order of the screens
 *
 *  1. No token            → nothing to do. Say so and stop.
 *  2. Token, signed out   → sign in or create an account.
 *  3. Token, signed in,
 *     no profile          → accept the invite.
 *  4. Token, signed in,
 *     already a role      → nothing to claim; send them to their dashboard.
 *
 * Step 2 offers registration, and only here. `/cr/login` is sign-in only by
 * construction, so the ability to create an account is itself gated behind a
 * valid token.
 *
 * ## Nothing here is trusted
 *
 * The token is read from the URL and checked server-side. The class name shown
 * here comes from `peek_invite` and is display only — `claim_invite` takes the
 * class from the invite row itself, so a tampered link cannot grant a different
 * class. The claim is one transaction: if it fails, the token is not spent and
 * the person can simply try again.
 */

type Phase = "checking" | "no-token" | "ready" | "claiming";

export function InvitePage() {
  const {
    status,
    user,
    profile,
    signInWithGoogle,
    signInWithEmail,
    createAccountWithEmail,
    signOut,
    refreshProfile,
  } = useAuth();

  const [token] = useState(readInviteToken);

  const [className, setClassName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(token ? "checking" : "no-token");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  /** Set after an email sign-up that still needs its confirmation link clicked. */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  // Email sign-in or sign-up. Mode is explicit rather than inferred, so a typo
  // does not silently create a second account for someone who meant to sign in.
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Who this CR is. Their own words, not whatever Google asserted about them.
  const [displayName, setDisplayName] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("no-token");
      return;
    }

    let cancelled = false;

    // Resolve the class name before anything is offered, so the person can see
    // which class they are being made a CR of *before* they create an account.
    // Also catches a used, expired or dead-class invite up front.
    void peekInvite(token).then((name) => {
      if (cancelled) return;

      if (!name) {
        setError("This invite has already been used, or it has expired. Ask your superadmin for a new link.");
        setPhase("no-token");
        return;
      }

      setClassName(name);
      setPhase("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleGoogle() {
    setIsBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);

    try {
      if (mode === "signup") {
        const result = await createAccountWithEmail(email, password);
        if (result.needsConfirmation) setAwaitingConfirmation(email);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClaim() {
    if (!user || !token) return;

    setIdentityError(null);

    if (!displayName.trim()) {
      setIdentityError("Enter the name your class will see.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setPhase("claiming");

    const result = await claimInvite(token, displayName);

    if (result.ok) {
      // Loading the new profile flips this page into the redirect to /cr below.
      await refreshProfile();
      return;
    }

    setIsBusy(false);
    setError(OUTCOME_MESSAGES[result.reason]);
    setPhase("ready");
  }

  if (phase === "no-token") {
    return (
      <InviteShell title="This link is not usable">
        <p className="auth-card__hint">
          {error ?? "Ask your superadmin to send you an invite link."}
        </p>
        <a className="button button--primary" href="/">
          Go to the homepage
        </a>
      </InviteShell>
    );
  }

  if (phase === "checking" || status === "loading") {
    return (
      <InviteShell title="Checking your invite…">
        <p className="auth-card__hint" role="status">
          One moment.
        </p>
      </InviteShell>
    );
  }

  // Signed in and already holding a role. Sending them onward is more useful than
  // telling them they cannot accept an invite they do not need.
  if (profile) {
    return <Navigate to={profile.role === "superadmin" ? "/admin" : "/cr"} replace />;
  }

  return (
    <InviteShell title="You have been invited">
      <p className="auth-card__hint">
        Accepting makes you the class representative for{" "}
        <strong>{className ?? "this class"}</strong>. You will be able to post assignments for
        them.
      </p>

      {awaitingConfirmation && status === "signed-out" ? (
        <p className="notice" role="status">
          We sent a confirmation link to <strong>{awaitingConfirmation}</strong>. Open it on this
          device — it brings you back here to finish accepting.
        </p>
      ) : status === "signed-out" ? (
        <>
          <button
            type="button"
            className="button button--google"
            disabled={isBusy}
            onClick={() => void handleGoogle()}
          >
            Continue with Google
          </button>

          <div className="auth-card__divider">
            <span>or</span>
          </div>

          {/*
            The one place in the app with a "create account" option. It is
            reachable only by holding a valid invite token.
          */}
          <form className="auth-form" onSubmit={handleEmailSubmit}>
            <div className="auth-form__mode" role="group" aria-label="Email sign in or sign up">
              <button
                type="button"
                className="segmented__button"
                aria-pressed={mode === "signin"}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                className="segmented__button"
                aria-pressed={mode === "signup"}
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="invite-email">
                Email
              </label>
              <input
                id="invite-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="invite-password">
                Password
              </label>
              <input
                id="invite-password"
                className="input"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
              {mode === "signup" && (
                <p className="field__hint">At least 8 characters.</p>
              )}
            </div>

            <button
              type="submit"
              className="button button--primary button--block"
              disabled={isBusy}
            >
              {isBusy
                ? "Working…"
                : mode === "signup"
                  ? "Create account and accept"
                  : "Sign in and accept"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="invite-identity">
            Signed in as <strong>{user?.email ?? "your account"}</strong>.{" "}
            <button type="button" className="link-button" onClick={() => void signOut()}>
              Use a different account
            </button>
          </p>

          {/*
            The identity form. The name written here is what appears
            against every assignment this CR posts, and they are the CR's own
            choice — a Google account's display name is whatever was on the Google
            profile, which for a student account is often a nickname or an old
            name, and that is not what a class should see as the person setting
            their deadlines.
          */}
          <div className="invite-form">
            <div className="field">
              <label className="field__label" htmlFor="invite-display-name">
                Name your class will see
              </label>
              <input
                id="invite-display-name"
                className="input"
                type="text"
                value={displayName}
                maxLength={80}
                autoComplete="name"
                placeholder="Asha Rao"
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <p className="field__hint">
                This is the name shown against every assignment you post.
              </p>
            </div>

            {identityError && (
              <p className="form__error" role="alert">
                {identityError}
              </p>
            )}
          </div>

          <button
            type="button"
            className="button button--primary button--block"
            disabled={isBusy}
            onClick={() => void handleClaim()}
          >
            {phase === "claiming" ? "Accepting…" : "Accept invite"}
          </button>

          <p className="field__hint">
            You are becoming the class representative for {className}.
          </p>
        </>
      )}

      {error && (
        <p className="auth-card__error" role="alert">
          {error}
        </p>
      )}
    </InviteShell>
  );
}

/** The invite page's own frame, so it does not depend on the app shell. */
function InviteShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <DocumentIcon size={22} />
          <span>classboard</span>
        </div>

        <h1 className="auth-card__title">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/**
 * Every failure lands on "ask for a new link".
 *
 * The rules refuse an expired, spent and nonexistent token identically, on
 * purpose: telling those three apart would make this page an oracle for guessing
 * which tokens exist.
 */
const OUTCOME_MESSAGES: Record<InviteFailure, string> = {
  "invite-invalid": "This invite has already been used, or it has expired. Ask your superadmin for a new link.",
  "already-has-role": "This account is already a class representative or an administrator.",
  "invalid-name": "Enter a name between 1 and 80 characters.",
  unknown: "Something went wrong accepting the invite. Please try again.",
};
