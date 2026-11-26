"use client";

// Lot 39a (UX-07 ; D6 ; ADR 0073), refait au lot 70b (M5, C-09) — l'offre « Annuler » d'une suppression
// (cookie posé par l'action qui a supprimé), passée au message de retour unique du gabarit
// (app/ui/feedback.tsx). « Annuler » repasse par le serveur, qui revérifie les droits.
import { useMemo } from "react";
import { ShowFeedbackOnMount, useFeedback } from "@/app/ui/feedback";
import { undoDeletionAction } from "./undo-actions";

export type UndoOfferLabels = { message: string; detail: string | null; undo: string; restored: string; gone: string; conflict: string };

export function UndoOfferFeedback({ kind, id, labels }: { kind: string; id: string; labels: UndoOfferLabels }) {
  const feedback = useFeedback();
  const input = useMemo(
    () => ({
      title: labels.message,
      detail: labels.detail ?? undefined,
      action: {
        kind: "undo" as const,
        label: labels.undo,
        run: async () => {
          const formData = new FormData();
          formData.set("kind", kind);
          formData.set("id", id);
          const result = await undoDeletionAction({ status: "idle" }, formData);
          if (result.status === "restored") feedback?.show({ title: labels.restored });
          else feedback?.show({ tone: "error", title: result.status === "conflict" ? labels.conflict : labels.gone });
        },
      },
    }),
    [feedback, kind, id, labels],
  );
  return <ShowFeedbackOnMount input={input} />;
}
