import { useAuth } from "../auth/AuthProvider";

/**
 * Placeholder for M6. It exists so the guard can be exercised end to end: if you
 * can see this, the role resolved from `users/{uid}` and the redirect worked.
 */
export function CrDashboard() {
  const { profile, user, signOut } = useAuth();

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--notice">
        <h1 className="auth-card__title">CR dashboard</h1>
        <p className="auth-card__hint">
          Signed in as <strong>{profile?.displayName ?? user?.email ?? "a class representative"}</strong>
          {" for class "}
          <code>{profile?.classId ?? "—"}</code>.
        </p>
        <p className="auth-card__hint">Assignment management arrives in M6.</p>
        <button type="button" className="button button--secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
