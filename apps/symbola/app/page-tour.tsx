"use client";

// Lot 10 (AIDE-05), refait au lot 13 (AIDE-11, ADR 0033) — aide sur
// l'écran par repères. Le bouton « ? » pose des repères numérotés sur les
// éléments réels de l'écran, et un panneau les explique (le texte d'aide de
// l'écran en introduction). À la première ouverture d'un écran, les repères
// s'affichent d'eux-mêmes une fois (décision C), ensuite seulement au clic.
// Fermer les repères les marque « vus ».
import { useEffect, useState } from "react";
import { Landmarks, type LandmarkStep } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { recordHelpProgressAction } from "./actions";
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
  const t = useTranslations("Landmarks");
  const [open, setOpen] = useState(initialOpen);
  const itemKey = `tour:${tourKey}`;
  const help = useHelpContext();
  const setTour = help?.setTour;

  // Ouverts d'office : comptés comme vus dès l'ouverture (ils ne s'imposent qu'une fois).
  useEffect(() => {
    if (initialOpen) void recordHelpProgressAction(itemKey, "completed", 0);
  }, [initialOpen, itemKey]);

  // La pastille « Reprendre » s'efface tant que les repères sont ouverts.
  useEffect(() => {
    if (!setTour) return;
    setTour({ key: tourKey, open });
    return () => setTour(null);
  }, [setTour, tourKey, open]);

  return (
    <>
      <button
        type="button"
        className="help-button"
        data-tour="help-button"
        aria-expanded={open}
        aria-label={t("toggle", { screen: helpTitle })}
        onClick={() => {
          if (!open) void recordHelpProgressAction(itemKey, "completed", 0);
          setOpen((value) => !value);
        }}
      >
        ?
      </button>
      <Landmarks
        open={open}
        intro={helpBody}
        steps={steps}
        labels={{
          panel: t("panel", { screen: helpTitle }),
          close: t("close"),
          previous: t("previous"),
          next: t("next"),
          marker: (number, title) => t("marker", { number, title }),
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
