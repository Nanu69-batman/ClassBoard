import { AssignmentCard } from "./AssignmentCard";
import type { AssignmentGroup } from "../utils/assignmentStatus";

type AssignmentListProps = {
  groups: AssignmentGroup[];
  isCompleted: (id: string) => boolean;
  onToggle: (id: string, viaKeyboard: boolean) => void;
  lastToggledId: string | null;
  /** The card that was ticked a moment ago, so it can animate settling in. */
  justCompletedId?: string | null;
};

/**
 * One flat list in urgency order. Status is still communicated by a group label
 * so overdue work can be spotted without relying on colour alone.
 */
export function AssignmentList({
  groups,
  isCompleted,
  onToggle,
  lastToggledId,
  justCompletedId = null,
}: AssignmentListProps) {
  return (
    <div className="groups">
      {groups.map((group) => (
        <section key={group.status} className="group" aria-labelledby={`group-${group.status}`}>
          <h3 className="group__label" id={`group-${group.status}`}>
            {group.title}
          </h3>

          <div className="group__rows">
            {group.items.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                isCompleted={isCompleted(assignment.id)}
                onToggle={onToggle}
                restoreFocus={assignment.id === lastToggledId}
                justCompleted={assignment.id === justCompletedId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
