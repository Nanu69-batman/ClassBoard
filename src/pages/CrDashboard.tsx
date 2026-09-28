import { useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { EmptyState } from "../components/EmptyState";
import { PrivilegedShell, type NavItem } from "../components/PrivilegedShell";
import { StatCards } from "../components/StatCards";
import { allSampleAssignments } from "../data/assignments";
import { getClass, getSubjectsFor } from "../data/classes";
import { countAssignments, sortAssignments } from "../utils/assignmentStatus";

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "assignments", label: "Assignments" },
  { id: "subjects", label: "Subjects" },
  { id: "account", label: "Account" },
];

/**
 * Read-only for now. Assignment CRUD is M6; the layout, navigation, guard and
 * data shape are what M3 delivers, and they are all exercised here.
 */
export function CrDashboard() {
  const { profile, user } = useAuth();
  const [section, setSection] = useState("dashboard");
  const [isNavOpen, setIsNavOpen] = useState(false);

  const classInfo = getClass(profile?.classId);
  const subjects = getSubjectsFor(profile?.classId);

  // A CR only ever sees their own class. Filtering by the profile's classId is
  // the client-side half of that; the rules enforce the other half.
  const ownAssignments = useMemo(
    () =>
      allSampleAssignments
        .filter((assignment) => assignment.classId === profile?.classId)
        .sort(sortAssignments),
    [profile?.classId],
  );

  // Nothing here is student completion — this is the CR's own view, so nothing is
  // "completed". Overdue and due-soon come straight from the due dates.
  const counts = useMemo(() => countAssignments(ownAssignments, () => false), [ownAssignments]);

  const contextLabel = classInfo?.displayName ?? profile?.classId ?? "No class assigned";

  return (
    <PrivilegedShell
      areaLabel="CR dashboard"
      contextLabel={contextLabel}
      navItems={NAV}
      activeSection={section}
      onSelectSection={setSection}
      isNavOpen={isNavOpen}
      onMenuClick={() => setIsNavOpen((value) => !value)}
    >
      {section === "dashboard" && (
        <>
          <div className="greeting">
            <h1 className="greeting__title">
              {classInfo?.displayName ?? "No class assigned"} <span aria-hidden="true">📋</span>
            </h1>
            <p className="greeting__subtitle">
              Everything here is scoped to your class. Students see these assignments without an
              account.
            </p>
          </div>

          <StatCards counts={counts} />

          <div className="toolbar">
            <h2 className="toolbar__title">Your assignments</h2>
            <span className="badge badge--upcoming">{ownAssignments.length} total</span>
          </div>

          {ownAssignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              message="Posting assignments arrives in M6."
            />
          ) : (
            <ul className="record-list">
              {ownAssignments.slice().sort(sortAssignments).map((assignment) => (
                <li key={assignment.id} className="record">
                  <div className="record__body">
                    <p className="record__meta">{assignment.subject}</p>
                    <p className="record__title">{assignment.title}</p>
                    <p className="record__description">{assignment.description}</p>
                  </div>
                  <p className="record__aside">
                    <span className={`badge badge--priority-${assignment.priority}`}>
                      {assignment.priority}
                    </span>
                    <span className="record__date">{assignment.dueDate}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {section === "assignments" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Assignments</h2>
            <span className="badge badge--upcoming">{ownAssignments.length} active</span>
          </div>
          <p className="section-lead">
            Creating, editing and deactivating assignments arrives in M6. For now this list is
            read-only.
          </p>
          <ul className="record-list">
            {ownAssignments.slice().sort(sortAssignments).map((assignment) => (
              <li key={assignment.id} className="record">
                <div className="record__body">
                  <p className="record__meta">{assignment.subject}</p>
                  <p className="record__title">{assignment.title}</p>
                </div>
                <p className="record__aside">
                  <span className="record__date">{assignment.dueDate}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {section === "subjects" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Subjects</h2>
            <span className="badge badge--upcoming">{subjects.length} subjects</span>
          </div>
          <ul className="record-list">
            {subjects.map((subject) => (
              <li key={subject.id} className="record">
                <div className="record__body">
                  <p className="record__title">{subject.name}</p>
                </div>
                <p className="record__aside">
                  <span className="badge badge--upcoming">{subject.shortName}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {section === "account" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Account</h2>
          </div>
          <dl className="detail-list">
            <div className="detail">
              <dt className="detail__label">Name</dt>
              <dd className="detail__value">{profile?.displayName ?? "—"}</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Email</dt>
              <dd className="detail__value">{user?.email ?? "—"}</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Role</dt>
              <dd className="detail__value">Class representative</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Class</dt>
              <dd className="detail__value">{contextLabel}</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Sign-in method</dt>
              <dd className="detail__value">
                {user?.providerData?.some((provider) => provider.providerId === "google.com")
                  ? "Google"
                  : "Email and password"}
              </dd>
            </div>
          </dl>
          <p className="section-lead">
            Password changes go through your superadmin in the Firebase console. Email self-service
            is optional and not enabled.
          </p>
        </>
      )}
    </PrivilegedShell>
  );
}
