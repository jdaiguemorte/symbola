"use client";

// Lot 10 (AIDE-05), refait au lot 13 (ADR 0033), au lot 16 (L16-HUB-19, ADR 0039) puis au lot 63f
// (HUB-11, ADR 0104) — un écran à visite guidée DÉCLARE ses étapes et son texte d'aide. À la
// première ouverture, la visite se lance d'elle-même une fois et compte alors comme vue ; ensuite,
// « ? › Revoir la visite » la relance.
import { useEffect, useId, type ReactNode } from "react";
import type { TourStep } from "@symbola/ui";
import { useHelpContext } from "./help-context";

export function PageTour({
  tourKey,
  steps,
  initialOpen,
  helpTitle,
  helpBody,
  helpExtra,
}: {
  tourKey: string;
  steps: TourStep[];
  initialOpen: boolean;
  helpTitle: string;
  helpBody: string;
  helpExtra?: ReactNode;
}) {
  const help = useHelpContext();
  const declare = help?.declare;
  const withdraw = help?.withdraw;
  const id = useId();
  // Les étapes viennent du serveur : comparées par leur contenu, pas par référence.
  const stepsKey = JSON.stringify(steps);

  useEffect(() => {
    if (!declare || !withdraw) return;
    declare(id, { title: helpTitle, body: helpBody, steps: JSON.parse(stepsKey) as TourStep[], tourKey, initialOpen, extra: helpExtra });
    return () => withdraw(id);
  }, [declare, withdraw, id, helpTitle, helpBody, stepsKey, tourKey, initialOpen, helpExtra]);

  return null;
}
