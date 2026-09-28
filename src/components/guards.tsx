import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

type Role = "cr" | "superadmin";

const LOGIN_PATH: Record<Role, string> = {
  cr: "/cr/login",
  superadmin: "/admin/login",
};

function FullPageMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--notice">
        <h1 className="auth-card__title">{title}</h1>
        <p className="auth-card__hint">{message}</p>
        <a className="button button--primary" href="/">
          Go to the dashboard
        </a>
      </div>
    </div>
  );
}

/**
 * Client-side routing guard.
 *
 * This is for UX only. The Firestore rules are the actual boundary — §22 is
 * explicit that the frontend is not a security boundary. Someone who edits this
 * component gains nothing, because every privileged write is checked
 * server-side.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { status, profile } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="auth-page" role="status">
        <div className="auth-card auth-card--notice">
          <p className="auth-card__title">Loading…</p>
        </div>
      </div>
    );
  }

  if (status === "signed-out") {
    return <Navigate to={LOGIN_PATH[role]} replace state={{ from: location.pathname }} />;
  }

  // Signed in, but no users/{uid} document. Either a self-registered account or
  // a CR who has not claimed an invite yet.
  if (!profile) {
    return (
      <FullPageMessage
        title="No access yet"
        message="This account is not linked to a class. If you were expecting access, ask your superadmin to send you an invite link."
      />
    );
  }

  if (!profile.active) {
    return (
      <FullPageMessage
        title="Account deactivated"
        message="This account is no longer active. Ask your superadmin if you think that is wrong."
      />
    );
  }

  // A superadmin is a superset of a CR but has no class of their own, so
  // sending them to the CR dashboard would be meaningless.
  if (profile.role !== role) {
    return <Navigate to={profile.role === "superadmin" ? "/admin" : "/cr"} replace />;
  }

  return <>{children}</>;
}

/** Keeps a signed-in person off a login page they do not need. */
export function RedirectIfAlreadySignedIn({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { status, profile } = useAuth();

  if (status === "loading") return null;

  if (status === "signed-in" && profile?.active && profile.role === role) {
    return <Navigate to={role === "cr" ? "/cr" : "/admin"} replace />;
  }

  return <>{children}</>;
}
