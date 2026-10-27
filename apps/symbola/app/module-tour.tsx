"use client";

import { useState } from "react";
import { GuidedTour, HelpButton, type TourStep } from "@symbola/ui";
import { markTourSeenAction } from "./actions";

// AIDE-01 — visite guidée d'un module (événements, budget, devis) : ouverte
// d'office à la première visite (décidé côté serveur), relançable depuis le
// bouton « ? ».
export function ModuleTourAndHelp({
  moduleKey,
  tourInitiallyOpen,
  tourSteps,
  skipLabel,
  nextLabel,
  finishLabel,
  helpTitle,
  helpBody,
  relaunchLabel,
}: {
  moduleKey: "events" | "budget" | "quotes";
  tourInitiallyOpen: boolean;
  tourSteps: TourStep[];
  skipLabel: string;
  nextLabel: string;
  finishLabel: string;
  helpTitle: string;
  helpBody: string;
  relaunchLabel: string;
}) {
  const [open, setOpen] = useState(tourInitiallyOpen);

  async function close() {
    setOpen(false);
    await markTourSeenAction(moduleKey);
  }

  return (
    <>
      <GuidedTour
        open={open}
        steps={tourSteps}
        skipLabel={skipLabel}
        nextLabel={nextLabel}
        finishLabel={finishLabel}
        onClose={close}
      />
      <HelpButton title={helpTitle} body={helpBody} relaunchLabel={relaunchLabel} onRelaunchTour={() => setOpen(true)} />
    </>
  );
}
