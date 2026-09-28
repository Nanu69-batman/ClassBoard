import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { DocumentIcon } from "../components/icons";
import {
  claimInvite,
  preflightClaim,
  readInviteClassId,
  readInviteToken,
  type ClaimOutcome,
  type InviteFailure,
} from "../data/invites";
import type { ClassInfo } from "../data/types";

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
 * The token and class id are read from the URL, used as a Firestore path, and
 * then verified server-side. A tampered link fails at the rules, not in this
 * component. The class name shown here comes from a public class read and is
 * display only — the rules compare the submitted classId against the invite's own
 * and refuse a mismatch.
 */

type Phase = "checking" | "no-token" | "choose-account" | "confirm" | "claiming";

export function InvitePage() {
  const { status, user, profile, signInWithGoogle, signInWithEmail, createAccountWithEmail } =
    useAuth();
  const navigate = useNavigate();

  const [token] = useState(readInviteToken);
  const [classId] = useState(readInviteClassId);

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [phase, setPhase] = useState<Phase>(token ? "checking" : "no-token");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Email sign-in or sign-up. Mode is explicit rather than inferred, so a typo
  // does not silently create a second account for someone who meant to sign in.
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setPhase("no-token");
      return;
    }
    if (!classId) {
      setError("This link is incomplete. Ask your superadmin to send a new one.");
      setPhase("no-token");
      return;
    }

    let cancelled = false;

    // Resolve the class name before anything is offered, so the person can see
    // which class they are being made a CR of *before* they create an account.
    // Also catches a deactivated class while the token is still unspent.
    void preflightClaim(classId).then((found) => {
      if (cancelled) return;

      if (!found) {
        setError("This invite is no longer valid. Ask your superadmin for a new link.");
        setPhase("no-token");
        return;
      }

      setClassInfo(found);
    });

    return () => {
      cancelled = true;
    };
  }, [token, classId]);

  // Move to the right screen once auth has resolved and the class is known.
  useEffect(() => {
    if (status === "loading" || phase === "no-token" || phase === "claiming") return;

    if (status === "signed-out") {
      setPhase("choose-account");
    } else if (profile) {
      // Already holds a role. There is nothing here to claim.
      setPhase("confirm");
    } else {
      setPhase("confirm");
    }
  }, [status, profile, phase]);

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
        await createAccountWithEmail(email, password);
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
    if (!user || !token || !classId) return;

    setIsBusy(true);
    setError(null);
    setPhase("claiming");

    const result: ClaimOutcome = await claimInvite(token, classId, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
    });

    setIsBusy(false);

    if (result.ok) {
      // The AuthProvider has not yet seen the new profile, so navigate rather than
      // re-render in place: /cr mounts a fresh provider that reads it.
      navigate("/cr", { replace: true });
      return;
    }

    setError(OUTCOME_MESSAGES[result.reason]);
    setPhase("confirm");
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
        <strong>{classInfo?.displayName ?? "this class"}</strong>. You will be able to post
        assignments for them.
      </p>

      {status === "signed-out" ? (
        <>
          <button
            type="button"
            className="button button--google"
            disabled={isBusy}
            onClick={() => void handleGoogle()}
          >
            {isBusy && mode === "signin" ? "Opening Google…" : "Continue with Google"}
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
                minLength={mode === "signup" ? 6 : undefined}
              />
              {mode === "signup" && (
                <p className="field__hint">At least 6 characters.</p>
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
            Signed in as <strong>{user?.email ?? "your account"}</strong>
          </p>

          <button
            type="button"
            className="button button--primary button--block"
            disabled={isBusy}
            onClick={() => void handleClaim()}
          >
            {phase === "claiming" ? "Accepting…" : "Accept invite"}
          </button>

          {/*
            A mismatch here means the signed-in account is not the one the superadmin
            invited. Worth saying plainly, because the alternative — failing
            silently at the rules — looks like a broken link.
          */}
          <p className="field__hint">
            This account will become the class representative for{" "}
            {classInfo?.displayName}. If that is the wrong account, sign out and use
            another one.
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
  unknown: "Something went wrong accepting the invite. Ask your superadmin for a new link.",
};
