import { useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { PrivilegedShell, type NavItem } from "../components/PrivilegedShell";
import { allSampleAssignments } from "../data/assignments";
import { sampleClasses, sampleSubjects } from "../data/classes";

const NAV: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "classes", label: "Classes" },
  { id: "crs", label: "CRs" },
  { id: "subjects", label: "Subjects" },
  { id: "assignments", label: "All assignments" },
  { id: "account", label: "Account" },
];

const CLASS_ASSIGNMENTS: Record<string, number> = {
  "ece-2026-a": 6,
  "cse-2026-a": 5,
  "it-2026-b": 3,
};

const CLASS_CRS: Record<string, string> = {
  "ece-2026-a": "Asha Rao",
  "cse-2026-a": "Bhavya Iyer",
  "it-2026-b": "unassigned",
};

function CountTile({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`count-tile count-tile--${tone}`}>
      <span className="count-tile__value">{value}</span>
      <span className="count-tile__label">{label}</span>
    </div>
  );
}

/** Read-only. Class, subject and CR management is M8. */
export function AdminDashboard() {
  const { profile, user } = useAuth();
  const [section, setSection] = useState("overview");
  const [isNavOpen, setIsNavOpen] = useState(false);

  const activeClasses = useMemo(() => sampleClasses.filter((each) => each.active), []);
  const crCount = useMemo(
    () => Object.values(CLASS_CRS).filter((name) => name !== "unassigned").length,
    [],
  );

  return (
    <PrivilegedShell
      areaLabel="Superadmin"
      contextLabel={`${activeClasses.length} active classes`}
      navItems={NAV}
      activeSection={section}
      onSelectSection={setSection}
      isNavOpen={isNavOpen}
      onMenuClick={() => setIsNavOpen((value) => !value)}
    >
      {section === "overview" && (
        <>
          <div className="greeting">
            <h1 className="greeting__title">
              Overview <span aria-hidden="true">🗂️</span>
            </h1>
            <p className="greeting__subtitle">Every class, subject and CR in one place.</p>
          </div>

          <div className="count-row">
            <CountTile value={sampleClasses.length} label="Classes" tone="pending" />
            <CountTile value={crCount} label="CRs" tone="soon" />
            <CountTile value={allSampleAssignments.length} label="Assignments" tone="completed" />
          </div>

          <div className="toolbar">
            <h2 className="toolbar__title">Classes</h2>
          </div>

          <ul className="record-list">
            {sampleClasses.map((each) => (
              <li key={each.id} className="record">
                <div className="record__body">
                  <p className="record__title">{each.displayName}</p>
                  <p className="record__meta">
                    CR: {CLASS_CRS[each.id] ?? "unassigned"} • {CLASS_ASSIGNMENTS[each.id] ?? 0}{" "}
                    assignments
                  </p>
                </div>
                <p className="record__aside">
                  <span className={`badge badge--${each.active ? "completed" : "upcoming"}`}>
                    {each.active ? "Active" : "Inactive"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {section === "classes" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Classes</h2>
            <span className="badge badge--upcoming">{sampleClasses.length} total</span>
          </div>
          <p className="section-lead">
            Creating, editing and deactivating classes arrives in M8. Deactivating a class hides it
            from the student picker immediately.
          </p>
          <ul className="record-list">
            {sampleClasses.map((each) => (
              <li key={each.id} className="record">
                <div className="record__body">
                  <p className="record__title">{each.displayName}</p>
                  <p className="record__meta">
                    <code>{each.id}</code> • batch {each.batch} • section {each.section}
                  </p>
                </div>
                <p className="record__aside">
                  <span className={`badge badge--${each.active ? "completed" : "upcoming"}`}>
                    {each.active ? "Active" : "Inactive"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {section === "crs" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Class representatives</h2>
            <span className="badge badge--upcoming">{crCount} assigned</span>
          </div>
          <ul className="record-list">
            {sampleClasses.map((each) => (
              <li key={each.id} className="record">
                <div className="record__body">
                  <p className="record__title">{CLASS_CRS[each.id] ?? "Unassigned"}</p>
                  <p className="record__meta">{each.displayName}</p>
                </div>
                <p className="record__aside">
                  <span className={`badge badge--${CLASS_CRS[each.id] ? "completed" : "overdue"}`}>
                    {CLASS_CRS[each.id] ? "Active" : "Needs CR"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className="section-lead">
            Transferring a CR means issuing an invite link. That flow arrives in M8.
          </p>
        </>
      )}

      {section === "subjects" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">Subjects</h2>
            <span className="badge badge--upcoming">{sampleSubjects.length} total</span>
          </div>
          <ul className="record-list">
            {sampleSubjects.map((subject) => (
              <li key={`${subject.classId}/${subject.id}`} className="record">
                <div className="record__body">
                  <p className="record__title">{subject.name}</p>
                  <p className="record__meta">
                    {sampleClasses.find((c) => c.id === subject.classId)?.displayName}
                  </p>
                </div>
                <p className="record__aside">
                  <span className={`badge badge--${subject.active ? "completed" : "upcoming"}`}>
                    {subject.active ? "Active" : "Inactive"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {section === "assignments" && (
        <>
          <div className="toolbar">
            <h2 className="toolbar__title">All assignments</h2>
            <span className="badge badge--upcoming">{allSampleAssignments.length} total</span>
          </div>
          <p className="section-lead">Viewing and deactivating across classes arrives in M8.</p>
          <ul className="record-list">
            {allSampleAssignments.map((assignment) => (
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
              <dd className="detail__value">Superadmin</dd>
            </div>
            <div className="detail">
              <dt className="detail__label">Scope</dt>
              <dd className="detail__value">All classes</dd>
            </div>
          </dl>
          <p className="section-lead">
            A superadmin can do anything a CR can, for any class. Password changes go through the
            Firebase console.
          </p>
        </>
      )}
    </PrivilegedShell>
  );
}
