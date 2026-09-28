import { useAuth } from "../auth/AuthProvider";

/** Placeholder for M8. Same purpose as CrDashboard, for the admin surface. */
export function AdminDashboard() {
  const { profile, user, signOut } = useAuth();

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--notice">
        <h1 className="auth-card__title">Superadmin</h1>
        <p className="auth-card__hint">
          Signed in as <strong>{profile?.displayName ?? user?.email ?? "an administrator"}</strong>.
        </p>
        <p className="auth-card__hint">Class, subject and CR management arrives in M8.</p>
        <button type="button" className="button button--secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
