import { useState } from "react";
import { Link } from "react-router-dom";

import { toFriendlyError } from "../../auth/errors";
import { createAssignment, updateAssignment } from "../../data/assignments";
import type { ManagedAssignment, SubjectInfo } from "../../data/types";
import { AssignmentForm, type Submission } from "../AssignmentForm";
import { Modal } from "../Modal";

type Props = {
  open: boolean;
  classId: string;
  subjects: SubjectInfo[];
  /** The one being edited, or null to post a new one. */
  assignment: ManagedAssignment | null;
  onClose: () => void;
  /** After a successful save, with a line to show the person. */
  onSaved: (message: string) => void;
};

/** Post or edit an assignment, in a modal over whichever page asked for it. */
export function AssignmentDialog({ open, classId, subjects, assignment, onClose, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = assignment !== null;
  const noSubjects = !isEditing && !subjects.some((each) => each.active);

  function close() {
    setError(null);
    onClose();
  }

  async function handleSubmit({ keep, add, ...draft }: Submission) {
    setIsSaving(true);
    setError(null);
    try {
      if (assignment) {
        await updateAssignment(assignment, draft, { keep, add });
        onSaved("Assignment updated.");
      } else {
        await createAssignment(classId, draft, add);
        onSaved("Assignment posted. Your class can see it now.");
      }
      close();
    } catch (cause) {
      setError(toFriendlyError(cause));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      busy={isSaving}
      wide
      title={isEditing ? "Edit assignment" : "Post an assignment"}
      hint={isEditing ? undefined : "Everyone in the class sees it as soon as it's posted."}
    >
      {noSubjects ? (
        <div className="dialog__empty">
          <p>Every assignment belongs to a subject, and this class has none yet.</p>
          <div className="form__actions">
            <button type="button" className="button button--ghost" onClick={close}>
              Cancel
            </button>
            <Link className="button button--primary" to={`/app/${classId}/manage/subjects?add=1`} onClick={close}>
              Add a subject
            </Link>
          </div>
        </div>
      ) : (
        <AssignmentForm
          assignment={assignment}
          subjects={subjects}
          isSaving={isSaving}
          error={error}
          onSubmit={(submission) => void handleSubmit(submission)}
          onCancel={close}
        />
      )}
    </Modal>
  );
}
