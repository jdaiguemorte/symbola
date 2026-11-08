"use client";

// Lot 10 (AIDE-05), refait au lot 13 (AIDE-11, ADR 0033) puis au lot 16
// (HUB-19, ADR 0039) — aide sur l'écran par repères. L'écran DÉCLARE ses
// repères et son texte d'aide ; le « ? » de la barre du haut les affiche. À
// la première ouverture d'un écran, ils s'affichent d'eux-mêmes une fois
// (décision C du lot 13), et comptent alors comme vus.
import { useEffect, useId } from "react";
import type { LandmarkStep } from "@symbola/ui";
import { useHelpContext } from "./help-context";

export function PageTour({
  tourKey,
  steps,
  initialOpen,
  helpTitle,
  helpBody,
}: {
  tourKey: string;
  steps: LandmarkStep[];
  initialOpen: boolean;
  helpTitle: string;
  helpBody: string;
}) {
  const help = useHelpContext();
  const declare = help?.declare;
  const withdraw = help?.withdraw;
  const id = useId();
  // Les repères viennent du serveur : comparés par leur contenu, pas par référence.
  const stepsKey = JSON.stringify(steps);

  useEffect(() => {
    if (!declare || !withdraw) return;
    declare(id, { title: helpTitle, body: helpBody, steps: JSON.parse(stepsKey) as LandmarkStep[], tourKey, initialOpen });
    return () => withdraw(id);
  }, [declare, withdraw, id, helpTitle, helpBody, stepsKey, tourKey, initialOpen]);

  return null;
}
