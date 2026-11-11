import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { EmptyState } from "../components/EmptyState";
import { LinkIcon, PlusIcon } from "../components/icons";
import { BooksIllustration } from "../components/illustrations";
import { PageHero } from "../components/PageHero";
import { ROLE_LABELS } from "../data/types";
import { initials, useAppContext } from "./AppLayout";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** `/app`: your classes at a glance, and the way to add more. */
export function AppHome() {
  const { displayName } = useAuth();
  const { classes, openAddClass } = useAppContext();
  const list = classes.data ?? [];

  return (
    <main className="content">
      <PageHero
        title={`${greeting()}, ${displayName.split(" ")[0]}.`}
        subtitle={
          list.length > 0 ? (
            <>
              You're in <strong>{list.length}</strong> {list.length === 1 ? "class" : "classes"}. Pick one to see
              what's due.
            </>
          ) : (
            "Let's get you into a class."
          )
        }
        art={<BooksIllustration className="hero__books" />}
      />

      <div className="toolbar">
        <h2 className="toolbar__title">Your classes</h2>
        <div className="toolbar__actions">
          <button type="button" className="button button--ghost" onClick={() => openAddClass("join")}>
            <LinkIcon size={15} />
            Join a class
          </button>
          <button type="button" className="button button--primary" onClick={() => openAddClass("create")}>
            <PlusIcon size={15} />
            Create a class
          </button>
        </div>
      </div>

      {classes.status === "loading" && <EmptyState title="Loading your classes…" message="One moment." />}
      {classes.status === "error" && <EmptyState title="Something went wrong" message={classes.error} />}

      {classes.status === "ready" && list.length === 0 && (
        <EmptyState
          title="You're not in any classes yet"
          message="Create one for your section, or open the invite link your class rep shared."
        />
      )}

      {list.length > 0 && (
        <ul className="class-grid">
          {list.map((each) => (
            <li key={each.id} className="class-card">
              <Link to={`/app/${each.id}`} className="class-card__link">
                <span className="class-card__icon" aria-hidden="true">
                  {initials(each.name)}
                </span>
                <span className="class-card__body">
                  <span className="class-card__name">{each.name}</span>
                  {each.description && <span className="class-card__description">{each.description}</span>}
                </span>
                <span className={`badge badge--role-${each.role}`}>{ROLE_LABELS[each.role]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
