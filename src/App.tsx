import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { StudentDashboard } from "./pages/StudentDashboard";

/**
 * Four surfaces. The student dashboard is eager; the three privileged ones are
 * lazily loaded, so a student never downloads the Firebase SDK.
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
        {/* Students. No account, no guard, no Firebase. */}
        <Route path="/" element={<StudentDashboard />} />

        <Route path="/cr/login" element={<CrLoginRoute />} />
        <Route path="/cr" element={<CrRoute />} />

        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route path="/admin" element={<AdminRoute />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
