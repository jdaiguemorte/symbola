"use client";

// Lot 39c (UX-15) — cocher une tâche répond tout de suite : la coche s'affiche avant la réponse du
// serveur (mise à jour optimiste), et revient d'elle-même si l'enregistrement échoue.
// Lot 39c (UX-07) — une fois la coche enregistrée, « Annuler » la rétablit pendant dix secondes
// (bandeau du gabarit, `task-undo.tsx`) ; décocher ne propose rien.
import { useOptimistic } from "react";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";
import { useTaskUndo } from "./task-undo";

export function TaskCheck({
  eventId,
  taskId,
  done,
  labelDone,
  labelUndone,
  doneMessage,
  reopenedMessage,
}: {
  eventId: string;
  taskId: string;
  done: boolean;
  labelDone: string;
  labelUndone: string;
  doneMessage: string;
  reopenedMessage: string;
}) {
  const [shownDone, setShownDone] = useOptimistic(done);
  const undo = useTaskUndo();
  const checked = shownDone && undo?.reopeningTaskId !== taskId;
  return (
    <form
      action={async (formData: FormData) => {
        setShownDone(!done);
        await toggleEventTaskAction(formData);
        if (!done) undo?.offer({ eventId, taskId, doneMessage, reopenedMessage });
      }}
      className="task-check"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <button type="submit" aria-pressed={checked} aria-label={checked ? labelUndone : labelDone}>
        {checked ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : null}
      </button>
    </form>
  );
}
