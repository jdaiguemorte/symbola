"use client";

// Lot 39c (UX-07, UX-15) — « Annuler » pendant dix secondes après une tâche cochée dans un tableau des
// tâches (rétroplanning, écran « Tâches »). Lot 70b (M5, C-09) : l'offre passe par le message de retour
// unique du gabarit (app/ui/feedback.tsx) ; ce fournisseur ne garde que la tâche en train d'être
// rétablie, pour que sa case se décoche tout de suite (mise à jour optimiste).
import { createContext, useCallback, useContext, useMemo, useOptimistic, type ReactNode } from "react";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";
import { useFeedback } from "@/app/ui/feedback";

export type TaskUndoOffer = { eventId: string; taskId: string; doneMessage: string; reopenedMessage: string };

type TaskUndoValue = {
  offer: (offer: TaskUndoOffer) => void;
  reopeningTaskId: string | null;
};

const TaskUndoContext = createContext<TaskUndoValue | null>(null);

// Sans gabarit (écran isolé), la coche fonctionne, sans offre d'annulation.
export function useTaskUndo(): TaskUndoValue | null {
  return useContext(TaskUndoContext);
}

export function TaskUndoProvider({ undoLabel, children }: { undoLabel: string; children: ReactNode }) {
  const feedback = useFeedback();
  const [reopeningTaskId, setReopeningTaskId] = useOptimistic<string | null>(null);

  // Une nouvelle coche remplace le message en cours et relance les dix secondes.
  const offer = useCallback(
    (next: TaskUndoOffer) => {
      feedback?.show({
        title: next.doneMessage,
        action: {
          kind: "undo",
          label: undoLabel,
          // Appelé dans la transition du message : la case se décoche tout de suite, jusqu'à la réponse.
          run: async () => {
            setReopeningTaskId(next.taskId);
            const formData = new FormData();
            formData.set("eventId", next.eventId);
            formData.set("taskId", next.taskId);
            formData.set("done", "false");
            await toggleEventTaskAction(formData);
            feedback.show({ title: next.reopenedMessage });
          },
        },
      });
    },
    [feedback, undoLabel, setReopeningTaskId],
  );

  const value = useMemo(() => ({ offer, reopeningTaskId }), [offer, reopeningTaskId]);
  return <TaskUndoContext.Provider value={value}>{children}</TaskUndoContext.Provider>;
}
