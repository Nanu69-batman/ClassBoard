import { AuthProvider } from "../auth/AuthProvider";
import { InvitePage } from "./InvitePage";

/**
 * The invite landing page, as its own lazily-loaded entry point.
 *
 * Separate from `privilegedRoutes` because this is the one surface that exists
 * *before* a role exists. It cannot be guarded by `RequireRole`, since the person
 * on it is by definition not yet a CR. The guard that matters is the token: the
 * page does nothing without one, and the rules refuse the claim without a valid
 * one.
 *
 * Lazy for the same reason as the other privileged routes — it pulls in the auth
 * SDK, and a student who opens the app with no invite has no use for that.
 */
export function InviteRoute() {
  return (
    <AuthProvider>
      <InvitePage />
    </AuthProvider>
  );
}
