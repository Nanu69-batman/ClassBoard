import { AuthProvider } from "../auth/AuthProvider";
import { RedirectIfAlreadySignedIn, RequireRole } from "../components/guards";
import { AdminDashboard } from "./AdminDashboard";
import { CrDashboard } from "./CrDashboard";
import { LoginPage } from "./LoginPage";

/**
 * Each privileged route is its own lazily-loaded entry point that mounts the
 * AuthProvider for itself.
 *
 * Students never download the Firebase SDK at all — the dashboard uses local
 * sample data, so bundling auth behind these boundaries keeps the student
 * payload small. This is the whole reason these are separate files rather than
 * inline JSX in App.
 */

export function CrLoginRoute() {
  return (
    <AuthProvider>
      <RedirectIfAlreadySignedIn role="cr">
        <LoginPage role="cr" />
      </RedirectIfAlreadySignedIn>
    </AuthProvider>
  );
}

export function CrRoute() {
  return (
    <AuthProvider>
      <RequireRole role="cr">
        <CrDashboard />
      </RequireRole>
    </AuthProvider>
  );
}

export function AdminLoginRoute() {
  return (
    <AuthProvider>
      <RedirectIfAlreadySignedIn role="superadmin">
        <LoginPage role="superadmin" />
      </RedirectIfAlreadySignedIn>
    </AuthProvider>
  );
}

export function AdminRoute() {
  return (
    <AuthProvider>
      <RequireRole role="superadmin">
        <AdminDashboard />
      </RequireRole>
    </AuthProvider>
  );
}
