import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { HomePage } from "./pages/HomePage";
import { StudentDashboard } from "./pages/StudentDashboard";

/**
 * Five surfaces. The landing page and the student dashboard are eager; the three
 * privileged ones are lazily loaded, so a student never downloads the auth or
 * storage SDK.
 */
const CrLoginRoute = lazy(() =>
  import("./pages/privilegedRoutes").then((m) => ({ default: m.CrLoginRoute })),
);
const CrRoute = lazy(() =>
  import("./pages/privilegedRoutes").then((m) => ({ default: m.CrRoute })),
);
const AdminLoginRoute = lazy(() =>
  import("./pages/privilegedRoutes").then((m) => ({ default: m.AdminLoginRoute })),
);
const AdminRoute = lazy(() =>
  import("./pages/privilegedRoutes").then((m) => ({ default: m.AdminRoute })),
);

function Loading() {
  return (
    <div className="auth-page" role="status">
      <div className="auth-card auth-card--notice">
        <p className="auth-card__title">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/*
          Students. No account and no guard.

          `/` is the landing page, and `/class/ece-2026-a` is a class dashboard.
          A student arrives on one from the link their CR shared; there is no way
          to reach a class page without one, and no index of classes to browse.

          The class id is a path segment rather than a `?class=` parameter now
          that `/` is a real page: a link a CR pastes into a chat should look
          like a place, not a query, and the dashboard is then addressable in its
          own right. `/` with no class is not a dashboard at all — it explains
          how to get in.
        */}
        <Route path="/" element={<HomePage />} />
        <Route path="/class/:classId" element={<StudentDashboard />} />

        <Route path="/cr/login" element={<CrLoginRoute />} />
        <Route path="/cr" element={<CrRoute />} />

        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route path="/admin" element={<AdminRoute />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
