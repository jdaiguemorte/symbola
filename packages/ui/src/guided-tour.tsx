"use client";

import { useState } from "react";

export type TourStep = { title: string; body: string };

// AIDE-01 — « Une visite guidée courte montre les fonctions principales,
// écran par écran. Il peut la passer. » open/onClose pilotés par
// l'appelant : la première ouverture se décide côté serveur
// (hasSeenTour), la fermeture déclenche markTourSeen (Server Action).
export function GuidedTour({
  open,
  steps,
  skipLabel,
  nextLabel,
  finishLabel,
  onClose,
}: {
  open: boolean;
  steps: TourStep[];
  skipLabel: string;
  nextLabel: string;
  finishLabel: string;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  if (!open || steps.length === 0) return null;

  const step = steps[stepIndex]!;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div role="dialog" aria-label={step.title}>
      <h2>{step.title}</h2>
      <p>{step.body}</p>
      <p>
        {stepIndex + 1} / {steps.length}
      </p>
      <button type="button" onClick={onClose}>
        {skipLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          if (isLast) {
            onClose();
          } else {
            setStepIndex((i) => i + 1);
          }
        }}
      >
        {isLast ? finishLabel : nextLabel}
      </button>
    </div>
  );
}
