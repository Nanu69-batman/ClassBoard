import { Link, NavLink, Navigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { ManageTab } from "../components/class/ManageTab";
import { manageLabel } from "../components/ClassMenu";
import { MembersTab } from "../components/class/MembersTab";
import { SettingsTab } from "../components/class/SettingsTab";
import { SubjectsTab } from "../components/class/SubjectsTab";
import { EmptyState } from "../components/EmptyState";
import { ArrowLeftIcon, DocumentIcon, LeafIcon, SettingsIcon, UsersIcon } from "../components/icons";
import { PageHero } from "../components/PageHero";
import { canManage, type ClassInfo } from "../data/types";
import { useClassData } from "../data/useClassData";

type ManageSection = "assignments" | "subjects" | "members" | "settings";

const SECTION_IDS: readonly ManageSection[] = ["assignments", "subjects", "members", "settings"];

/** Sections only owners and admins can open. */
const MANAGER_ONLY: readonly ManageSection[] = ["assignments", "subjects"];

/**
 * `/app/:classId/manage/:section`: everything about running the class, kept off
 * the class page so that page can be about the work alone.
 *
 * Owners and admins get Assignments (post, edit, archive) and Subjects; everyone
 * gets Members and Settings (the invite link, and leaving).
 */
export function ClassManageView({ info }: { info: ClassInfo }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const manager = canManage(info.role);
  const { section: rawSection } = useParams<{ section?: string }>();

  const [data] = useClassData(info.id, userId);

  const base = `/app/${info.id}/manage`;
  const fallback: ManageSection = manager ? "assignments" : "members";
  const section = SECTION_IDS.find((each) => each === rawSection);

  // No section, an unknown one, or a manager-only one for someone who can't post
  // (including after a demotion while it's open).
  if (!section || (MANAGER_ONLY.includes(section) && !manager)) {
    return <Navigate to={`${base}/${fallback}`} replace />;
  }

  const memberCount = data.data ? ` · ${data.data.members.length}` : "";
  const nav = [
    ...(manager
      ? [
          { id: "assignments" as const, label: "Assignments", icon: DocumentIcon },
          { id: "subjects" as const, label: "Subjects", icon: LeafIcon },
        ]
      : []),
    { id: "members" as const, label: `Members${memberCount}`, icon: UsersIcon },
    { id: "settings" as const, label: "Settings", icon: SettingsIcon },
  ];

  return (
    <main className="content content--wide">
      <Link className="back-link" to={`/app/${info.id}`}>
        <ArrowLeftIcon size={15} />
        Back to {info.name}
      </Link>

      <PageHero
        eyebrow={info.name}
        title={manageLabel(info)}
        subtitle={
          manager
            ? "Post and edit work, look after members, and change how the class is set up."
            : "Who's in the class, the invite link, and leaving."
        }
      />

      <div className="manage">
        <nav className="manage__nav" aria-label={manageLabel(info)}>
          {nav.map(({ id, label, icon: Icon }) => (
            <NavLink key={id} to={`${base}/${id}`} className="manage__link">
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="manage__panel tab-panel">
          {data.status === "error" && section !== "settings" && (
            <EmptyState title="Something went wrong" message={data.error} />
          )}

          {section === "assignments" && data.status !== "error" && (
            <ManageTab classId={info.id} data={data} />
          )}

          {section === "subjects" && data.status !== "error" && <SubjectsTab classId={info.id} data={data} />}

          {section === "members" && data.status !== "error" && (
            <MembersTab info={info} members={data.data?.members ?? null} />
          )}

          {section === "settings" && <SettingsTab info={info} />}
        </div>
      </div>
    </main>
  );
}
