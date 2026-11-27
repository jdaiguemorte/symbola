"use client";

// Lot 72b (AIDE-04 ; critère 5) — « Masquer » de la ligne « Pour bien démarrer » : la ligne part tout de
// suite ; le message de retour (lot 70b) propose « Annuler » dix secondes.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/app/ui/feedback";
import { hideFirstStepsAction, showFirstStepsAction } from "./first-steps-actions";

export function FirstStepsHideButton({ labels }: { labels: { hide: string; hidden: string; shown: string; undo: string; failed: string } }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [pending, startTransition] = useTransition();
  const hide = () =>
    startTransition(async () => {
      const result = await hideFirstStepsAction();
      if (!result.ok) {
        feedback?.show({ tone: "error", title: labels.failed });
        return;
      }
      feedback?.show({
        title: labels.hidden,
        action: {
          kind: "undo",
          label: labels.undo,
          run: async () => {
            await showFirstStepsAction();
            feedback.show({ title: labels.shown });
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  return (
    <button type="button" className="button-ghost" onClick={hide} disabled={pending}>
      {labels.hide}
    </button>
  );
}
