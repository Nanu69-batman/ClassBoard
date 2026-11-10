import { useState } from "react";

import { useAuth } from "../../auth/AuthProvider";
import { toFriendlyError } from "../../auth/errors";
import { removeMember, setMemberRole } from "../../data/classes";
import { ROLE_LABELS, type ClassInfo, type Member, type MemberRole } from "../../data/types";
import { Avatar } from "../Avatar";
import { EmptyState } from "../EmptyState";

const ROLE_ORDER: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 };

type Props = {
  info: ClassInfo;
  /** Null while loading. */
  members: Member[] | null;
};

/**
 * Everyone in the class. The owner can promote, demote, hand over and remove;
 * an admin can remove plain members. The database enforces the same rules.
 */
export function MembersTab({ info, members }: Props) {
  const { user } = useAuth();
  const myId = user?.id;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!members) return <EmptyState title="Loading members…" message="One moment." />;

  const sorted = [...members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.displayName.localeCompare(b.displayName),
  );

  async function run(member: Member, action: () => Promise<void>, success: string) {
    setBusyId(member.userId);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setBusyId(null);
    }
  }

  function canRemove(member: Member): boolean {
    if (member.userId === myId || member.role === "owner") return false;
    return info.role === "owner" || (info.role === "admin" && member.role === "member");
  }

  return (
    <>
      <p className="section-lead">
        Admins can post assignments and manage subjects. Only the owner can change roles.
      </p>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <ul className="member-list">
        {sorted.map((member) => {
          const isMe = member.userId === myId;
          const busy = busyId === member.userId;
          const ownerControls = info.role === "owner" && !isMe;

          return (
            <li key={member.userId} className="member">
              <Avatar name={member.displayName} />
              <div className="member__body">
                <p className="member__name">
                  {member.displayName}
                  {isMe && <span className="member__you"> (you)</span>}
                </p>
                <span className={`badge badge--role-${member.role}`}>{ROLE_LABELS[member.role]}</span>
              </div>

              <div className="member__actions">
                {ownerControls && member.role === "member" && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() =>
                      void run(member, () => setMemberRole(info.id, member.userId, "admin"), `${member.displayName} is now an admin.`)
                    }
                  >
                    Make admin
                  </button>
                )}
                {ownerControls && member.role === "admin" && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() =>
                      void run(member, () => setMemberRole(info.id, member.userId, "member"), `${member.displayName} is no longer an admin.`)
                    }
                  >
                    Remove admin
                  </button>
                )}
                {ownerControls && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Make ${member.displayName} the owner of ${info.name}? You'll become an admin and can't undo this yourself.`,
                        )
                      )
                        return;
                      void run(member, () => setMemberRole(info.id, member.userId, "owner"), `${member.displayName} now owns this class.`);
                    }}
                  >
                    Make owner
                  </button>
                )}
                {canRemove(member) && (
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove ${member.displayName} from ${info.name}?`)) return;
                      void run(member, () => removeMember(info.id, member.userId), `${member.displayName} was removed.`);
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
