import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { FullPageStatus } from "../components/FullPageStatus";
import { useAuth } from "./AuthProvider";

/**
 * Sends signed-out visitors to the login page, remembering where they were
 * going. UX only: row-level security is what actually protects the data.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageStatus title="Loading…" />;

  if (status === "signed-out") {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}

/**
 * Where to go after signing in. Only same-app paths are honoured, so a crafted
 * `?next=https://elsewhere` link cannot bounce someone off-site.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/app";
  return raw;
}
