"use client";

// Lot 10 (AIDE-05) — visite focus d'un écran et bouton « ? » (article d'aide,
// relance de la visite). La progression est enregistrée à chaque étape :
// « Plus tard » garde l'étape, la barre d'aide propose de reprendre.
import { useEffect, useState } from "react";
import { FocusTour, HelpButton, type FocusTourStep } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { recordHelpProgressAction } from "./actions";
import { useHelpContext } from "./help-context";

export function PageTour({
  tourKey,
  steps,
  initialOpen,
  initialStep,
  postponedStep: initialPostponed,
  helpTitle,
  helpBody,
}: {
  tourKey: string;
  steps: FocusTourStep[];
  initialOpen: boolean;
  initialStep: number;
  postponedStep: number | null;
  helpTitle: string;
  helpBody: string;
}) {
  const t = useTranslations("Tour");
  const tHelp = useTranslations("Help");
  const [open, setOpen] = useState(initialOpen);
  const [startStep, setStartStep] = useState(initialStep);
  const [postponedStep, setPostponedStep] = useState<number | null>(initialPostponed);
  const itemKey = `tour:${tourKey}`;
  const help = useHelpContext();
  const setTour = help?.setTour;

  // Déclare la visite à la barre d'aide, qui propose de la reprendre.
  useEffect(() => {
    if (!setTour) return;
    setTour({
      key: tourKey,
      postponedStep,
      open,
      resume: () => {
        setStartStep(postponedStep ?? 0);
        setOpen(true);
      },
    });
    return () => setTour(null);
  }, [setTour, tourKey, postponedStep, open]);

  return (
    <>
      <FocusTour
        open={open}
        steps={steps}
        initialStep={startStep}
        labels={{
          continue: t("continue"),
          finish: t("finish"),
          back: t("back"),
          later: t("later"),
          stepOf: (step, total) => t("stepOf", { step, total }),
          laterHint: t("laterHint"),
        }}
        onStepChange={(step) => void recordHelpProgressAction(itemKey, "started", step)}
        onLater={(step) => {
          setOpen(false);
          setPostponedStep(step);
          void recordHelpProgressAction(itemKey, "postponed", step);
        }}
        onFinish={() => {
          setOpen(false);
          setPostponedStep(null);
          void recordHelpProgressAction(itemKey, "completed", steps.length - 1);
        }}
      />
      <HelpButton
        title={helpTitle}
        body={helpBody}
        relaunchLabel={tHelp("relaunchTour")}
        onRelaunchTour={() => {
          setStartStep(0);
          setOpen(true);
        }}
      />
    </>
  );
}
