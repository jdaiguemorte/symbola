"use client";

import { useState } from "react";
import { GuidedTour, HelpButton, FirstStepsChecklist, type TourStep, type FirstStepsItem } from "@symbola/ui";
import { markTourSeenAction, hideFirstStepsAction } from "./actions";

// AIDE-01/03/04 — rassemble la visite guidée, le bouton d'aide et la liste
// « premiers pas » de la page d'accueil : seul cet écran a besoin d'un état
// client (ouverture de la visite, masquage optimiste de la liste), le reste
// de la page (app/page.tsx) reste un composant serveur.
export function HomeInteractive({
  tourInitiallyOpen,
  tourSteps,
  tourSkipLabel,
  tourNextLabel,
  tourFinishLabel,
  helpTitle,
  helpBody,
  relaunchTourLabel,
  firstStepsVisible,
  firstStepsTitle,
  firstStepsItems,
  firstStepsHideLabel,
}: {
  tourInitiallyOpen: boolean;
  tourSteps: TourStep[];
  tourSkipLabel: string;
  tourNextLabel: string;
  tourFinishLabel: string;
  helpTitle: string;
  helpBody: string;
  relaunchTourLabel: string;
  firstStepsVisible: boolean;
  firstStepsTitle: string;
  firstStepsItems: FirstStepsItem[];
  firstStepsHideLabel: string;
}) {
  const [tourOpen, setTourOpen] = useState(tourInitiallyOpen);
  const [stepsHidden, setStepsHidden] = useState(!firstStepsVisible);

  async function closeTour() {
    setTourOpen(false);
    await markTourSeenAction("hub");
  }

  async function hideFirstSteps() {
    setStepsHidden(true);
    await hideFirstStepsAction();
  }

  return (
    <>
      <GuidedTour
        open={tourOpen}
        steps={tourSteps}
        skipLabel={tourSkipLabel}
        nextLabel={tourNextLabel}
        finishLabel={tourFinishLabel}
        onClose={closeTour}
      />
      <HelpButton
        title={helpTitle}
        body={helpBody}
        relaunchLabel={relaunchTourLabel}
        onRelaunchTour={() => setTourOpen(true)}
      />
      {stepsHidden ? null : (
        <FirstStepsChecklist
          title={firstStepsTitle}
          items={firstStepsItems}
          hideLabel={firstStepsHideLabel}
          onHide={hideFirstSteps}
        />
      )}
    </>
  );
}
