"use client";

// Lot 39c (UX-15) — cocher une tâche répond tout de suite : la coche s'affiche avant la réponse du
// serveur (mise à jour optimiste), et revient d'elle-même si l'enregistrement échoue.
import { useOptimistic } from "react";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";

export function TaskCheck({ eventId, taskId, done, labelDone, labelUndone }: { eventId: string; taskId: string; done: boolean; labelDone: string; labelUndone: string }) {
  const [shownDone, setShownDone] = useOptimistic(done);
  return (
    <form
      action={async (formData: FormData) => {
        setShownDone(!done);
        await toggleEventTaskAction(formData);
      }}
      className="task-check"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <button type="submit" aria-pressed={shownDone} aria-label={shownDone ? labelUndone : labelDone}>
        {shownDone ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : null}
      </button>
    </form>
  );
}
