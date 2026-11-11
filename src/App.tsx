import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { FullPageStatus } from "./components/FullPageStatus";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";

/**
 * The landing and sign-in pages are eager; the app itself is lazily loaded, so a
 * first-time visitor reading the landing page doesn't download the dashboards.
 */
const AppLayout = lazy(() => import("./pages/AppLayout").then((m) => ({ default: m.AppLayout })));
const AppHome = lazy(() => import("./pages/AppHome").then((m) => ({ default: m.AppHome })));
const ClassPage = lazy(() => import("./pages/ClassPage").then((m) => ({ default: m.ClassPage })));
const AccountPage = lazy(() => import("./pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const JoinPage = lazy(() => import("./pages/JoinPage").then((m) => ({ default: m.JoinPage })));

/** Signed-in people skip the landing page and go straight to their classes. */
function Home() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageStatus title="Loading…" />;
  if (status === "signed-in") return <Navigate to="/app" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageStatus title="Loading…" />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        {/* A join link works signed out too: the page asks you to sign in first. */}
        <Route path="/join/:code" element={<JoinPage />} />

        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AppHome />} />
          <Route path="account" element={<AccountPage />} />
          <Route path=":classId" element={<ClassPage />} />
          <Route path=":classId/manage" element={<ClassPage view="manage" />} />
          <Route path=":classId/manage/:section" element={<ClassPage view="manage" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
