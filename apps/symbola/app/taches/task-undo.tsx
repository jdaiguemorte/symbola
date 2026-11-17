"use client";

// Lot 39c (UX-07, UX-15) — « Annuler » pendant dix secondes après une tâche cochée dans un tableau des
// tâches (rétroplanning, écran « Tâches ») : le même bandeau que sur « Aujourd'hui » et la fiche.
// Monté par le gabarit de l'app, il survit à la ligne qui quitte la vue « À faire » et au passage à
// un autre écran. La zone annoncée aux lecteurs d'écran reste en place ; seul son contenu change.
import { createContext, useCallback, useContext, useEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";

const UNDO_MS = 10_000;
// Après « Annuler », le résultat reste lisible quelques secondes, comme après une suppression.
const RESULT_MS = 4_000;

export type TaskUndoOffer = { eventId: string; taskId: string; doneMessage: string; reopenedMessage: string };

type Phase = { kind: "offer"; offer: TaskUndoOffer } | { kind: "reopened"; message: string } | null;

type TaskUndoValue = {
  offer: (offer: TaskUndoOffer) => void;
  // La tâche en train d'être rétablie : sa case se décoche tout de suite (mise à jour optimiste).
  reopeningTaskId: string | null;
};

const TaskUndoContext = createContext<TaskUndoValue | null>(null);

// Sans gabarit (écran isolé), la coche fonctionne, sans offre d'annulation.
export function useTaskUndo(): TaskUndoValue | null {
  return useContext(TaskUndoContext);
}

export function TaskUndoProvider({ undoLabel, children }: { undoLabel: string; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(null);
  const [reopeningTaskId, setReopeningTaskId] = useOptimistic<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!phase) return;
    const timer = window.setTimeout(() => setPhase(null), phase.kind === "offer" ? UNDO_MS : RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Une nouvelle coche remplace l'offre en cours et relance les dix secondes.
  const offer = useCallback((next: TaskUndoOffer) => setPhase({ kind: "offer", offer: next }), []);

  const undo = (current: TaskUndoOffer) => {
    startTransition(async () => {
      setReopeningTaskId(current.taskId);
      const formData = new FormData();
      formData.set("eventId", current.eventId);
      formData.set("taskId", current.taskId);
      formData.set("done", "false");
      await toggleEventTaskAction(formData);
      setPhase({ kind: "reopened", message: current.reopenedMessage });
    });
  };

  const value = useMemo(() => ({ offer, reopeningTaskId }), [offer, reopeningTaskId]);

  return (
    <TaskUndoContext.Provider value={value}>
      <div role="status" className="task-undo">
        {phase?.kind === "offer" ? (
          <div className="undo-notice">
            <span>{phase.offer.doneMessage}</span>
            <button type="button" className="button-ghost" disabled={pending} onClick={() => undo(phase.offer)}>
              {undoLabel}
            </button>
          </div>
        ) : phase?.kind === "reopened" ? (
          <div className="undo-notice">
            <span>{phase.message}</span>
          </div>
        ) : null}
      </div>
      {children}
    </TaskUndoContext.Provider>
  );
}
