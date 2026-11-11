import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { toFriendlyError } from "../auth/errors";
import { Brand } from "../components/Brand";
import { FullPageStatus } from "../components/FullPageStatus";
import { joinClass, parseInviteCode, peekClass, type ClassPreview } from "../data/classes";

type State =
  | { phase: "checking" }
  | { phase: "invalid" }
  | { phase: "ready"; preview: ClassPreview }
  | { phase: "error"; message: string };

/**
 * Where an invite link lands. Signed out: say what the link is for and ask them
 * to log in or sign up, then come straight back here. Signed in: show the class
 * and a Join button.
 */
export function JoinPage() {
  const { status, displayName } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ code: string }>();
  const code = parseInviteCode(params.code ?? "");
  const here = `/join/${code}`;

  const [state, setState] = useState<State>({ phase: "checking" });
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "signed-in") return;
    if (!/^[a-z0-9]{4,32}$/.test(code)) {
      setState({ phase: "invalid" });
      return;
    }

    let cancelled = false;
    setState({ phase: "checking" });
    peekClass(code)
      .then((preview) => {
        if (!cancelled) setState(preview ? { phase: "ready", preview } : { phase: "invalid" });
      })
      .catch((cause) => {
        if (!cancelled) setState({ phase: "error", message: toFriendlyError(cause) });
      });

    return () => {
      cancelled = true;
    };
  }, [status, code]);

  if (status === "loading") return <FullPageStatus title="Loading…" />;

  if (status === "signed-out") {
    const next = encodeURIComponent(here);
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--notice">
          <Link className="auth-card__brand" to="/">
          <Brand />
        </Link>
          <h1 className="auth-card__title">You've been invited to a class</h1>
          <p className="auth-card__hint">Log in or create an account to join it. You'll come straight back here.</p>
          <Link className="button button--primary button--block" to={`/signup?next=${next}`}>
            Sign up
          </Link>
          <Link className="button button--ghost button--block" to={`/login?next=${next}`}>
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === "checking") return <FullPageStatus title="Checking your invite…" />;

  if (state.phase === "invalid" || state.phase === "error") {
    return (
      <FullPageStatus title="This invite isn't valid">
        <p className="auth-card__hint">
          {state.phase === "error"
            ? state.message
            : "The link may be mistyped, or the class may have reset its invite code. Ask for a fresh link."}
        </p>
        <Link className="button button--primary" to="/app">
          Go to your classes
        </Link>
      </FullPageStatus>
    );
  }

  const { preview } = state;
  if (preview.isMember) return <Navigate to={`/app/${preview.id}`} replace />;

  async function handleJoin() {
    setIsJoining(true);
    setJoinError(null);
    try {
      const classId = await joinClass(code);
      navigate(`/app/${classId}`, { replace: true });
    } catch (cause) {
      setJoinError(toFriendlyError(cause));
      setIsJoining(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--notice">
        <p className="auth-card__hint">You've been invited to join</p>
        <h1 className="auth-card__title">{preview.name}</h1>
        {preview.description && <p className="auth-card__hint">{preview.description}</p>}
        <p className="auth-card__meta">
          {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}
        </p>
        <button
          type="button"
          className="button button--primary button--block"
          disabled={isJoining}
          onClick={() => void handleJoin()}
        >
          {isJoining ? "Joining…" : `Join as ${displayName}`}
        </button>
        {joinError && (
          <p className="auth-card__error" role="alert">
            {joinError}
          </p>
        )}
        <Link className="auth-card__back" to="/app">
          Not now
        </Link>
      </div>
    </div>
  );
}
