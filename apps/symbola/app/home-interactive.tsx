"use client";

import { useState } from "react";
import { FirstStepsChecklist, type FirstStepsItem } from "@symbola/ui";
import { hideFirstStepsAction } from "./actions";

// AIDE-04 — liste « premiers pas » de l'accueil (masquage optimiste). La
// visite de l'accueil et le bouton « ? » passent par PageTour (lot 10).
export function HomeInteractive({
  firstStepsVisible,
  firstStepsTitle,
  firstStepsItems,
  firstStepsHideLabel,
}: {
  firstStepsVisible: boolean;
  firstStepsTitle: string;
  firstStepsItems: FirstStepsItem[];
  firstStepsHideLabel: string;
}) {
  const [stepsHidden, setStepsHidden] = useState(!firstStepsVisible);

  async function hideFirstSteps() {
    setStepsHidden(true);
    await hideFirstStepsAction();
  }

  return stepsHidden ? null : (
    <FirstStepsChecklist title={firstStepsTitle} items={firstStepsItems} hideLabel={firstStepsHideLabel} onHide={hideFirstSteps} />
  );
}
